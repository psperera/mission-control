# Mission Control 🦞

**OpenClaw Agent Orchestration System**

AI Agent Orchestration Dashboard for OpenClaw - A comprehensive framework for designing, coordinating, and executing multi-agent workflows with AI agents.

![Mission Control Dashboard](docs/images/mission_control.png)

*Dashboard showing active agents working on research tasks with Kanban mission queue (INBOX → ASSIGNED → IN PROGRESS → TESTING → REVIEW → DONE) and real-time Live Feed.*

---

## 🎯 What is Mission Control?

Mission Control is a production-grade system for orchestrating multi-agent AI workflows. It provides:

- **Visual Mission Management**: Kanban-style task board with drag-and-drop workflow
- **Agent Specialization**: Pre-configured agents for research, analysis, writing, and validation
- **Automated Dispatch**: Tasks automatically route to agents via Telegram or webchat
- **Quality Assurance**: Built-in Research Integrity Guard validates deliverables
- **Real-time Monitoring**: Live feed of all agent activities and events
- **Deliverable Management**: Track and distribute mission outputs

---

## 📦 What's Included

| Component | Description |
|-----------|-------------|
| `src/app/` | Next.js application (dashboard, API routes, components) |
| `src/components/` | React components (MissionQueue, AgentsSidebar, ChatPanel, LiveFeed) |
| `src/lib/` | Core libraries (OpenClaw client, database, types) |
| `scripts/` | Utility scripts (email delivery, database migration) |
| `docs/` | Documentation and guides |
| `agent_prompts.json` | Agent personality and prompt templates |
| `README.md` | This documentation |

---

## 🚀 Quick Start

### Prerequisites

- **Node.js 20+** - Required for Next.js
- **OpenClaw** - AI agent framework ([github.com/openclaw/openclaw](https://github.com/openclaw/openclaw))
- **npm or pnpm** - Package manager
- **SQLite** - Database (included)

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/psperera/mission-control.git
cd mission-control

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env.local
# Edit .env.local with your settings (see Configuration below)

# 4. Initialize database
npm run db:migrate
npm run db:seed

# 5. Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to access Mission Control.

---

## 🧙 Mission Wizard

New to multi-agent workflows? Use the **Mission Wizard** to guide you through creating your first mission:

### Step 1: Define Your Objective

What do you want to achieve? Examples:
- "Analyze competitive landscape for new product launch"
- "Research market trends and customer needs"
- "Create technical documentation for a new feature"
- "Validate claims in a research paper"

### Step 2: Select Agent Team

Choose from pre-configured agents based on your mission type:

| Agent | Role | Best For |
|-------|------|----------|
| **Scout** | Competitor Research | Market analysis, competitive intelligence, threat assessment |
| **Researcher** | Market & Portfolio | Customer research, trend analysis, portfolio assessment |
| **Scholar** | Technical Validation | Patent review, technical verification, defensibility analysis |
| **Writer** | Documentation | Executive briefs, comparison tables, strategic recommendations |
| **Librarian** | Source Curation | Bibliography management, source indexing, research organization |
| **Chip** | Team Lead | Coordination, synthesis, final review, executive sign-off |

### Step 3: Configure Workflow

Choose your workflow pattern:

**Sequential** (Research → Analysis → Writing)
- Best for: Complex analysis requiring validation at each step
- Example: Competitive intelligence with technical verification

**Parallel** (Multiple agents work simultaneously)
- Best for: Independent research tasks
- Example: Multi-channel customer feedback analysis

**Hybrid** (Parallel research → Sequential synthesis)
- Best for: Large missions with multiple workstreams
- Example: ESAB-Eddyfi competitive analysis (6 agents, 4 phases)

### Step 4: Launch Mission

The Wizard automatically:
1. Creates tasks in the Mission Queue
2. Assigns agents based on capabilities
3. Sets up dependencies between tasks
4. Configures deliverable tracking

---

## 🎯 Core Concepts

### Agents

Agents are specialized AI entities with defined roles, capabilities, and personalities:

```typescript
// Agent configuration example
{
  "scout": {
    "name": "Scout",
    "role": "Competitor Research Analyst",
    "description": "Analyzes competitive landscape and threat vectors",
    "capabilities": ["market_research", "competitive_analysis", "threat_assessment"],
    "avatar_emoji": "🔍",
    "system_prompt": "You are Scout, a competitive intelligence expert..."
  }
}
```

**Key Agent Attributes:**
- **Role**: Primary function (e.g., Researcher, Analyst, Writer)
- **Capabilities**: Specific skills the agent can perform
- **System Prompt**: Personality and behavior definition
- **Avatar**: Visual representation in the dashboard

### Missions

A mission is a high-level objective broken down into multiple tasks:

```typescript
// Mission structure
{
  "mission_id": "esab_eddyfi_analysis",
  "name": "ESAB-Eddyfi Competitive Analysis",
  "objective": "Assess strategic implications of ESAB's acquisition of Eddyfi for Waygate",
  "phases": ["intelligence_gathering", "technical_validation", "synthesis", "review"],
  "status": "in_progress",
  "tasks": [...]
}
```

### Tasks

Tasks are individual units of work assigned to agents:

```typescript
// Task structure
{
  "task_id": "S1",
  "title": "Map ESAB acquisition history",
  "assigned_agent": "scout",
  "status": "completed",
  "priority": "high",
  "phase": "intelligence_gathering"
}
```

**Task States:**
- `inbox` → New task, not yet assigned
- `assigned` → Assigned to agent, awaiting dispatch
- `in_progress` → Agent actively working
- `testing` → Research Integrity Guard validation
- `review` → Awaiting approval (master agent only)
- `done` → Completed and approved

### The Automated Workflow

```
┌─────────────┐    ┌──────────────┐    ┌─────────────┐
│   ASSIGN    │───→│   DISPATCH   │───→│   WORKING   │
│   (You)     │    │  (System)    │    │   (Agent)   │
└─────────────┘    └──────────────┘    └──────┬──────┘
                                              │
                                              ▼
┌─────────────┐    ┌──────────────┐    ┌─────────────┐
│     DONE    │←───│    REVIEW    │←───│   TESTING   │
│  (Approved) │    │   (Master)   │    │   (System)  │
└─────────────┘    └──────────────┘    └─────────────┘
```

1. **You assign a task** → Drag task to agent in ASSIGNED column
2. **System auto-dispatches** → Task details sent to agent's OpenClaw session
3. **Agent works** → Task moves to IN PROGRESS, agent status becomes "working"
4. **Agent completes** → Agent replies `TASK_COMPLETE: [summary]`
5. **Auto-testing** → Research Integrity Guard validates deliverables
6. **Quality check** → If validation fails, task returns to IN PROGRESS
7. **Review** → If validation passes, task moves to REVIEW
8. **Master approves** → Master agent reviews, moves to DONE

---

## 📋 Complete Example: Competitive Analysis Mission

Based on the ESAB-Eddyfi competitive analysis mission:

### Phase 1: Intelligence Gathering (Parallel)

```typescript
// Scout tasks - Competitor Research
const scoutTasks = [
  {
    task_id: "S1",
    title: "Map ESAB acquisition history",
    agent: "scout",
    input: "Analyze ESAB's historical M&A behavior and integration patterns"
  },
  {
    task_id: "S2",
    title: "Analyze Eddyfi product portfolio",
    agent: "scout",
    input: "Map Eddyfi's complete tech stack: robotics, sensors, software, services"
  },
  {
    task_id: "S4",
    title: "Identify competitive threat vectors",
    agent: "scout",
    input: "Identify 5 critical threat vectors with revenue impact assessment"
  }
];

// Researcher tasks - Market Analysis
const researcherTasks = [
  {
    task_id: "R1",
    title: "Document Waygate portfolio",
    agent: "researcher",
    input: "Assess Waygate's portfolio across aerospace, defense, energy, infrastructure"
  },
  {
    task_id: "R3",
    title: "Software capabilities comparison",
    agent: "researcher",
    input: "Compare Waygate InspectionWorks vs Eddyfi Magnifi software platforms"
  }
];
```

### Phase 2: Technical Validation (Sequential)

```typescript
// Scholar tasks - Technical Review
const scholarTasks = [
  {
    task_id: "SC3",
    title: "Patent portfolio review",
    agent: "scholar",
    input: "Review patent portfolios for defensibility and moat assessment",
    dependencies: ["S6"] // Depends on patent analysis
  },
  {
    task_id: "SC4",
    title: "Defensibility analysis",
    agent: "scholar",
    input: "Assess which competitive advantages are technically defensible",
    dependencies: ["SC1", "SC2", "SC3"] // Depends on all validations
  }
];
```

### Phase 3: Synthesis

```typescript
// Writer tasks - Documentation
const writerTasks = [
  {
    task_id: "W2",
    title: "Executive Brief",
    agent: "writer",
    input: "Synthesize findings into 2-3 page Board/ELT-ready executive brief",
    dependencies: ["S1", "S2", "S3", "S4", "R1", "R2", "R3"]
  },
  {
    task_id: "W3",
    title: "Strategic Options Matrix",
    agent: "writer",
    input: "Create defend/counter/partner/acquire options matrix with pros/cons"
  }
];
```

### Phase 4: Integration

```typescript
// Chip (Team Lead) - Final Review
const chipTask = {
  task_id: "C1",
  title: "Final Strategic Brief",
  agent: "chip",
  input: "Review all outputs, validate strategic logic, prepare executive sign-off",
  dependencies: ["W2", "W3", "W4"]
};
```

---

## 🔬 Research Integrity Guard (Testing Phase)

The Research Integrity Guard validates outputs during the TESTING phase:

### What It Detects

| Issue | Description | Action |
|-------|-------------|--------|
| **AI Slop** | Generic filler phrases ("delve", "leverage", "paradigm") | Flag for rewrite |
| **Low Vocabulary Diversity** | Repetitive word usage | Suggest expansion |
| **Missing Citations** | Claims without sources | Request sources |
| **Content Quality** | Word count, structure, depth | Assess completeness |

### Auto-Rework Loop

When validation fails:
1. Task automatically returns to IN PROGRESS
2. Feedback provided to agent
3. Agent addresses issues
4. Re-submits for validation

```bash
# Manual validation trigger
curl -X POST http://localhost:3000/api/tasks/{taskId}/validate \
  -H "Content-Type: application/json" \
  -d '{"autoRework": true}'
```

---

## 📧 Email Delivery

Send professional deliverable emails with company branding:

```bash
# Send deliverables via email
python3 scripts/email_delivery.py recipient@company.com
```

**Features:**
- Professional HTML email template
- Company logos via logo.dev API
- Secure download credentials
- ZIP attachment support

**Setup:**
```bash
# Configure in .env.local
FROM_EMAIL=your@email.com
SMTP_PASSWORD=your-password
LOGO_DEV_KEY=your-logo-dev-key  # Optional
```

---

## 🔧 Configuration

### Environment Variables (.env.local)

```bash
# Required
DATABASE_PATH=./mission-control.db
OPENCLAW_GATEWAY_URL=ws://127.0.0.1:18789
OPENCLAW_GATEWAY_TOKEN=your-token

# Email (optional)
FROM_EMAIL=your@email.com
SMTP_PASSWORD=your-password

# APIs (optional)
BRAVE_API_KEY=your-brave-key
LOGO_DEV_KEY=your-logo-dev-key
```

### Agent Configuration

Edit `agent_prompts.json` to customize agent personalities:

```json
{
  "scout": {
    "name": "Scout",
    "role": "Competitor Research Analyst",
    "avatar_emoji": "🔍",
    "system_prompt": "You are Scout, a competitive intelligence expert..."
  }
}
```

---

## 🧪 Testing & Debugging

### View Mission Status

```bash
# Get detailed mission report
curl http://localhost:3000/api/missions/{missionId}
```

### Check Task Status

```typescript
// In browser console
const mission = await fetch('/api/missions/esab_eddyfi_analysis').then(r => r.json());
mission.tasks.forEach(t => console.log(`${t.id}: ${t.status}`));
```

### Debug Failed Tasks

```bash
# Get failed tasks
curl http://localhost:3000/api/missions/{missionId}/failed-tasks
```

---

## 📚 Best Practices

### From ESAB-Eddyfi Mission Learnings

1. **Start with Clear Objective**
   - Define specific, measurable outcomes
   - Example: "Assess $150-300M revenue at risk from ESAB-Eddyfi acquisition"

2. **Design for Parallelism**
   - Identify independent workstreams
   - Example: Scout and Researcher can work simultaneously

3. **Build in Validation Gates**
   - Use TESTING phase for quality checks
   - Example: Scholar validates technical claims before synthesis

4. **Plan for Dependencies**
   - Map task prerequisites clearly
   - Example: Writer depends on Scout + Researcher + Scholar outputs

5. **Track Deliverables**
   - Link output files to tasks
   - Example: Each task has associated .md deliverable

6. **Use Master Agent for Final Review**
   - Only master agent (Chip) can approve to DONE
   - Ensures consistency and quality

---

## 🤝 Integration with OpenClaw

Mission Control connects to your OpenClaw Gateway:

```typescript
// OpenClaw Gateway configuration
{
  "gateway": {
    "url": "ws://127.0.0.1:18789",
    "auth": {
      "mode": "token",
      "token": "your-secure-token"
    }
  }
}
```

Agents receive tasks via Telegram or webchat:

```
🔵 **NEW TASK ASSIGNED**

**Title:** Analyze competitive landscape
**Priority:** HIGH
**Task ID:** S4

Please work on this task. When complete, reply with:
`TASK_COMPLETE: [brief summary]`
```

---

## 📝 License

This framework is provided as-is for your OpenClaw implementation.

---

## 💬 Support

- **Documentation**: https://docs.openclaw.ai
- **Community**: https://discord.com/invite/clawd
- **GitHub**: https://github.com/psperera/mission-control

---

*Built with 🦞 for the OpenClaw ecosystem*
