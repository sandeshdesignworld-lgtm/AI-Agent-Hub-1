---
name: Bolna integration pattern
description: How the Campus Concierge Bolna voice-call integration is structured across backend and frontend.
---

## Rule
Campus Concierge agent uses Bolna AI for outbound voice calls. The pattern is:
- `POST /api/agents/campus-concierge/trigger` — auth-protected, validates phone, prepends +91 if no +, calls `https://api.bolna.ai/call`
- `GET /api/bolna/call-status/:executionId` — proxies Bolna executions API, merges with in-memory webhook cache
- `POST /api/bolna/webhook` — stores webhook payloads keyed by execution_id in a `Map<string, Record>` (in-memory, resets on restart)
- Frontend polls call-status every 3s, stops on completed/failed
- Bolna status strings → UI states: queued/scheduled/initiated → ringing, in_progress → in-progress, completed/call_completed → completed, failed/error/no_answer/busy → failed

**Why:** Bolna's call status may arrive via webhook before the API is queryable; merging both sources gives the freshest status.

**How to apply:** If you add another Bolna agent, reuse bolnaRouter (already registered in index.ts). Only `campus-concierge/trigger` route is needed per agent; the status/webhook routes are shared.

## Environment variables
`BOLNA_API_KEY` and `BOLNA_AGENT_ID` — set in Replit Secrets. Never hardcode.
