'use client';

import { useState, useEffect } from 'react';
import { Plus, Zap, ZapOff, Loader2, FolderOpen } from 'lucide-react';
import { useMissionControl } from '@/lib/store';
import type { Agent, AgentStatus, OpenClawSession } from '@/lib/types';
import { AgentModal } from './AgentModal';
import { MissionPanel } from './MissionPanel';

type FilterTab = 'all' | 'working' | 'standby';

export function AgentsSidebar() {
  const { agents, selectedAgent, setSelectedAgent, agentOpenClawSessions, setAgentOpenClawSession } = useMissionControl();
  const [filter, setFilter] = useState<FilterTab>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [connectingAgentId, setConnectingAgentId] = useState<string | null>(null);
  const [activeSubAgents, setActiveSubAgents] = useState(0);

  // Load OpenClaw session status for all agents on mount
  useEffect(() => {
    const loadOpenClawSessions = async () => {
      for (const agent of agents) {
        try {
          const res = await fetch(`/api/agents/${agent.id}/openclaw`);
          if (res.ok) {
            const data = await res.json();
            if (data.linked && data.session) {
              setAgentOpenClawSession(agent.id, data.session as OpenClawSession);
            }
          }
        } catch (error) {
          console.error(`Failed to load OpenClaw session for ${agent.name}:`, error);
        }
      }
    };
    if (agents.length > 0) {
      loadOpenClawSessions();
    }
  }, [agents.length]);

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

    // Poll every 10 seconds to keep count updated
    const interval = setInterval(loadSubAgentCount, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleConnectToOpenClaw = async (agent: Agent, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent selecting the agent
    setConnectingAgentId(agent.id);

    try {
      const existingSession = agentOpenClawSessions[agent.id];

      if (existingSession) {
        // Disconnect
        const res = await fetch(`/api/agents/${agent.id}/openclaw`, { method: 'DELETE' });
        if (res.ok) {
          setAgentOpenClawSession(agent.id, null);
        }
      } else {
        // Connect
        const res = await fetch(`/api/agents/${agent.id}/openclaw`, { method: 'POST' });
        if (res.ok) {
          const data = await res.json();
          setAgentOpenClawSession(agent.id, data.session as OpenClawSession);
        } else {
          const error = await res.json();
          console.error('Failed to connect to OpenClaw:', error);
          alert(`Failed to connect: ${error.error || 'Unknown error'}`);
        }
      }
    } catch (error) {
      console.error('OpenClaw connection error:', error);
    } finally {
      setConnectingAgentId(null);
    }
  };

  const filteredAgents = agents.filter((agent) => {
    if (filter === 'all') return true;
    return agent.status === filter;
  });

  const getStatusDot = (status: AgentStatus) => {
    const styles = {
      standby: 'bg-gray-400',
      working: 'bg-green-500',
      offline: 'bg-red-500',
    };
    return styles[status] || styles.standby;
  };

  return (
    <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Agents</h3>
          <span className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full">
            {agents.length}
          </span>
        </div>

        {/* Active Sub-Agents Counter */}
        {activeSubAgents > 0 && (
          <div className="mb-3 px-3 py-2 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-green-500">●</span>
              <span className="text-gray-700">Active Sub-Agents:</span>
              <span className="font-bold text-green-600">{activeSubAgents}</span>
            </div>
          </div>
        )}

        {/* Filter Tabs */}
        <div className="flex gap-1">
          {(['all', 'working', 'standby'] as FilterTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-3 py-1 text-xs rounded-full capitalize transition-colors ${
                filter === tab
                  ? 'bg-[#005EB8] text-white font-medium'
                  : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Agent List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {filteredAgents.map((agent) => {
          const openclawSession = agentOpenClawSessions[agent.id];
          const isConnecting = connectingAgentId === agent.id;

          return (
            <div
              key={agent.id}
              className={`rounded-lg transition-colors ${
                selectedAgent?.id === agent.id ? 'bg-blue-50 ring-1 ring-[#005EB8]' : 'hover:bg-gray-50'
              }`}
            >
              <button
                onClick={() => {
                  setSelectedAgent(agent);
                  setEditingAgent(agent);
                }}
                className="w-full flex items-center gap-3 p-3 text-left"
              >
                {/* Avatar */}
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#005EB8] to-[#003D7A] flex items-center justify-center text-white text-sm font-bold relative">
                  {agent.avatar_emoji}
                  {openclawSession && (
                    <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-white" />
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-gray-900 truncate">{agent.name}</span>
                    {agent.is_master && (
                      <span className="text-[#FF6B35] text-xs">★</span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 truncate">
                    {agent.role}
                  </div>
                </div>

                {/* Status Dot */}
                <span className={`w-2 h-2 rounded-full ${getStatusDot(agent.status)}`} />
              </button>

              {/* OpenClaw Connect Button - show for master agents */}
              {agent.is_master && (
                <div className="px-3 pb-2">
                  <button
                    onClick={(e) => handleConnectToOpenClaw(agent, e)}
                    disabled={isConnecting}
                    className={`w-full flex items-center justify-center gap-2 px-2 py-1.5 rounded-md text-xs transition-colors ${
                      openclawSession
                        ? 'bg-green-100 text-green-700 hover:bg-green-200'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {isConnecting ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin" />
                        <span>Connecting...</span>
                      </>
                    ) : openclawSession ? (
                      <>
                        <Zap className="w-3 h-3" />
                        <span>OpenClaw Connected</span>
                      </>
                    ) : (
                      <>
                        <ZapOff className="w-3 h-3" />
                        <span>Connect OpenClaw</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Missions Section */}
      <div className="p-3 border-t border-gray-100">
        <MissionPanel />
      </div>

      {/* Add Agent Button */}
      <div className="p-3 border-t border-gray-100">
        <button
          onClick={() => setShowCreateModal(true)}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-[#005EB8] hover:bg-[#004a93] text-white rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Agent
        </button>
      </div>

      {/* Modals */}
      {showCreateModal && (
        <AgentModal onClose={() => setShowCreateModal(false)} />
      )}
      {editingAgent && (
        <AgentModal
          agent={editingAgent}
          onClose={() => setEditingAgent(null)}
        />
      )}
    </aside>
  );
}
