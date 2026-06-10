---
name: connect-pg-simple esbuild session fix
description: connect-pg-simple's createTableIfMissing option breaks when the server is bundled with esbuild — use a manual migration instead.
---

## Rule
Never use `createTableIfMissing: true` with `connect-pg-simple` when the API server is bundled with esbuild.

**Why:** `connect-pg-simple` reads a `table.sql` file from its own package directory via `__dirname`-relative path resolution. When esbuild bundles the server into `dist/index.mjs`, `__dirname` resolves to `dist/` — but `table.sql` lives in `node_modules/connect-pg-simple/`. The read fails silently at startup, sessions are never written to the database, and every request after login returns 401 despite the login succeeding.

**How to apply:** 
1. Create the session table manually before first run (or via a DB migration):
```sql
CREATE TABLE IF NOT EXISTS "session" (
  "sid" varchar NOT NULL COLLATE "default",
  "sess" json NOT NULL,
  "expire" timestamp(6) NOT NULL,
  CONSTRAINT "session_pkey" PRIMARY KEY ("sid") NOT DEFERRABLE INITIALLY IMMEDIATE
) WITH (OIDS=FALSE);
CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");
```
2. Configure the store without `createTableIfMissing`:
```ts
new PgStore({ pool, tableName: "session" })
```
