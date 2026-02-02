'use client';

import { useEffect, useState } from 'react';
import { Header } from '@/components/Header';
import { AgentsSidebar } from '@/components/AgentsSidebar';
import { MissionQueue } from '@/components/MissionQueue';
import { LiveFeed } from '@/components/LiveFeed';
import { ChatPanel } from '@/components/ChatPanel';
import { SSEDebugPanel } from '@/components/SSEDebugPanel';
import { useMissionControl } from '@/lib/store';
import { useSSE } from '@/hooks/useSSE';
import { debug } from '@/lib/debug';
import type { Task } from '@/lib/types';

export default function MissionControlPage() {
  const {
    setAgents,
    setTasks,
    setConversations,
    setEvents,
    setIsOnline,
    setIsLoading,
    isLoading,
    tasks,
  } = useMissionControl();

  const [showChat, setShowChat] = useState(false);

  // Keyboard shortcut to toggle chat (Cmd/Ctrl + K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowChat(prev => !prev);
      }
      if (e.key === 'Escape' && showChat) {
        setShowChat(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showChat]);

  // Connect to SSE for real-time updates
  useSSE();

  // Initial data load
  useEffect(() => {
    async function loadData() {
      try {
        debug.api('Loading initial data...');
        // Fetch all data in parallel
        const [agentsRes, tasksRes, conversationsRes, eventsRes] = await Promise.all([
          fetch('/api/agents'),
          fetch('/api/tasks'),
          fetch('/api/conversations'),
          fetch('/api/events'),
        ]);

        if (agentsRes.ok) setAgents(await agentsRes.json());
        if (tasksRes.ok) {
          const tasksData = await tasksRes.json();
          debug.api('Loaded tasks', { count: tasksData.length });
          setTasks(tasksData);
        }
        if (conversationsRes.ok) setConversations(await conversationsRes.json());
        if (eventsRes.ok) setEvents(await eventsRes.json());
      } catch (error) {
        console.error('Failed to load data:', error);
      } finally {
        setIsLoading(false);
      }
    }

    // Check OpenClaw connection separately (non-blocking)
    async function checkOpenClaw() {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

        const openclawRes = await fetch('/api/openclaw/status', { signal: controller.signal });
        clearTimeout(timeoutId);

        if (openclawRes.ok) {
          const status = await openclawRes.json();
          setIsOnline(status.connected);
        }
      } catch {
        setIsOnline(false);
      }
    }

    loadData();
    checkOpenClaw(); // Run in parallel, don't block page load

    // Poll for events every 5 seconds
    const eventPoll = setInterval(async () => {
      try {
        const res = await fetch('/api/events?limit=20');
        if (res.ok) {
          setEvents(await res.json());
        }
      } catch (error) {
        console.error('Failed to poll events:', error);
      }
    }, 5000);

    // Poll tasks as SSE fallback (every 10 seconds)
    const taskPoll = setInterval(async () => {
      try {
        const res = await fetch('/api/tasks');
        if (res.ok) {
          const newTasks: Task[] = await res.json();
          // Get current tasks from store
          const currentTasks = useMissionControl.getState().tasks;

          // Check if there are any changes
          const hasChanges = newTasks.length !== currentTasks.length ||
            newTasks.some((t) => {
              const current = currentTasks.find(ct => ct.id === t.id);
              return !current || current.status !== t.status;
            });

          if (hasChanges) {
            debug.api('[FALLBACK] Task changes detected, updating store', {
              oldCount: currentTasks.length,
              newCount: newTasks.length
            });
            setTasks(newTasks);
          }
        }
      } catch (error) {
        console.error('Failed to poll tasks:', error);
      }
    }, 10000);

    // Check OpenClaw connection every 30 seconds
    const connectionCheck = setInterval(async () => {
      try {
        const res = await fetch('/api/openclaw/status');
        if (res.ok) {
          const status = await res.json();
          setIsOnline(status.connected);
        }
      } catch {
        setIsOnline(false);
      }
    }, 30000);

    return () => {
      clearInterval(eventPoll);
      clearInterval(connectionCheck);
      clearInterval(taskPoll);
    };
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-mc-bg flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4 animate-pulse">🦞</div>
          <p className="text-mc-text-secondary">Loading Mission Control...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-mc-bg overflow-hidden">
      <Header />

      <div className="flex-1 flex overflow-hidden">
        {/* Agents Sidebar */}
        <AgentsSidebar />

        {/* Main Content Area */}
        <div className="flex-1 flex min-w-0">
          {/* Mission Queue */}
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            <MissionQueue />

            {/* Chat Toggle - positioned above Live Feed */}
            {!showChat && (
              <button
                onClick={() => setShowChat(true)}
                className="fixed bottom-6 right-80 z-50 px-4 py-2 bg-green-600 text-white rounded-lg shadow-lg hover:bg-green-500 flex items-center gap-2 font-mono text-sm border border-green-500"
              >
                <span className="text-green-300">{'>'}</span> open chat
              </button>
            )}
          </div>

          {/* Chat Panel (conditionally shown) */}
          {showChat && (
            <div className="w-96 flex-shrink-0 border-l border-mc-border flex flex-col bg-mc-bg-secondary">
              <div className="flex-shrink-0 flex items-center justify-between px-3 py-2 border-b border-mc-border bg-mc-bg font-mono text-xs">
                <span className="text-green-400">⚡ chat</span>
                <button
                  onClick={() => setShowChat(false)}
                  className="text-mc-text-secondary hover:text-red-400 px-2"
                  title="Close (Esc)"
                >
                  ✕ close
                </button>
              </div>
              <div className="flex-1 min-h-0 overflow-auto">
                <ChatPanel />
              </div>
            </div>
          )}
        </div>

        {/* Live Feed */}
        <LiveFeed />
      </div>

      {/* Debug Panel - only shows when debug mode enabled */}
      <SSEDebugPanel />
    </div>
  );
}
