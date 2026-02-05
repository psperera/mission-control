import { NextResponse } from 'next/server';
import { getOpenClawClient } from '@/lib/openclaw/client';

// GET /api/openclaw/debug - Get diagnostic information
export async function GET() {
  try {
    const client = getOpenClawClient();
    const results: Record<string, unknown> = {
      connected: client.isConnected(),
      timestamp: new Date().toISOString(),
    };

    if (!client.isConnected()) {
      try {
        await client.connect();
        results.reconnected = true;
        results.connected = true;
      } catch (err) {
        results.reconnectError = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json(results, { status: 503 });
      }
    }

    // Try to get session list
    try {
      const sessions = await client.listSessions();
      results.sessionsType = typeof sessions;
      results.sessionsIsArray = Array.isArray(sessions);
      results.sessionsRaw = JSON.stringify(sessions).substring(0, 500);
      if (Array.isArray(sessions)) {
        results.sessions = sessions.map(s => ({ 
          id: s.id, 
          key: s.key,
          kind: s.kind,
          displayName: s.displayName 
        }));
      } else {
        results.sessionsObject = sessions;
      }
    } catch (err) {
      results.sessionsError = err instanceof Error ? err.message : 'Unknown error';
    }

    // Try different send methods for testing
    const testResults: Record<string, string> = {};
    
    // Test 1: send to agent:main:main
    try {
      await client.call('send', { 
        to: 'agent:main:main', 
        message: '[TEST] Method 1: send to agent:main:main',
        idempotencyKey: `test-${Date.now()}-1`
      });
      testResults.method1 = 'success';
    } catch (err) {
      testResults.method1 = err instanceof Error ? err.message : 'failed';
    }

    // Test 2: send to webchat
    try {
      await client.call('send', { 
        to: 'webchat', 
        message: '[TEST] Method 2: send to webchat',
        idempotencyKey: `test-${Date.now()}-2`
      });
      testResults.method2 = 'success';
    } catch (err) {
      testResults.method2 = err instanceof Error ? err.message : 'failed';
    }

    // Test 3: send with channel webchat
    try {
      await client.call('send', { 
        to: 'agent:main:main',
        channel: 'webchat',
        message: '[TEST] Method 3: send with channel webchat',
        idempotencyKey: `test-${Date.now()}-3`
      });
      testResults.method3 = 'success';
    } catch (err) {
      testResults.method3 = err instanceof Error ? err.message : 'failed';
    }

    // Test 4: broadcast
    try {
      await client.call('broadcast', { 
        message: '[TEST] Method 4: broadcast',
        idempotencyKey: `test-${Date.now()}-4`
      });
      testResults.method4 = 'success';
    } catch (err) {
      testResults.method4 = err instanceof Error ? err.message : 'failed';
    }

    // Test 5: sessions_spawn
    try {
      await client.call('sessions.spawn', { 
        task: '[TEST] Method 5: sessions.spawn',
        agentId: 'main',
        label: 'test-spawn'
      });
      testResults.method5 = 'success';
    } catch (err) {
      testResults.method5 = err instanceof Error ? err.message : 'failed';
    }

    // Test 6: cron (wake)
    try {
      await client.call('cron', { 
        action: 'wake',
        text: '[TEST] Method 6: cron wake'
      });
      testResults.method6 = 'success';
    } catch (err) {
      testResults.method6 = err instanceof Error ? err.message : 'failed';
    }

    // Test 7: Send via systemEvent
    try {
      await client.call('systemEvent', { 
        text: '[TEST] Method 7: systemEvent'
      });
      testResults.method7 = 'success';
    } catch (err) {
      testResults.method7 = err instanceof Error ? err.message : 'failed';
    }

    results.sendTests = testResults;

    return NextResponse.json(results);
  } catch (error) {
    console.error('Debug endpoint error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
