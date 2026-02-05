// Telegram notification helper for Mission Control events
import { getOpenClawClient } from '@/lib/openclaw/client';

const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '8365421338';

export async function notifyTelegram(message: string): Promise<void> {
  try {
    const client = getOpenClawClient();
    
    console.log('[Telegram] Sending notification...');
    
    // Ensure connection
    if (!client.isConnected()) {
      console.log('[Telegram] Connecting to OpenClaw...');
      await client.connect();
    }
    
    // Use client's send method
    await client.send(
      `telegram:${TELEGRAM_CHAT_ID}`,
      message,
      'telegram',
      `mc-notify-${Date.now()}`
    );
    
    console.log('[Telegram] ✅ Notification sent:', message.substring(0, 50));
  } catch (error) {
    console.error('[Telegram] ❌ Failed to send notification:', error);
    throw error; // Re-throw so caller knows it failed
  }
}

export function formatAgentProgress(agentName: string, emoji: string, message: string): string {
  return `${emoji} **${agentName}**\n\n${message}`;
}

export function formatTaskUpdate(taskTitle: string, status: string, agentName?: string): string {
  const statusEmoji = {
    'inbox': '📥',
    'assigned': '👤',
    'in_progress': '🔄',
    'testing': '🧪',
    'review': '👀',
    'done': '✅'
  }[status] || '📝';
  
  return `${statusEmoji} **Task Update**\n\n**${taskTitle}**\nStatus: ${status}${agentName ? `\nAssigned to: ${agentName}` : ''}`;
}

export function formatCriticalIntel(findings: string): string {
  return `🚨 **CRITICAL INTELLIGENCE**\n\n${findings}`;
}
