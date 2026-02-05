'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Settings, MessageCircle } from 'lucide-react';
import { useMissionControl } from '@/lib/store';
import { format } from 'date-fns';
import { WorkspaceSelector } from './WorkspaceSelector';

export function Header() {
  const router = useRouter();
  const { agents, tasks, isOnline, selectedBusiness, setSelectedBusiness } = useMissionControl();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [activeSubAgents, setActiveSubAgents] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Load active sub-agent count
  useEffect(() => {
    const loadSubAgentCount = async () => {
      try {
        const res = await fetch('/api/openclaw/sessions?session_type=subagent&status=active');
        if (res.ok) {
          const sessions = await res.json();
          setActiveSubAgents(sessions.length);
        }
      } catch (error) {
        console.error('Failed to load sub-agent count:', error);
      }
    };

    loadSubAgentCount();

    // Poll every 10 seconds
    const interval = setInterval(loadSubAgentCount, 10000);
    return () => clearInterval(interval);
  }, []);

  const workingAgents = agents.filter((a) => a.status === 'working').length;
  const activeAgents = workingAgents + activeSubAgents;
  const tasksInQueue = tasks.filter((t) => t.status !== 'done' && t.status !== 'review').length;

  return (
    <header className="hyflux-gradient text-white px-6 py-4 flex items-center justify-between shadow-lg">
      {/* Left: Logo & Title */}
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 bg-white/10 rounded-lg flex items-center justify-center">
          <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
          </svg>
        </div>
        <div>
          <h1 className="text-2xl font-bold">HYFLUX</h1>
          <p className="text-sm text-white/70">Mission Control</p>
        </div>

        {/* Workspace Selector */}
        <div className="ml-4">
          <WorkspaceSelector
            selectedWorkspace={selectedBusiness || 'default'}
            onWorkspaceChange={(workspaceId) => setSelectedBusiness(workspaceId)}
            variant="dark"
          />
        </div>
      </div>

      {/* Center: Stats */}
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2 bg-white/10 px-4 py-2 rounded-full">
          <span className="w-2 h-2 bg-green-400 rounded-full pulse-dot"></span>
          <span className="text-sm">{isOnline ? 'System Online' : 'System Offline'}</span>
        </div>
        <div className="flex items-center gap-2 bg-white/10 px-4 py-2 rounded-full">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <span className="text-sm">{tasksInQueue} Tasks</span>
        </div>
        <div className="flex items-center gap-2 bg-white/10 px-4 py-2 rounded-full">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
          <span className="text-sm">{activeAgents} Active</span>
        </div>
      </div>

      {/* Right: Time & Settings */}
      <div className="flex items-center gap-4">
        <span className="text-white/70 text-sm font-mono">
          {format(currentTime, 'HH:mm:ss')}
        </span>
        <button
          onClick={() => router.push('/settings')}
          className="relative w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
          title="Settings"
        >
          <Settings className="w-5 h-5" />
        </button>
      </div>
    </header>
  );
}
