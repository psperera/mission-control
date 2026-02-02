import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { queryOne, queryAll, run } from '@/lib/db';
import type { Agent, OpenClawSession, Conversation, Message } from '@/lib/types';

/**
 * POST /api/webhooks/telegram
 *
 * Receives incoming messages from Telegram via OpenClaw Gateway.
 * Routes messages to Mission Control conversations.
 *
 * Expected payload from OpenClaw:
 * {
 *   "from": "telegram:8365421338",
 *   "text": "Message content",
 *   "sessionId": "agent:main:main" or "mission-control-agent-name",
 *   "chatType": "direct" | "group",
 *   "metadata": { ... }
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { from, text, sessionId, chatType, metadata } = body;
    const now = new Date().toISOString();

    if (!text) {
      return NextResponse.json({ error: 'Missing text field' }, { status: 400 });
    }

    // Find agent by session ID or Telegram ID
    let agent: Agent | null = null;
    let session: OpenClawSession | null = null;

    if (sessionId) {
      // Try to find by OpenClaw session ID
      session = queryOne<OpenClawSession>(
        `SELECT * FROM openclaw_sessions
         WHERE (openclaw_session_id = ? OR openclaw_session_id LIKE ?)
         AND status = ?`,
        [sessionId, `%${sessionId}%`, 'active']
      );

      if (session) {
        agent = queryOne<Agent>('SELECT * FROM agents WHERE id = ?', [session.agent_id]);
      }
    }

    // Try to find agent by Telegram peer ID stored in metadata
    if (!agent && from) {
      session = queryOne<OpenClawSession>(
        `SELECT * FROM openclaw_sessions
         WHERE channel = 'telegram'
         AND (peer = ? OR metadata LIKE ?)
         AND status = ?`,
        [from, `%${from}%`, 'active']
      );

      if (session) {
        agent = queryOne<Agent>('SELECT * FROM agents WHERE id = ?', [session.agent_id]);
      }
    }

    // Check for TASK_COMPLETE pattern - route to completion webhook
    const completionMatch = text.match(/TASK_COMPLETE:\s*(.+)/i);
    if (completionMatch && session) {
      // Forward to agent-completion webhook logic
      const summary = completionMatch[1].trim();

      // Find active task for this agent
      const task = queryOne<{ id: string; status: string; assigned_agent_id: string }>(
        `SELECT id, status, assigned_agent_id FROM tasks
         WHERE assigned_agent_id = ?
         AND status IN ('assigned', 'in_progress')
         ORDER BY updated_at DESC
         LIMIT 1`,
        [session.agent_id]
      );

      if (task) {
        // Update task to testing status
        if (task.status !== 'testing' && task.status !== 'review' && task.status !== 'done') {
          run('UPDATE tasks SET status = ?, updated_at = ? WHERE id = ?', ['testing', now, task.id]);
        }

        // Log completion
        run(
          `INSERT INTO events (id, type, agent_id, task_id, message, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [uuidv4(), 'task_completed', session.agent_id, task.id,
           `${agent?.name || 'Agent'} completed via Telegram: ${summary}`, now]
        );

        // Set agent back to standby
        run('UPDATE agents SET status = ?, updated_at = ? WHERE id = ?',
            ['standby', now, session.agent_id]);

        return NextResponse.json({
          success: true,
          type: 'task_completion',
          task_id: task.id,
          summary,
          new_status: 'testing'
        });
      }
    }

    // Store message in conversations if we have an agent
    if (agent) {
      // Find or create conversation for this agent
      let conversation = queryOne<Conversation>(
        `SELECT * FROM conversations
         WHERE type = 'direct'
         AND (
           (participant1_id = ? AND participant2_id IS NULL)
           OR metadata LIKE ?
         )
         ORDER BY updated_at DESC
         LIMIT 1`,
        [agent.id, `%telegram%`]
      );

      if (!conversation) {
        // Create new conversation for Telegram messages
        const convId = uuidv4();
        run(
          `INSERT INTO conversations (id, type, participant1_id, metadata, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [convId, 'direct', agent.id, JSON.stringify({ channel: 'telegram', from }), now, now]
        );
        conversation = queryOne<Conversation>('SELECT * FROM conversations WHERE id = ?', [convId]);
      }

      if (conversation) {
        // Store the message
        const messageId = uuidv4();
        run(
          `INSERT INTO messages (id, conversation_id, sender_agent_id, content, message_type, metadata, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [messageId, conversation.id, agent.id, text, 'text',
           JSON.stringify({ source: 'telegram', from, chatType, ...metadata }), now]
        );

        // Update conversation timestamp
        run('UPDATE conversations SET updated_at = ? WHERE id = ?', [now, conversation.id]);

        // Log event
        run(
          `INSERT INTO events (id, type, agent_id, message, created_at)
           VALUES (?, ?, ?, ?, ?)`,
          [uuidv4(), 'message_received', agent.id,
           `${agent.name} sent message via Telegram`, now]
        );

        return NextResponse.json({
          success: true,
          type: 'message',
          agent_id: agent.id,
          conversation_id: conversation.id,
          message_id: messageId
        });
      }
    }

    // Log unknown message for debugging
    run(
      `INSERT INTO events (id, type, message, metadata, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [uuidv4(), 'telegram_message', `Telegram message from ${from || 'unknown'}`,
       JSON.stringify({ from, sessionId, text: text.substring(0, 100), chatType }), now]
    );

    return NextResponse.json({
      success: true,
      type: 'logged',
      message: 'Message logged but no matching agent found'
    });
  } catch (error) {
    console.error('Telegram webhook error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process Telegram message' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/webhooks/telegram
 *
 * Returns webhook status and configuration info
 */
export async function GET() {
  try {
    const telegramSessions = queryAll<OpenClawSession>(
      `SELECT os.*, a.name as agent_name
       FROM openclaw_sessions os
       LEFT JOIN agents a ON os.agent_id = a.id
       WHERE os.channel = 'telegram' AND os.status = 'active'`
    );

    const recentMessages = queryAll(
      `SELECT * FROM events
       WHERE type IN ('telegram_message', 'message_received')
       ORDER BY created_at DESC
       LIMIT 10`
    );

    return NextResponse.json({
      status: 'active',
      endpoint: '/api/webhooks/telegram',
      telegram_sessions: telegramSessions,
      recent_messages: recentMessages,
      usage: {
        method: 'POST',
        payload: {
          from: 'telegram:USER_ID',
          text: 'Message content',
          sessionId: 'agent session ID (optional)',
          chatType: 'direct or group (optional)',
          metadata: 'additional data (optional)'
        }
      }
    });
  } catch (error) {
    console.error('Failed to fetch Telegram webhook status:', error);
    return NextResponse.json({ error: 'Failed to fetch status' }, { status: 500 });
  }
}
