'use client';

import { useEffect, useState } from 'react';
import { Header } from '@/components/Header';
import { AgentsSidebar } from '@/components/AgentsSidebar';
import { MissionQueue } from '@/components/MissionQueue';
import { LiveFeed } from '@/components/LiveFeed';
import { ChatPanel } from '@/components/ChatPanel';
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 hyflux-gradient rounded-xl flex items-center justify-center text-white text-3xl mb-4 animate-pulse">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
            </svg>
          </div>
          <p className="text-gray-500">Loading HyFlux Mission Control...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
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
                className="fixed bottom-6 right-80 z-50 px-4 py-2 hyflux-gradient text-white rounded-lg shadow-lg hover:opacity-90 flex items-center gap-2 text-sm font-medium transition-opacity"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                Open Chat
              </button>
            )}
          </div>

          {/* Chat Panel (conditionally shown) */}
          {showChat && (
            <div className="w-96 flex-shrink-0 border-l border-gray-200 flex flex-col bg-gray-50 h-full">
              <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white">
                <span className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  Mission Chat
                </span>
                <button
                  onClick={() => setShowChat(false)}
                  className="text-gray-400 hover:text-gray-600 px-2 py-1 rounded hover:bg-gray-100 transition-colors"
                  title="Close (Esc)"
                >
                  ✕
                </button>
              </div>
              <div className="flex-1 min-h-0 overflow-hidden">
                <ChatPanel />
              </div>
            </div>
          )}
        </div>

        {/* Live Feed */}
        <LiveFeed />
      </div>
    </div>
  );
}
