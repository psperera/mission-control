# Mission Control Orchestration Guide (HyFlux Edition — v5.1 Final, HyFlux-Safe)

This is the **final production-ready orchestration guide** incorporating:

- Preflight synchronisation
- Lifecycle rules
- Session completion safety
- Remote + local file handling
- Debug observability
- HyFlux v5.1 safety patch (no hard-coded user paths)

This version replaces earlier examples using `/Users/chris/...` with a portable environment variable.

---

# Environment Configuration (HyFlux-Safe v5.1)

## Required Environment Variables

```bash
MISSION_CONTROL_URL=http://localhost:3000
MISSION_CONTROL_PROJECTS_DIR=/Users/paulperera/.openclaw/projects

The orchestrator MUST derive all filesystem paths from:

${MISSION_CONTROL_PROJECTS_DIR}

Never hardcode usernames or absolute personal paths.

⸻

Task Lifecycle

INBOX → ASSIGNED → IN_PROGRESS → TESTING → REVIEW → DONE

Status Descriptions

INBOX — New tasks awaiting processing
ASSIGNED — Task assigned to an agent
IN_PROGRESS — Agent actively working
TESTING — Automated quality gate
REVIEW — Awaiting human approval
DONE — Completed and approved

Lifecycle Rules
	•	Agents must NOT skip states.
	•	Move to IN_PROGRESS only when execution begins.
	•	Move to REVIEW only after deliverables exist.
	•	TESTING is automated — do not force unless instructed.
	•	Never modify tasks already in DONE.

⸻

When You Receive a Task

A dispatched task includes:
	•	TASK_ID
	•	Optional OUTPUT_DIR
	•	API endpoints

⸻

PRE-FLIGHT TASK STATE SYNCHRONISATION (MANDATORY)

Before ANY orchestration actions:

Step 1 — Fetch Task

curl -X GET "$MISSION_CONTROL_URL/api/tasks/$TASK_ID"

Store internally:
	•	task_status_current
	•	task_metadata

⸻

Step 2 — Derive OUTPUT_DIR

Priority order:
	1.	Dispatcher OUTPUT_DIR
	2.	task_metadata.outputDir
	3.	Default:

OUTPUT_DIR="${MISSION_CONTROL_PROJECTS_DIR}/${TASK_ID}/"

Never write outside ${MISSION_CONTROL_PROJECTS_DIR}.

⸻

Step 3 — Check Existing Subagents

curl -X GET "$MISSION_CONTROL_URL/api/tasks/$TASK_ID/subagent"

If active session exists → reuse
If none exist → spawn new

⸻

Step 4 — Status Alignment

Status	Behaviour
INBOX	wait
ASSIGNED	patch → IN_PROGRESS
IN_PROGRESS	continue
TESTING	heartbeat only
REVIEW	no new deliverables
DONE	halt


⸻

Optional Debug Preflight Log

{
  "activity_type": "updated",
  "message": "Preflight sync complete",
  "metadata": {
    "status": "task_status_current",
    "outputDir": "OUTPUT_DIR"
  }
}


⸻

Required API Calls

0 — Preflight Sync

curl -X GET "$MISSION_CONTROL_URL/api/tasks/$TASK_ID"


⸻

1 — Register Sub-Agent

curl -X POST "$MISSION_CONTROL_URL/api/tasks/$TASK_ID/subagent" \
  -H "Content-Type: application/json" \
  -d '{
    "openclaw_session_id":"subagent-'$(date +%s)'",
    "agent_name":"Developer"
  }'


⸻

2 — Log Activity

curl -X POST "$MISSION_CONTROL_URL/api/tasks/$TASK_ID/activities" \
  -H "Content-Type: application/json" \
  -d '{"activity_type":"updated","message":"Starting work"}'

Activity Types:
	•	spawned
	•	updated
	•	completed
	•	file_created
	•	status_changed

⸻

3 — Create File (LOCAL MODE)

mkdir -p "$OUTPUT_DIR"
echo "<html><body>Hello</body></html>" > "$OUTPUT_DIR/output.html"


⸻

4 — Register Deliverable

curl -X POST "$MISSION_CONTROL_URL/api/tasks/$TASK_ID/deliverables" \
  -H "Content-Type: application/json" \
  -d '{
    "deliverable_type":"file",
    "title":"Output",
    "path":"'"$OUTPUT_DIR"'/output.html"
  }'

If warning returned → fix file path.

Deliverable Types:
	•	file
	•	url
	•	artifact

⸻

Remote Agent File Handling

If filesystem unavailable:

POST /api/files/upload

Files will be saved at:

${MISSION_CONTROL_PROJECTS_DIR}/{relativePath}

Register deliverable AFTER upload.

⸻

Complete Example Workflow (HyFlux v5.1)

TASK_ID="abc-123"
BASE_URL="$MISSION_CONTROL_URL"
OUTPUT_DIR="${MISSION_CONTROL_PROJECTS_DIR}/${TASK_ID}/"

1 — Preflight

curl -X GET $BASE_URL/api/tasks/$TASK_ID

2 — Log Start

curl -X POST $BASE_URL/api/tasks/$TASK_ID/activities \
  -H "Content-Type: application/json" \
  -d '{"activity_type":"updated","message":"Starting work"}'

3 — Spawn Sub-Agent

curl -X POST $BASE_URL/api/tasks/$TASK_ID/subagent \
  -H "Content-Type: application/json" \
  -d '{"openclaw_session_id":"subagent-'$(date +%s)'","agent_name":"Developer"}'

4 — Create File

mkdir -p "$OUTPUT_DIR"
echo "<html>Hello World</html>" > "$OUTPUT_DIR/output.html"

5 — Register Deliverable

curl -X POST $BASE_URL/api/tasks/$TASK_ID/deliverables \
  -H "Content-Type: application/json" \
  -d '{"deliverable_type":"file","title":"Output","path":"'"$OUTPUT_DIR"'/output.html"}'

6 — Log Completion

curl -X POST $BASE_URL/api/tasks/$TASK_ID/activities \
  -H "Content-Type: application/json" \
  -d '{"activity_type":"completed","message":"Work completed"}'

7 — Move to Review

curl -X PATCH $BASE_URL/api/tasks/$TASK_ID \
  -H "Content-Type: application/json" \
  -d '{"status":"review"}'

8 — Complete Session (REQUIRED)

curl -X PATCH $BASE_URL/api/openclaw/sessions/{SESSION_ID} \
  -H "Content-Type: application/json" \
  -d '{"status":"completed","ended_at":"'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'"}'

This emits agent_completed.

⸻

Debugging

Enable:

mcDebug.enable()

Watch:
	•	[SSE]
	•	[STORE]
	•	[API]
	•	[FILE]

Typical event order:

agent_spawned → activity_logged → deliverable_added → task_updated → agent_completed


⸻

Endpoints Reference

Endpoint	Method	Purpose
/api/tasks	GET	List tasks
/api/tasks/{id}	GET	Get task
/api/tasks/{id}	PATCH	Update task
/api/tasks/{id}/activities	POST	Log activity
/api/tasks/{id}/deliverables	POST	Add deliverable
/api/tasks/{id}/subagent	POST	Register sub-agent
/api/openclaw/sessions/{id}	PATCH	Complete session
/api/openclaw/sessions/{id}	DELETE	Delete session
/api/files/upload	POST	Upload remote file
/api/files/preview	GET	Preview HTML
/api/files/reveal	POST	Reveal file


⸻

Activity Body Schema

{
  "activity_type":"spawned|updated|completed|file_created|status_changed",
  "message":"description",
  "agent_id":"optional",
  "metadata":{}
}


⸻

Deliverable Body Schema

{
  "deliverable_type":"file|url|artifact",
  "title":"Display name",
  "path":"/absolute/path",
  "description":"optional"
}


⸻

Sub-Agent Body Schema

{
  "openclaw_session_id":"unique-session-id",
  "agent_name":"Designer|Developer|Researcher|Writer"
}


⸻

SSE Events

Broadcast to all clients:
	•	task_created
	•	task_updated
	•	activity_logged
	•	deliverable_added
	•	agent_spawned
	•	agent_completed

⸻

HyFlux v5.1 Patch Summary

This final version:

✔ Removes hard-coded usernames
✔ Uses ${MISSION_CONTROL_PROJECTS_DIR} everywhere
✔ Supports local + remote agents
✔ Aligns with HyperOrchestrator v5 architecture
✔ Keeps debugging clean under mcDebug.enable()

