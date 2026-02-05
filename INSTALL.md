# Installation Guide

Complete setup instructions for Mission Control with OpenClaw integration.

## Prerequisites

- **Node.js 20+** - Required for Next.js and MCP servers
- **OpenClaw** - AI agent framework ([github.com/openclaw/openclaw](https://github.com/openclaw/openclaw))
- **npm or pnpm** - Package manager

## Quick Start

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
npm run db:seed

# 5. Start development server
npm run dev
```

Open [http://localhost:3001](http://localhost:3001) to access Mission Control.

## Configuration

### Environment Variables (.env.local)

```bash
# Base paths
WORKSPACE_BASE_PATH=~/Documents/Shared
PROJECTS_PATH=~/Documents/Shared/projects

# Mission Control URL (auto-detected if not set)
MISSION_CONTROL_URL=http://localhost:3001

# OpenClaw Gateway connection
OPENCLAW_GATEWAY_URL=ws://127.0.0.1:18789
OPENCLAW_GATEWAY_TOKEN=your-token-here

# Database
DATABASE_PATH=./mission-control.db

# Email Delivery Configuration (Optional)
FROM_EMAIL=your-sender@email.com
FROM_NAME=Mission Control
SMTP_SERVER=smtp.zoho.eu
SMTP_PORT=465
SMTP_PASSWORD=your-smtp-password
LOGO_DEV_KEY=your-logo-dev-key  # Optional, for company logos in emails
```

### Email Delivery Setup

To enable email delivery of mission deliverables:

1. **Configure SMTP settings** in `.env.local` (see above)

2. **Test email delivery**:
   ```bash
   python3 scripts/email_delivery.py recipient@company.com
   ```

3. **Customize email template** (optional):
   - Edit `scripts/email_delivery.py` to customize company logos
   - Modify `create_email_template()` function for custom branding

### OpenClaw Gateway Setup

1. **Install OpenClaw** (if not already installed):
   ```bash
   npm install -g openclaw
   ```

2. **Configure Gateway authentication** in `~/.openclaw/openclaw.json`:
   ```json
   {
     "gateway": {
       "auth": {
         "mode": "token",
         "token": "your-secure-token"
       },
       "bind": "loopback",
       "port": 18789
     }
   }
   ```

3. **Start the Gateway**:
   ```bash
   openclaw gateway start
   ```

4. **Verify connection**:
   ```bash
   openclaw status
   ```

### Telegram Integration (Optional)

To connect agents via Telegram:

1. **Create a Telegram bot** via [@BotFather](https://t.me/BotFather)

2. **Configure in OpenClaw** (`~/.openclaw/openclaw.json`):
   ```json
   {
     "channels": {
       "telegram": {
         "botToken": "YOUR_BOT_TOKEN",
         "enabled": true,
         "dmPolicy": "pairing",
         "groupPolicy": "allowlist"
       }
     }
   }
   ```

3. **Link agents to Telegram** in Mission Control:
   - Click on an agent in the sidebar
   - Go to "OpenClaw Session" tab
   - Select "telegram" as channel
   - Enter the Telegram peer ID

## Research Integrity Guard (MCP Server)

The Research Integrity Guard validates outputs during the TESTING phase.

### Installation

```bash
cd mcp-servers/research-integrity-guard
npm install
```

### Manual Testing

```bash
# Start the MCP server
node server.js

# Or test validation via API
curl -X POST http://localhost:3001/api/tasks/{taskId}/validate \
  -H "Content-Type: application/json" \
  -d '{"autoRework": true}'
```

### Claude Code Integration

The MCP server is configured in `.claude/mcp.json`:

```json
{
  "mcpServers": {
    "research-integrity-guard": {
      "command": "node",
      "args": ["mcp-servers/research-integrity-guard/server.js"],
      "cwd": "/path/to/mission-control"
    }
  }
}
```

### Available MCP Tools

| Tool | Description |
|------|-------------|
| `validate_research_output` | Validate content for quality and AI slop |
| `validate_file` | Validate a file at given path |
| `clean_ai_slop` | Remove AI slop and return cleaned content |
| `validate_task_deliverables` | Validate all deliverables for a task |

### AI Slop Patterns Detected

The guard detects 40+ common AI filler phrases:
- "delve", "leverage", "synergy", "paradigm"
- "cutting-edge", "state-of-the-art", "game-changer"
- "let's dive in", "it's worth noting", "in conclusion"
- "tapestry", "landscape", "ecosystem", "journey"
- "robust", "holistic", "multifaceted", "nuanced"

## Database Management

```bash
# Initialize with sample data
npm run db:seed

# Run migrations
npm run db:migrate

# Backup database
npm run db:backup

# Restore from backup
npm run db:restore

# Full reset (delete + reseed)
npm run db:reset
```

## Development

```bash
# Development server with hot reload
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Type checking
npx tsc --noEmit

# Linting
npm run lint
```

## Task Workflow

### Status Flow

```
INBOX → ASSIGNED → IN_PROGRESS → TESTING → REVIEW → DONE
                        ↑            │
                        └────────────┘
                      (auto-rework on validation failure)
```

### Automated Triggers

| Status Change | Trigger |
|---------------|---------|
| → ASSIGNED | Auto-dispatch to agent's OpenClaw session |
| → TESTING | Auto-validate deliverables via Research Integrity Guard |
| Validation fails | Auto-return to IN_PROGRESS |
| → DONE | Requires master agent approval |

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl + K` | Toggle CLI chat panel |
| `Escape` | Close chat panel |

## Troubleshooting

### OpenClaw Connection Issues

1. **Check Gateway is running**:
   ```bash
   openclaw status
   ```

2. **Verify token matches** in both:
   - `~/.openclaw/openclaw.json` (gateway.auth.token)
   - `.env.local` (OPENCLAW_GATEWAY_TOKEN)

3. **Check WebSocket URL** format:
   - Local: `ws://127.0.0.1:18789`
   - Remote via Tailscale: `wss://your-machine.tail12345.ts.net`

### Chat Panel Not Showing

- Press `Cmd/Ctrl + K` to toggle
- Check browser console for errors
- Ensure the flex container has proper height

### Validation Always Fails

- Check deliverables exist for the task
- Ensure file paths are accessible
- Review the validation response for specific issues

## Cross-Machine Setup

For running Mission Control on one machine while agents run on another:

1. **Expose Mission Control** via Tailscale or local network
2. **Configure agents** to call Mission Control APIs
3. **Use file upload API** for deliverables:
   ```bash
   curl -X POST http://server:3001/api/files/upload \
     -H "Content-Type: application/json" \
     -d '{"relativePath": "project/file.html", "content": "..."}'
   ```

See `HEARTBEAT.md` for full orchestration instructions.

## License

MIT
