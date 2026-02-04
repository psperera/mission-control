#!/bin/bash
# Cloudflare Tunnel Setup Script for Mission Control
# Alternative to Tailscale for remote access
# Usage: ./scripts/setup-cloudflare-tunnel.sh <tunnel-name> <domain>

set -e

TUNNEL_NAME="${1:-mission-control}"
DOMAIN="${2:-}"

if ! command -v cloudflared &> /dev/null; then
    echo "❌ cloudflared not found. Install it first:"
    echo "   macOS: brew install cloudflared"
    echo "   Linux: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/"
    exit 1
fi

if [ -z "$DOMAIN" ]; then
    echo "Usage: $0 <tunnel-name> <domain>"
    echo ""
    echo "Example:"
    echo "   $0 mission-control mydomain.com"
    echo ""
    echo "This will create: mission-control.mydomain.com"
    exit 1
fi

FULL_DOMAIN="${TUNNEL_NAME}.${DOMAIN}"

echo "🚀 Setting up Cloudflare Tunnel for Mission Control"
echo "   Tunnel name: $TUNNEL_NAME"
echo "   Domain: $FULL_DOMAIN"
echo ""

# Authenticate if needed
if [ ! -f ~/.cloudflared/cert.pem ]; then
    echo "🔐 Authenticating with Cloudflare..."
    cloudflared tunnel login
fi

# Create the tunnel
echo "📦 Creating tunnel: $TUNNEL_NAME"
TUNNEL_OUTPUT=$(cloudflared tunnel create "$TUNNEL_NAME" 2>&1)
TUNNEL_ID=$(echo "$TUNNEL_OUTPUT" | grep -oE '[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}' | head -1)

if [ -z "$TUNNEL_ID" ]; then
    echo "❌ Failed to create tunnel. Output:"
    echo "$TUNNEL_OUTPUT"
    exit 1
fi

echo "✅ Tunnel created with ID: $TUNNEL_ID"

# Route DNS
echo "🌐 Routing DNS: $FULL_DOMAIN"
cloudflared tunnel route dns "$TUNNEL_NAME" "$FULL_DOMAIN"

# Create config directory
CONFIG_DIR="$HOME/.cloudflared"
CONFIG_FILE="$CONFIG_DIR/${TUNNEL_ID}.json"

# Create tunnel config
TUNNEL_CONFIG="$CONFIG_DIR/config.yml"
cat > "$TUNNEL_CONFIG" << EOF
# Mission Control Cloudflare Tunnel Configuration
tunnel: $TUNNEL_ID
credentials-file: $CONFIG_FILE

ingress:
  # Mission Control Dashboard
  - hostname: $FULL_DOMAIN
    service: http://localhost:3000
  # OpenClaw Gateway WebSocket
  - hostname: gateway.$DOMAIN
    service: ws://localhost:18789
    originRequest:
      connectTimeout: 30s
      noTLSVerify: true
  # Default catch-all
  - service: http_status:404
EOF

echo "✅ Config created: $TUNNEL_CONFIG"

# macOS launchd plist (optional)
if [[ "$OSTYPE" == "darwin"* ]]; then
    PLIST_FILE="$HOME/Library/LaunchAgents/com.cloudflare.mission-control.plist"
    cat > "$PLIST_FILE" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.cloudflare.mission-control</string>
    <key>ProgramArguments</key>
    <array>
        <string>$(which cloudflared)</string>
        <string>tunnel</string>
        <string>run</string>
        <string>$TUNNEL_ID</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
</dict>
</plist>
EOF
    echo "✅ LaunchAgent created: $PLIST_FILE"
    echo "   Start on boot: launchctl load $PLIST_FILE"
fi

# Output environment variables
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 Add these to your .env.local file:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "CLOUDFLARE_TUNNEL_CREDENTIALS_FILE=$CONFIG_FILE"
echo "CLOUDFLARE_TUNNEL_DOMAIN=$FULL_DOMAIN"
echo ""
echo "# Mission Control URLs:"
echo "MISSION_CONTROL_URL=https://$FULL_DOMAIN"
echo "OPENCLAW_GATEWAY_URL=wss://gateway.$DOMAIN"
echo ""
echo "# Don't forget to set your OpenClaw token:"
echo "OPENCLAW_GATEWAY_TOKEN=\$(openssl rand -hex 32)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo ""
echo "🎉 Setup complete!"
echo ""
echo "To start the tunnel:"
echo "   cloudflared tunnel run $TUNNEL_ID"
echo ""
echo "Your Mission Control will be available at:"
echo "   https://$FULL_DOMAIN"
