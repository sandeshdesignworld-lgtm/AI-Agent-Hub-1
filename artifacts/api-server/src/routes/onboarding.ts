import { Router, type IRouter } from "express";
import { getRows, appendRow, updateMultipleCells, deleteRows } from "../lib/sheets";

const router: IRouter = Router();

/* ── Tab names ── */
const CANDIDATES_TAB = "Candidates";
const CHECKLIST_TAB = "Checklist";
const DOCUMENTS_TAB = "Documents";

/* ── Column layouts (header order = sheet column order) ── */
const CANDIDATE_HEADERS = [
  "RefCode", "Name", "Email", "DOB", "Position", "CreatedAt", "FolderID",
  "FolderURL", "CurrentStage", "DocCheckApproval", "MedicalDate", "MedicalTime",
  "MedicalAddress", "MedicalStatus", "TrainingComplete", "AllocatedBranch",
  "BranchPOC", "BranchPOCContact",
] as const;

const CHECKLIST_HEADERS = [
  "Key", "RefCode", "DocType", "DisplayName", "Status", "Verdict",
  "IssueText", "SubmittedDate",
] as const;

const DOCUMENT_HEADERS = [
  "RefCode", "DocType", "ExtractedName", "ExtractedDOB", "Confidence",
  "FileName", "Verdict", "IssueText", "Timestamp",
] as const;

/** Map raw sheet rows (excluding the header row) to keyed objects. */
function rowsToObjects(rows: string[][], headers: readonly string[]): Record<string, string>[] {
  if (rows.length <= 1) return [];
  return rows.slice(1).map((row) => {
    const obj: Record<string, string> = {};
    headers.forEach((header, i) => {
      obj[header] = row[i] ?? "";
    });
    return obj;
  });
}

/** Turn an unknown thrown value into a readable message. */
function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/* ══════════════════════════════════════════════════════
   Reads
══════════════════════════════════════════════════════ */

/* ── GET /onboarding/candidates ── */
router.get("/onboarding/candidates", async (_req, res): Promise<void> => {
  try {
    const rows = await getRows(CANDIDATES_TAB);
    res.json(rowsToObjects(rows, CANDIDATE_HEADERS));
  } catch (e) {
    console.error("[Onboarding] candidates read error:", errMsg(e));
    res.status(502).json({ error: errMsg(e) });
  }
});

/* ── GET /onboarding/checklist/:refCode ── */
router.get("/onboarding/checklist/:refCode", async (req, res): Promise<void> => {
  const { refCode } = req.params;
  try {
    const rows = await getRows(CHECKLIST_TAB);
    const items = rowsToObjects(rows, CHECKLIST_HEADERS).filter(
      (item) => item.RefCode === refCode,
    );
    res.json(items);
  } catch (e) {
    console.error("[Onboarding] checklist read error:", errMsg(e));
    res.status(502).json({ error: errMsg(e) });
  }
});

/* ── GET /onboarding/documents/:refCode ── */
router.get("/onboarding/documents/:refCode", async (req, res): Promise<void> => {
  const { refCode } = req.params;
  try {
    const rows = await getRows(DOCUMENTS_TAB);
    const docs = rowsToObjects(rows, DOCUMENT_HEADERS).filter(
      (doc) => doc.RefCode === refCode,
    );
    res.json(docs);
  } catch (e) {
    console.error("[Onboarding] documents read error:", errMsg(e));
    res.status(502).json({ error: errMsg(e) });
  }
});

/* ══════════════════════════════════════════════════════
   Writes
══════════════════════════════════════════════════════ */

/** Build the next RefCode from the highest existing sequence number. */
function nextRefCode(rows: string[][]): string {
  let max = 0;
  for (const row of rows.slice(1)) {
    const ref = row[0] ?? "";
    const m = ref.match(/(\d+)\s*$/);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  const seq = String(max + 1).padStart(5, "0");
  return `IDBI/JAM/2026/${seq}`;
}

/* ── POST /onboarding/candidates ── */
router.post("/onboarding/candidates", async (req, res): Promise<void> => {
  const body = req.body as {
    refCode?: string;
    name?: string;
    email?: string;
    dob?: string;
    position?: string;
  };

  const name = body.name?.trim();
  const email = body.email?.trim();
  const dob = body.dob?.trim();
  const position = body.position?.trim();

  if (!name || !email || !dob || !position) {
    res.status(400).json({ error: "name, email, dob and position are required" });
    return;
  }

  try {
    const rows = await getRows(CANDIDATES_TAB);
    const refCode = body.refCode?.trim() || nextRefCode(rows);
    const createdAt = new Date().toISOString();

    // Columns A–F; CurrentStage (I) is left blank for WF-1 to populate.
    await appendRow(CANDIDATES_TAB, [refCode, name, email, dob, position, createdAt]);

    res.status(201).json({ refCode, name, email, dob, position, createdAt });
  } catch (e) {
    console.error("[Onboarding] add candidate error:", errMsg(e));
    res.status(502).json({ error: errMsg(e) });
  }
});

/* ── PATCH /onboarding/candidates/:refCode/approve-docs ── */
router.patch("/onboarding/candidates/:refCode/approve-docs", async (req, res): Promise<void> => {
  const { refCode } = req.params;
  const { medicalDate, medicalTime, medicalAddress } = req.body as {
    medicalDate?: string;
    medicalTime?: string;
    medicalAddress?: string;
  };

  if (!medicalDate || !medicalTime || !medicalAddress) {
    res.status(400).json({ error: "medicalDate, medicalTime and medicalAddress are required" });
    return;
  }

  try {
    await updateMultipleCells(CANDIDATES_TAB, "A", refCode, {
      J: "Approved",        // DocCheckApproval
      K: medicalDate,       // MedicalDate
      L: medicalTime,       // MedicalTime
      M: medicalAddress,    // MedicalAddress
    });
    res.json({ ok: true, refCode });
  } catch (e) {
    console.error("[Onboarding] approve-docs error:", errMsg(e));
    res.status(502).json({ error: errMsg(e) });
  }
});

/* ── PATCH /onboarding/candidates/:refCode/medical-result ── */
router.patch("/onboarding/candidates/:refCode/medical-result", async (req, res): Promise<void> => {
  const { refCode } = req.params;
  const { status } = req.body as { status?: string };

  if (status !== "Fit" && status !== "Unfit") {
    res.status(400).json({ error: "status must be 'Fit' or 'Unfit'" });
    return;
  }

  try {
    await updateMultipleCells(CANDIDATES_TAB, "A", refCode, {
      N: status, // MedicalStatus
    });
    res.json({ ok: true, refCode });
  } catch (e) {
    console.error("[Onboarding] medical-result error:", errMsg(e));
    res.status(502).json({ error: errMsg(e) });
  }
});

/* ── PATCH /onboarding/candidates/:refCode/allocate-branch ── */
router.patch("/onboarding/candidates/:refCode/allocate-branch", async (req, res): Promise<void> => {
  const { refCode } = req.params;
  const { branch, poc, pocContact } = req.body as {
    branch?: string;
    poc?: string;
    pocContact?: string;
  };

  if (!branch || !poc || !pocContact) {
    res.status(400).json({ error: "branch, poc and pocContact are required" });
    return;
  }

  try {
    await updateMultipleCells(CANDIDATES_TAB, "A", refCode, {
      O: "Yes",         // TrainingComplete
      P: branch,        // AllocatedBranch
      Q: poc,           // BranchPOC
      R: pocContact,    // BranchPOCContact
    });
    res.json({ ok: true, refCode });
  } catch (e) {
    console.error("[Onboarding] allocate-branch error:", errMsg(e));
    res.status(502).json({ error: errMsg(e) });
  }
});

/* ── DELETE /onboarding/candidates/:refCode ── */
router.delete("/onboarding/candidates/:refCode", async (req, res): Promise<void> => {
  const { refCode } = req.params;

  try {
    // Candidates: RefCode is column A. Checklist: RefCode is column B.
    const removed = await deleteRows(CANDIDATES_TAB, "A", refCode);
    if (removed === 0) {
      res.status(404).json({ error: `No candidate with RefCode "${refCode}"` });
      return;
    }
    const checklistRemoved = await deleteRows(CHECKLIST_TAB, "B", refCode);

    res.json({ ok: true, refCode, removed, checklistRemoved });
  } catch (e) {
    console.error("[Onboarding] delete candidate error:", errMsg(e));
    res.status(502).json({ error: errMsg(e) });
  }
});

export default router;
