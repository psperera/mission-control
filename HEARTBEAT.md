# HEARTBEAT.md - Paul Perera's Mission Control

## Current System Status

**Last Updated:** 2026-02-05 01:26 GMT

### ✅ Core Services
| Service | Status | Endpoint |
|---------|--------|----------|
| Mission Control | ✅ Running | http://localhost:3000 |
| Cloudflare Tunnel | ✅ Active | https://openclaw.hyflux.net |
| OpenClaw Gateway | ✅ Connected | ws://127.0.0.1:18789 |
| Telegram Bot | ✅ Connected | @pereraps |

### 🎯 Active Missions

**ESAB-Eddyfi Competitive Analysis**
- **Progress:** 13% (Phase 1 of 4 in progress)
- **Location:** ~/openclaw/missions/esab-eddyfi-waygate-2026/
- **Priority:** URGENT
- **Next:** Complete acquisition analysis research

## Heartbeat Checklist

### Step 1: Check INBOX Tasks
```bash
curl -s "http://localhost:3000/api/tasks?status=inbox"
```
**Action Required:**
- [ ] ESAB-Eddyfi analysis (URGENT) - Assign to Orchi if not started
- [ ] Dashboard layout design (LOW) - Can defer

### Step 2: Check TESTING Tasks (Auto-Test)
```bash
curl -s "http://localhost:3000/api/tasks?status=testing"
```
**Current:**
- [ ] "Set up development environment" - Ready for test

**To test:**
```bash
curl -X POST "http://localhost:3000/api/tasks/{TASK_ID}/test"
```

### Step 3: Check IN_PROGRESS Tasks
```bash
curl -s "http://localhost:3000/api/tasks?status=in_progress"
```
**Current:**
- [ ] Hybrid Synchronous Partial Superconducting Motor (Orchi)
- [ ] Book Repository (Librarian)
- [ ] Technical Paper Review (Scholar)
- [ ] Competitor Website Analysis (Scout)
- [ ] Telegram Dispatch Test (Chip)
- [ ] Project Documentation (Chip)

### Step 4: Check Agent Connections
```bash
curl -s "http://localhost:3000/api/agents"
```
**Working Agents (3):**
- 🦞 Chip (Team Lead) - standby
- 💻 Orchi (Research) - working
- 📖 Librarian (Books) - working
- 📚 Scholar (Papers) - working
- 🔍 Scout (Competitors) - working

**Standby Agents (4):**
- 🎨 Designer
- 💻 Developer
- 🔍 Researcher
- ✍️ Writer

### Step 5: Check Mission Progress
```bash
curl -s "http://localhost:3000/api/missions"
```
**ESAB-Eddyfi Mission:**
- Phase 1 (Research): 🟡 In Progress
- Phase 2 (Analysis): ⚪ Pending
- Phase 3 (Synthesis): ⚪ Pending
- Phase 4 (Outputs): ⚪ Pending

## API Integration Points

### Frontend → Backend APIs

| Feature | API Endpoint | Status |
|---------|--------------|--------|
| Task Queue | GET /api/tasks | ✅ Working |
| Agent List | GET /api/agents | ✅ Working |
| Chat Messages | POST /api/openclaw/sessions/{id} | ✅ Working |
| Mission Progress | GET /api/missions | ✅ Working |
| File Download | GET /api/missions/{id}/download | ✅ Working |
| Auto-Testing | POST /api/tasks/{id}/test | ✅ Working |

### WebSocket Events
- Real-time task updates via SSE
- Agent status changes
- Mission progress updates

## Testing Workflow

### For Tasks with Deliverables:
1. **Agent completes work** → Marks task TESTING
2. **Auto-test runs** → Checks HTML/CSS/JS
3. **Pass** → Moves to REVIEW
4. **Fail** → Returns to ASSIGNED for fixes

### Test Command:
```bash
curl -X POST "http://localhost:3000/api/tasks/{TASK_ID}/test" \
  -H "Content-Type: application/json"
```

### Test Results:
- Console error detection
- CSS syntax validation
- Resource loading checks
- Screenshots captured

## Chat Integration Test

**Working Flow Confirmed:**
```
Mission Control (Browser) 
  → Open Chat → Type Message
  → API /api/openclaw/sessions/{id}
  → OpenClaw Gateway (ws://127.0.0.1:18789)
  → Telegram (@pereraps)
  ✅ Delivered successfully
```

## Before Saying HEARTBEAT_OK

Verify:
- [ ] No CRITICAL/URGENT inbox tasks unassigned
- [ ] All testing tasks have been processed
- [ ] Working agents have active tasks
- [ ] Mission progress is being tracked
- [ ] No gateway errors in logs
- [ ] Cloudflare tunnel is healthy

## Common Actions

### Move Task to Testing:
```bash
curl -X PATCH "http://localhost:3000/api/tasks/{id}" \
  -H "Content-Type: application/json" \
  -d '{"status": "testing"}'
```

### Register Deliverable:
```bash
curl -X POST "http://localhost:3000/api/tasks/{id}/deliverables" \
  -H "Content-Type: application/json" \
  -d '{
    "deliverable_type": "file",
    "title": "Executive Brief",
    "path": "/Users/paulperera/openclaw/missions/esab-eddyfi-waygate-2026/03-deliverables/executive-brief.md"
  }'
```

### Log Activity:
```bash
curl -X POST "http://localhost:3000/api/tasks/{id}/activities" \
  -H "Content-Type: application/json" \
  -d '{
    "activity_type": "completed",
    "message": "Phase 1 research completed"
  }'
```

## Emergency Contacts

- **Mission Control Local:** http://localhost:3000
- **Mission Control Remote:** https://openclaw.hyflux.net
- **Gateway:** ws://127.0.0.1:18789
- **Mission Files:** ~/openclaw/missions/

---
*This heartbeat runs every 15 minutes via cron*
