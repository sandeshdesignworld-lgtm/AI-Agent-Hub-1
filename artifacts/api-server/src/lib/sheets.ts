import { google, type sheets_v4 } from "googleapis";
import { createPrivateKey } from "node:crypto";

/**
 * Thin Google Sheets API wrapper backed by a service account.
 *
 * Required environment variables:
 *   - GOOGLE_SERVICE_ACCOUNT_EMAIL
 *   - GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY  (private key from the JSON, \n-escaped)
 *   - ONBOARDING_SHEET_ID                 (spreadsheet id from the sheet URL)
 */

let cachedClient: sheets_v4.Sheets | null = null;

async function getClient(): Promise<sheets_v4.Sheets> {
  if (cachedClient) return cachedClient;

  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;

  if (!email || !rawKey) {
    throw new Error(
      "Google service account credentials are not configured (GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY)",
    );
  }

  // --- Key normalization ---
  // 1. Strip surrounding quotes (in case the user pasted the value with them)
  let privateKey = rawKey.trim();
  if (
    (privateKey.startsWith('"') && privateKey.endsWith('"')) ||
    (privateKey.startsWith("'") && privateKey.endsWith("'"))
  ) {
    privateKey = privateKey.slice(1, -1);
  }
  // 2. Replace literal "\n" sequences with real newlines
  if (privateKey.includes("\\n")) {
    privateKey = privateKey.replace(/\\n/g, "\n");
  }
  // 3. Re-export through Node.js crypto to normalise OpenSSL 3 key format.
  //    This reliably produces a clean PKCS#8 PEM that googleapis accepts.
  try {
    const keyObj = createPrivateKey({ key: privateKey, format: "pem" });
    privateKey = keyObj.export({ type: "pkcs8", format: "pem" }) as string;
  } catch (e) {
    throw new Error(
      `Failed to parse GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: ${e instanceof Error ? e.message : String(e)}`,
    );
  }

  const auth = new google.auth.GoogleAuth({
    credentials: {
      type: "service_account",
      client_email: email,
      private_key: privateKey,
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const client = await auth.getClient();
  cachedClient = google.sheets({ version: "v4", auth: client as never });
  return cachedClient;
}

function getSpreadsheetId(): string {
  const id = process.env.ONBOARDING_SHEET_ID;
  if (!id) throw new Error("ONBOARDING_SHEET_ID environment variable is not set");
  return id;
}

/** Convert a spreadsheet column letter (e.g. "A", "AA") to a 0-based index. */
function columnToIndex(column: string): number {
  let index = 0;
  for (const char of column.toUpperCase()) {
    index = index * 26 + (char.charCodeAt(0) - 64);
  }
  return index - 1;
}

/** Read every row from a tab. Returns [] when the tab is empty. */
export async function getRows(sheetTab: string): Promise<string[][]> {
  const sheets = await getClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: getSpreadsheetId(),
    range: sheetTab,
  });
  return (res.data.values as string[][] | undefined) ?? [];
}

/** Append a single row to the end of a tab. */
export async function appendRow(sheetTab: string, values: unknown[]): Promise<void> {
  const sheets = await getClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId: getSpreadsheetId(),
    range: sheetTab,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [values] },
  });
}

/**
 * Find the first row where `matchColumn` equals `matchValue` and write
 * `newValue` into `column` on that same row.
 * Both `column` and `matchColumn` are column letters (e.g. "A", "I").
 */
export async function updateCell(
  sheetTab: string,
  column: string,
  matchColumn: string,
  matchValue: string,
  newValue: string,
): Promise<void> {
  const rowNumber = await findRowNumber(sheetTab, matchColumn, matchValue);
  const sheets = await getClient();
  await sheets.spreadsheets.values.update({
    spreadsheetId: getSpreadsheetId(),
    range: `${sheetTab}!${column}${rowNumber}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [[newValue]] },
  });
}

/**
 * Find the first row where `matchColumn` equals `matchValue` and write several
 * cells on that row in a single batch. `updates` is keyed by column letter.
 */
export async function updateMultipleCells(
  sheetTab: string,
  matchColumn: string,
  matchValue: string,
  updates: Record<string, string>,
): Promise<void> {
  const rowNumber = await findRowNumber(sheetTab, matchColumn, matchValue);
  const sheets = await getClient();
  const data = Object.entries(updates).map(([column, value]) => ({
    range: `${sheetTab}!${column}${rowNumber}`,
    values: [[value]],
  }));
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: getSpreadsheetId(),
    requestBody: { valueInputOption: "USER_ENTERED", data },
  });
}

/**
 * Delete every data row where `matchColumn` equals `matchValue`.
 * The header row is never a candidate — column headers can collide with values
 * (Checklist column B holds "RefCode" both as a header and as data).
 * Returns how many rows were removed (0 when nothing matched).
 */
export async function deleteRows(
  sheetTab: string,
  matchColumn: string,
  matchValue: string,
): Promise<number> {
  const rows = await getRows(sheetTab);
  const matchIndex = columnToIndex(matchColumn);
  const targets: number[] = [];
  rows.forEach((row, i) => {
    if (i > 0 && (row[matchIndex] ?? "") === matchValue) targets.push(i);
  });
  if (targets.length === 0) return 0;

  const sheetId = await getSheetId(sheetTab);
  const sheets = await getClient();
  // Delete bottom-up so each removal leaves the earlier indices valid.
  const requests = targets
    .sort((a, b) => b - a)
    .map((index) => ({
      deleteDimension: {
        range: { sheetId, dimension: "ROWS", startIndex: index, endIndex: index + 1 },
      },
    }));
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: getSpreadsheetId(),
    requestBody: { requests },
  });
  return targets.length;
}

/** Resolve the numeric sheetId behind a tab title, or throw if the tab is missing. */
async function getSheetId(sheetTab: string): Promise<number> {
  const sheets = await getClient();
  const res = await sheets.spreadsheets.get({
    spreadsheetId: getSpreadsheetId(),
    fields: "sheets.properties(sheetId,title)",
  });
  const match = res.data.sheets?.find((s) => s.properties?.title === sheetTab);
  const id = match?.properties?.sheetId;
  if (id === null || id === undefined) {
    throw new Error(`No tab named "${sheetTab}" in the spreadsheet`);
  }
  return id;
}

/** Resolve the 1-based sheet row number for a match, or throw if not found. */
async function findRowNumber(
  sheetTab: string,
  matchColumn: string,
  matchValue: string,
): Promise<number> {
  const rows = await getRows(sheetTab);
  const matchIndex = columnToIndex(matchColumn);
  const rowIdx = rows.findIndex((row) => (row[matchIndex] ?? "") === matchValue);
  if (rowIdx === -1) {
    throw new Error(`No row in "${sheetTab}" where column ${matchColumn} = "${matchValue}"`);
  }
  // Sheets rows are 1-based.
  return rowIdx + 1;
}
