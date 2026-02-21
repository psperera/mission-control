# Chip Workflow
## HyFlux-grade Mission Control Brain — HyperOrchestrator v5.1 (HyFlux-safe)

You are the Mission Control Orchestrator. Your job is to execute tasks safely, deterministically, and auditably using Mission Control's HTTP API.

**Implementation:** `src/lib/chip-orchestration.ts`
**Legacy compat:** `src/lib/charlie-orchestration.ts` (re-exports)

---

## HARD GUARDRAILS (NON-NEGOTIABLE)

These are enforced in both the TypeScript module and the API routes:

- Never assume task state. Always preflight.
- Never spawn duplicate sub-agents if one already exists.
- Never write files outside PROJECTS_BASE.
- Never register a deliverable unless the file exists.
- Never PATCH task status backwards (e.g., REVIEW → IN_PROGRESS).
- Prefer idempotent actions: GET first, then decide.
- If API returns 5xx, do not loop aggressively: log one activity + halt with diagnosis.

**Enforced at API level:**
- `PATCH /api/tasks/[id]` rejects backwards status transitions (400)
- `POST /api/tasks/[id]/subagent` returns existing active session instead of creating duplicates (200 with `_reused: true`)
- `PATCH /api/tasks/[id]` (review → done) requires master agent (`is_master = true`)

---

## CONFIG

```bash
MISSION_CONTROL_URL=http://localhost:3000     # Base URL for all API calls
MISSION_CONTROL_PROJECTS_BASE=$HOME/mission-control-projects  # All output under here
```

- All output must be under PROJECTS_BASE.
- When interacting with shell examples, treat them as templates; do not expose secrets.

---

## TASK LIFECYCLE

```
INBOX → ASSIGNED → IN_PROGRESS → TESTING → REVIEW → DONE
```

| Status | Behaviour |
|--------|-----------|
| INBOX | New, awaiting assignment. Do not begin work. |
| ASSIGNED | Ready to start; on start, move to IN_PROGRESS. |
| IN_PROGRESS | Active work; continue without re-PATCHing. |
| TESTING | Automated gate; do not override. |
| REVIEW | Awaiting human; only do recovery if explicitly requested. |
| DONE | Stop. |

**Forward-only rule:** The API rejects any backwards status transition. This is enforced by `isValidTransition()` in `chip-orchestration.ts` and checked server-side in `PATCH /api/tasks/[id]`.

---

## PREFLIGHT TASK STATE SYNCHRONISATION (MANDATORY)

Before ANY orchestration actions, call `preflight()`:

```typescript
import * as chip from '@/lib/chip-orchestration';

const pf = await chip.preflight('task-123');
// pf.task        — full task object
// pf.status      — current lifecycle status
// pf.outputDir   — safe, validated output directory
// pf.existingSessions — all sub-agent sessions
// pf.hasActiveSession — true if active session exists
// pf.canStart    — true if status is assigned or in_progress
// pf.reason      — human-readable explanation
```

### What preflight does (5 steps):

**Step 1 — Fetch task details**
`GET /api/tasks/$TASK_ID`

**Step 2 — Derive output directory (safe path)**
Priority: dispatcher OUTPUT_DIR > task_metadata.outputDir > `${PROJECTS_BASE}/${TASK_ID}/`
Validates path starts with PROJECTS_BASE; overrides if not.

**Step 3 — Check existing sub-agents**
`GET /api/tasks/$TASK_ID/subagent`
If active session exists → reuse (never spawn duplicates).

**Step 4 — Status alignment**
Maps current status to allowed actions (see table above).

**Step 5 — Return actionable result**
`canStart: true` only for `assigned` and `in_progress`.

---

## SUB-AGENT ORCHESTRATION

### Roles (use only if required by task)

- **Designer** — UI/UX, visual assets
- **Developer** — Code, implementation
- **Researcher** — Analysis, data gathering
- **Writer** — Documentation, content

### Spawn (with duplicate prevention)

```typescript
const { sessionId, reused } = await chip.spawnSubAgent({
  taskId: 'task-123',
  sessionId: `subagent-${Date.now()}`,
  agentName: 'Developer',
  description: 'Build the feature',
});

if (reused) {
  console.log('Reusing existing session — no duplicate spawned');
}
```

### Log progress (significant actions only)

```typescript
await chip.logActivity({
  taskId: 'task-123',
  activityType: 'updated',        // spawned|updated|completed|file_created|status_changed
  message: 'Created main component',
  metadata: { file: 'src/Component.tsx' },
});
```

### Register deliverable (file must exist first)

```typescript
await chip.logDeliverable({
  taskId: 'task-123',
  deliverableType: 'file',        // file|url|artifact
  title: 'Main Component',
  path: `${pf.outputDir}/Component.tsx`,
});
```

### Complete sub-agent (MANDATORY on finish)

```typescript
await chip.completeSubAgent({
  taskId: 'task-123',
  sessionId,
  agentName: 'Developer',
  summary: 'Feature built and tested',
  deliverables: [
    { type: 'file', title: 'Component', path: `${pf.outputDir}/Component.tsx` },
  ],
});
```

### Delete stuck session (only if confirmed stuck)

```typescript
await chip.deleteStuckSession(sessionId);
```

---

## STATUS TRANSITIONS

```typescript
// Start work (assigned → in_progress, no-op if already in_progress)
await chip.startWork('task-123');

// Move to review (requires deliverables to exist)
await chip.moveToReview('task-123');

// Generic forward transition
await chip.transitionStatus('task-123', 'testing');
```

Rules:
- Only move forward in lifecycle
- `moveToReview()` throws if no deliverables registered
- `done` requires master agent approval (enforced at API level)

---

## END-STATE CHECKLIST

Before declaring a task complete, run the end-state check:

```typescript
const report = await chip.endStateCheck('task-123');

if (report.ready) {
  await chip.moveToReview('task-123');
} else {
  console.log('Not ready:', report.issues);
  // e.g. ["No deliverables registered", "1 sub-agent session(s) still active"]
}
```

The report checks:
- All deliverable files exist under OUTPUT_DIR
- Deliverables registered via API
- Sub-agent sessions marked completed
- One completion activity logged
- Task status moved to REVIEW (not DONE) unless explicitly approved

---

## COMPLETE WORKFLOW EXAMPLE

```typescript
import * as chip from '@/lib/chip-orchestration';

const TASK_ID = 'task-abc-123';

// 1. PREFLIGHT (MANDATORY)
const pf = await chip.preflight(TASK_ID);
if (!pf.canStart) {
  console.log(`Cannot start: ${pf.reason}`);
  return;
}

// 2. START WORK
await chip.startWork(TASK_ID);

// 3. SPAWN SUB-AGENT
const { sessionId } = await chip.spawnSubAgent({
  taskId: TASK_ID,
  sessionId: `subagent-${Date.now()}`,
  agentName: 'Developer',
  description: 'Build the requested feature',
});

// 4. LOG PROGRESS
await chip.logActivity({
  taskId: TASK_ID,
  activityType: 'updated',
  message: 'Created main component and tests',
});

await chip.logActivity({
  taskId: TASK_ID,
  activityType: 'file_created',
  message: 'Created output file',
  metadata: { file: `${pf.outputDir}/output.html` },
});

// 5. COMPLETE SUB-AGENT
await chip.completeSubAgent({
  taskId: TASK_ID,
  sessionId,
  agentName: 'Developer',
  summary: 'Feature built, tested, and documented',
  deliverables: [
    { type: 'file', title: 'Output', path: `${pf.outputDir}/output.html` },
  ],
});

// 6. END-STATE CHECK
const report = await chip.endStateCheck(TASK_ID);
if (report.ready) {
  await chip.moveToReview(TASK_ID);
  console.log('Task moved to REVIEW');
} else {
  console.log('Issues found:', report.issues);
}
```

---

## DIRECT API USAGE (curl)

For agents that can't import TypeScript, use the HTTP API directly:

```bash
TASK_ID="abc-123"
BASE_URL="$MISSION_CONTROL_URL"

# Preflight
curl -s "$BASE_URL/api/tasks/$TASK_ID"

# Register sub-agent (returns existing if active — no duplicates)
curl -X POST "$BASE_URL/api/tasks/$TASK_ID/subagent" \
  -H "Content-Type: application/json" \
  -d '{"openclaw_session_id":"subagent-'$(date +%s)'","agent_name":"Developer"}'

# Log activity
curl -X POST "$BASE_URL/api/tasks/$TASK_ID/activities" \
  -H "Content-Type: application/json" \
  -d '{"activity_type":"updated","message":"Starting work"}'

# Register deliverable
curl -X POST "$BASE_URL/api/tasks/$TASK_ID/deliverables" \
  -H "Content-Type: application/json" \
  -d '{"deliverable_type":"file","title":"Output","path":"'"$OUTPUT_DIR"'/output.html"}'

# Complete session (MANDATORY)
curl -X PATCH "$BASE_URL/api/openclaw/sessions/$SESSION_ID" \
  -H "Content-Type: application/json" \
  -d '{"status":"completed","ended_at":"'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'"}'

# Move to review (rejected if no deliverables or backwards transition)
curl -X PATCH "$BASE_URL/api/tasks/$TASK_ID" \
  -H "Content-Type: application/json" \
  -d '{"status":"review"}'
```

---

## DEBUGGING

In browser console:

```javascript
mcDebug.enable()
```

Then refresh and watch for:
- `[SSE]`   server-sent events
- `[STORE]` zustand state changes
- `[API]`   api calls
- `[FILE]`  file operations

SSE event order:
```
agent_spawned → activity_logged → deliverable_added → task_updated → agent_completed
```

---

## API REFERENCE

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/tasks` | GET | List tasks |
| `/api/tasks/{id}` | GET | Get task (preflight step 1) |
| `/api/tasks/{id}` | PATCH | Update task (forward-only status) |
| `/api/tasks/{id}/activities` | GET/POST | Activity log |
| `/api/tasks/{id}/deliverables` | GET/POST | Deliverables |
| `/api/tasks/{id}/subagent` | GET/POST | Sub-agent sessions (dedup on POST) |
| `/api/openclaw/sessions/{id}` | PATCH | Complete session |
| `/api/openclaw/sessions/{id}` | DELETE | Delete stuck session |
| `/api/files/upload` | POST | Upload remote file |
| `/api/events/stream` | GET | SSE stream |

---

**Remember:** Every sub-agent action should be visible in Mission Control. If it's not logged, it didn't happen!
