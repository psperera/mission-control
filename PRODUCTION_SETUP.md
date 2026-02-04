# Production Setup Guide

This guide walks you through setting up Mission Control for production use with proper configuration management.

## ⚠️ Security First

**NEVER commit sensitive data to the repository!** This includes:
- IP addresses
- User paths
- Authentication tokens
- API keys
- Database credentials

All sensitive values go in `.env.local` (which is gitignored).

## 📦 Initial Setup

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/mission-control.git
cd mission-control
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

```bash
cp .env.example .env.local
```

Edit `.env.local` with your configuration:

```bash
# Database
DATABASE_PATH=./mission-control.db

# OpenClaw Gateway
OPENCLAW_GATEWAY_URL=ws://127.0.0.1:18789
OPENCLAW_GATEWAY_TOKEN=your-token-here

# Workspace Paths
WORKSPACE_BASE_PATH=~/Documents/Shared
PROJECTS_PATH=~/Documents/Shared/projects

# API URL (auto-detected if not set)
MISSION_CONTROL_URL=http://localhost:3000
```

### 4. Initialize Database

```bash
npm run db:seed
```

This creates the database and seeds it with:
- Charlie (master agent)
- Sample tasks
- Default business

### 5. Start Development Server

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000)

## ⚙️ Configuration Management

Mission Control supports configuration via **two methods**:

### Method 1: Environment Variables (.env.local)

Best for:
- Server-side configuration
- Deployment environments
- Team consistency

Variables in `.env.local`:
```bash
WORKSPACE_BASE_PATH=~/Documents/Shared
PROJECTS_PATH=~/Documents/Shared/projects
MISSION_CONTROL_URL=http://your-server-ip:3000
OPENCLAW_GATEWAY_URL=ws://127.0.0.1:18789
```

### Method 2: Settings UI

Best for:
- User-specific preferences
- Quick adjustments
- Per-user customization

Access via: **Settings** button (top-right) or `/settings`

Settings stored in browser localStorage:
- Workspace base path
- Projects path
- Mission Control API URL
- Default project name

**Priority:** Environment variables override UI settings for server operations.

## 📁 Workspace Structure

Mission Control organizes files in a structured workspace:

```
~/Documents/Shared/              # Base workspace
├── projects/                    # All projects
│   ├── [PROJECT_NAME_1]/       # Individual project
│   │   ├── deliverables/       # Task deliverables
│   │   ├── docs/               # Project docs
│   │   └── README.md
│   └── [PROJECT_NAME_2]/
└── mission-control/             # Mission Control app
    └── mission-control.db       # Database
```

### Configuring Paths

**Via Environment Variables:**
```bash
WORKSPACE_BASE_PATH=~/Documents/Shared
PROJECTS_PATH=~/Documents/Shared/projects
```

**Via Settings UI:**
1. Click **Settings** (gear icon)
2. Update "Workspace Base Path"
3. Update "Projects Path"
4. Click **Save Changes**

### Path Variables

- `~` expands to your home directory
- Paths can be absolute: `/Users/chris/workspace`
- Paths can be relative: `./workspace`

## 🔌 OpenClaw Gateway Setup

### Local Connection

```bash
# .env.local
OPENCLAW_GATEWAY_URL=ws://127.0.0.1:18789
```

No token required for local connections.

### Remote Connection (Tailscale)

**Option 1: Tailscale (Simplest)**

```bash
# .env.local
OPENCLAW_GATEWAY_URL=wss://your-machine.tail12345.ts.net
OPENCLAW_GATEWAY_TOKEN=$(openssl rand -hex 32)
```

**Generate a secure token:**
```bash
openssl rand -hex 32
```

Copy this token to both:
1. Mission Control's `.env.local`
2. OpenClaw's gateway configuration

### Remote Connection (Cloudflare Tunnel)

**Option 2: Cloudflare Tunnel (Public Internet Access)**

Use Cloudflare Tunnel if you need public internet access without a VPN.

**Quick Setup:**
```bash
# Install cloudflared
brew install cloudflared  # macOS

# Run the setup script
./scripts/setup-cloudflare-tunnel.sh mission-control yourdomain.com
```

**Manual Setup:**
```bash
# 1. Authenticate
cloudflared tunnel login

# 2. Create tunnel
cloudflared tunnel create mission-control

# 3. Route DNS
cloudflared tunnel route dns mission-control mission-control.yourdomain.com
cloudflared tunnel route dns mission-control gateway.yourdomain.com

# 4. Create config at ~/.cloudflared/config.yml
cat > ~/.cloudflared/config.yml << 'EOF'
tunnel: YOUR_TUNNEL_ID
credentials-file: ~/.cloudflared/YOUR_TUNNEL_ID.json

ingress:
  - hostname: mission-control.yourdomain.com
    service: http://localhost:3000
  - hostname: gateway.yourdomain.com
    service: ws://localhost:18789
    originRequest:
      noTLSVerify: true
  - service: http_status:404
EOF

# 5. Start tunnel
cloudflared tunnel run mission-control
```

**Configure .env.local:**
```bash
MISSION_CONTROL_URL=https://mission-control.yourdomain.com
OPENCLAW_GATEWAY_URL=wss://gateway.yourdomain.com
OPENCLAW_GATEWAY_TOKEN=$(openssl rand -hex 32)
CLOUDFLARE_TUNNEL_DOMAIN=mission-control.yourdomain.com
CLOUDFLARE_TUNNEL_CREDENTIALS_FILE=~/.cloudflared/YOUR_TUNNEL_ID.json
```

**Start on boot (macOS):**
```bash
launchctl load ~/Library/LaunchAgents/com.cloudflare.mission-control.plist
```

**Comparison:**
- **Tailscale**: Private network, requires client on all devices, simpler
- **Cloudflare Tunnel**: Public URLs, works from anywhere, requires DNS setup

## 🚀 Production Deployment

### Build for Production

```bash
npm run build
npm start
```

### Environment Variables for Production

Create `.env.production.local`:

```bash
NODE_ENV=production
DATABASE_PATH=/var/lib/mission-control/mission-control.db
WORKSPACE_BASE_PATH=/var/lib/mission-control/workspace
PROJECTS_PATH=/var/lib/mission-control/workspace/projects
MISSION_CONTROL_URL=https://mission-control.yourdomain.com
OPENCLAW_GATEWAY_URL=wss://gateway.yourdomain.com
OPENCLAW_GATEWAY_TOKEN=your-production-token
```

### Database Backups

```bash
# Backup database
cp mission-control.db mission-control.backup.$(date +%Y%m%d).db

# Restore from backup
cp mission-control.backup.20250131.db mission-control.db
```

## 🧪 Testing Your Setup

### 1. Verify Configuration

```bash
# Check environment variables
cat .env.local

# Verify database
ls -la mission-control.db
```

### 2. Test OpenClaw Connection

1. Start OpenClaw Gateway: `openclaw gateway`
2. Open Mission Control: `http://localhost:3000`
3. Check status indicator (top-right): Should show **ONLINE** (green)

### 3. Test Real-Time Updates

1. Create a task
2. Assign it to an agent
3. Drag to "In Progress"
4. Watch it update in real-time (no refresh needed)

✅ **Task cards should move between columns instantly**

### 4. Test Deliverables

1. Open a task with deliverables
2. Click the arrow (→) button next to a file deliverable
3. File path should copy to clipboard

## 🔧 Troubleshooting

### Real-Time Updates Not Working

**Symptom:** Task cards don't move when status changes

**Solutions:**
1. Check browser console for SSE errors
2. Verify SSE endpoint: `/api/events/stream`
3. Clear browser cache
4. Restart dev server

### OpenClaw Not Connecting

**Symptom:** Status shows OFFLINE

**Solutions:**
1. Verify Gateway is running: `openclaw gateway status`
2. Check `OPENCLAW_GATEWAY_URL` in `.env.local`
3. For remote: Verify `OPENCLAW_GATEWAY_TOKEN` matches
4. Test WebSocket connection: `wscat -c ws://127.0.0.1:18789`

### Deliverables Button Not Working

**Symptom:** Arrow button does nothing

**Solutions:**
1. Check browser clipboard permissions
2. Look for console errors
3. Try on a task with a file deliverable (not URL)

### Hardcoded Paths in Code

**Symptom:** Paths still reference wrong user

**Solution:** All hardcoded paths have been removed! If you find any:
1. File a bug report
2. Use `getWorkspaceBasePath()` or `getProjectsPath()` from `@/lib/config`

## 📚 Configuration Reference

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_PATH` | `./mission-control.db` | SQLite database file path |
| `WORKSPACE_BASE_PATH` | `~/Documents/Shared` | Base directory for workspace |
| `PROJECTS_PATH` | `~/Documents/Shared/projects` | Directory for project folders |
| `MISSION_CONTROL_URL` | Auto-detected | API URL for agent orchestration |
| `OPENCLAW_GATEWAY_URL` | `ws://127.0.0.1:18789` | Gateway WebSocket URL |
| `OPENCLAW_GATEWAY_TOKEN` | (empty) | Authentication token |

### Settings UI Fields

| Setting | Description |
|---------|-------------|
| Workspace Base Path | Root directory for all Mission Control files |
| Projects Path | Where individual project folders are created |
| Default Project Name | Template name for new projects |
| Mission Control URL | API endpoint (usually auto-detected) |

## 🎯 Next Steps

1. ✅ Configure `.env.local`
2. ✅ Run database seed
3. ✅ Start dev server
4. ✅ Test real-time updates
5. ✅ Configure workspace paths
6. 🚀 Create your first agent!

## 📖 Further Reading

- [Agent Protocol Documentation](docs/AGENT_PROTOCOL.md)
- [Real-Time Implementation](REALTIME_IMPLEMENTATION_SUMMARY.md)
- [Charlie Orchestration Guide](src/lib/charlie-orchestration.ts)
- [Verification Checklist](VERIFICATION_CHECKLIST.md)

---

**Questions?** File an issue or check the documentation in `/docs`.
