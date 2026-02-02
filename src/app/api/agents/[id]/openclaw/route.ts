import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { queryOne, run } from '@/lib/db';
import { getOpenClawClient } from '@/lib/openclaw/client';
import type { Agent, OpenClawSession } from '@/lib/types';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/agents/[id]/openclaw - Get the agent's OpenClaw session
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    const agent = queryOne<Agent>('SELECT * FROM agents WHERE id = ?', [id]);
    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    const session = queryOne<OpenClawSession>(
      'SELECT * FROM openclaw_sessions WHERE agent_id = ? AND status = ?',
      [id, 'active']
    );

    if (!session) {
      return NextResponse.json({ linked: false, session: null });
    }

    return NextResponse.json({ linked: true, session });
  } catch (error) {
    console.error('Failed to get OpenClaw session:', error);
    return NextResponse.json(
      { error: 'Failed to get OpenClaw session' },
      { status: 500 }
    );
  }
}

// POST /api/agents/[id]/openclaw - Link agent to OpenClaw (creates session)
// Accepts optional body: { channel: "telegram" | "webchat" | "mission-control", peer: "telegram:USER_ID" }
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    // Parse optional body for channel selection
    let channel = 'mission-control';
    let peer: string | null = null;
    let metadata: Record<string, unknown> = {};

    try {
      const body = await request.json();
      if (body.channel && ['telegram', 'webchat', 'mission-control'].includes(body.channel)) {
        channel = body.channel;
      }
      if (body.peer) {
        peer = body.peer;
      }
      if (body.metadata) {
        metadata = body.metadata;
      }
    } catch {
      // No body or invalid JSON - use defaults
    }

    const agent = queryOne<Agent>('SELECT * FROM agents WHERE id = ?', [id]);
    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    // Check if already linked to this channel
    const existingSession = queryOne<OpenClawSession>(
      'SELECT * FROM openclaw_sessions WHERE agent_id = ? AND channel = ? AND status = ?',
      [id, channel, 'active']
    );
    if (existingSession) {
      return NextResponse.json(
        { error: `Agent is already linked to an OpenClaw session on ${channel}`, session: existingSession },
        { status: 409 }
      );
    }

    // Connect to OpenClaw Gateway
    const client = getOpenClawClient();
    if (!client.isConnected()) {
      try {
        await client.connect();
      } catch {
        return NextResponse.json(
          { error: 'Failed to connect to OpenClaw Gateway' },
          { status: 503 }
        );
      }
    }

    // OpenClaw creates sessions automatically when messages are sent
    // Just verify connection works by listing sessions
    try {
      await client.listSessions();
    } catch (err) {
      console.error('Failed to verify OpenClaw connection:', err);
      return NextResponse.json(
        { error: 'Connected but failed to communicate with OpenClaw Gateway' },
        { status: 503 }
      );
    }

    // Generate session ID based on channel
    const sessionId = uuidv4();
    const agentSlug = agent.name.toLowerCase().replace(/\s+/g, '-');
    let openclawSessionId: string;

    switch (channel) {
      case 'telegram':
        // For Telegram, use peer ID if provided, otherwise generate placeholder
        openclawSessionId = peer || `telegram:${agentSlug}`;
        break;
      case 'webchat':
        openclawSessionId = `webchat-${agentSlug}`;
        break;
      default:
        openclawSessionId = `mission-control-${agentSlug}`;
    }

    const now = new Date().toISOString();

    run(
      `INSERT INTO openclaw_sessions (id, agent_id, openclaw_session_id, channel, peer, status, metadata, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [sessionId, id, openclawSessionId, channel, peer, 'active', JSON.stringify(metadata), now, now]
    );

    // Log event
    run(
      `INSERT INTO events (id, type, agent_id, message, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [uuidv4(), 'agent_status_changed', id, `${agent.name} connected to OpenClaw Gateway via ${channel}`, now]
    );

    const session = queryOne<OpenClawSession>(
      'SELECT * FROM openclaw_sessions WHERE id = ?',
      [sessionId]
    );

    return NextResponse.json({ linked: true, channel, session }, { status: 201 });
  } catch (error) {
    console.error('Failed to link agent to OpenClaw:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to link agent to OpenClaw' },
      { status: 500 }
    );
  }
}

// DELETE /api/agents/[id]/openclaw - Unlink agent from OpenClaw
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    const agent = queryOne<Agent>('SELECT * FROM agents WHERE id = ?', [id]);
    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    const existingSession = queryOne<OpenClawSession>(
      'SELECT * FROM openclaw_sessions WHERE agent_id = ? AND status = ?',
      [id, 'active']
    );

    if (!existingSession) {
      return NextResponse.json(
        { error: 'Agent is not linked to an OpenClaw session' },
        { status: 404 }
      );
    }

    // Mark the session as inactive
    const now = new Date().toISOString();
    run(
      'UPDATE openclaw_sessions SET status = ?, updated_at = ? WHERE id = ?',
      ['inactive', now, existingSession.id]
    );

    // Log event
    run(
      `INSERT INTO events (id, type, agent_id, message, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [uuidv4(), 'agent_status_changed', id, `${agent.name} disconnected from OpenClaw Gateway`, now]
    );

    return NextResponse.json({ linked: false, success: true });
  } catch (error) {
    console.error('Failed to unlink agent from OpenClaw:', error);
    return NextResponse.json(
      { error: 'Failed to unlink agent from OpenClaw' },
      { status: 500 }
    );
  }
}
