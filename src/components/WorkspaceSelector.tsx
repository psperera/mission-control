'use client';

import { useState, useEffect } from 'react';
import { ChevronDown, Plus, Settings, Trash2 } from 'lucide-react';

interface Workspace {
  id: string;
  name: string;
  description: string;
  email_recipient: string;
  email_enabled: number;
}

interface WorkspaceSelectorProps {
  selectedWorkspace: string;
  onWorkspaceChange: (workspaceId: string) => void;
  variant?: 'light' | 'dark';
}

export function WorkspaceSelector({ selectedWorkspace, onWorkspaceChange, variant = 'light' }: WorkspaceSelectorProps) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [newWorkspaceEmail, setNewWorkspaceEmail] = useState('');
  const [editingWorkspace, setEditingWorkspace] = useState<Workspace | null>(null);

  useEffect(() => {
    fetchWorkspaces();
  }, []);

  const fetchWorkspaces = async () => {
    try {
      const res = await fetch('/api/workspaces');
      if (res.ok) {
        const data = await res.json();
        setWorkspaces(data.workspaces || []);
        // Auto-select first workspace if none selected
        if (!selectedWorkspace && data.workspaces?.length > 0) {
          onWorkspaceChange(data.workspaces[0].id);
        }
      }
    } catch (error) {
      console.error('Failed to fetch workspaces:', error);
    } finally {
      setLoading(false);
    }
  };

  const createWorkspace = async () => {
    if (!newWorkspaceName.trim()) return;

    try {
      const res = await fetch('/api/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newWorkspaceName,
          email_recipient: newWorkspaceEmail
        })
      });

      if (res.ok) {
        const data = await res.json();
        setWorkspaces([...workspaces, data.workspace]);
        onWorkspaceChange(data.workspace.id);
        setShowCreateModal(false);
        setNewWorkspaceName('');
        setNewWorkspaceEmail('');
      }
    } catch (error) {
      console.error('Failed to create workspace:', error);
    }
  };

  const deleteWorkspace = async (id: string) => {
    if (!confirm('Are you sure? This will delete the workspace and all its tasks.')) return;

    try {
      const res = await fetch(`/api/workspaces/${id}`, {
        method: 'DELETE'
      });

      if (res.ok) {
        setWorkspaces(workspaces.filter(w => w.id !== id));
        if (selectedWorkspace === id && workspaces.length > 1) {
          onWorkspaceChange(workspaces.find(w => w.id !== id)?.id || 'default');
        }
      }
    } catch (error) {
      console.error('Failed to delete workspace:', error);
    }
  };

  const updateWorkspaceSettings = async () => {
    if (!editingWorkspace) return;

    try {
      const res = await fetch(`/api/workspaces/${editingWorkspace.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email_recipient: editingWorkspace.email_recipient,
          email_enabled: editingWorkspace.email_enabled
        })
      });

      if (res.ok) {
        setWorkspaces(workspaces.map(w => 
          w.id === editingWorkspace.id ? editingWorkspace : w
        ));
        setShowSettingsModal(false);
        setEditingWorkspace(null);
      }
    } catch (error) {
      console.error('Failed to update workspace:', error);
    }
  };

  const currentWorkspace = workspaces.find(w => w.id === selectedWorkspace);

  if (loading) {
    return <div className="text-sm text-gray-500">Loading...</div>;
  }

  return (
    <div className="relative">
      {/* Dropdown Trigger */}
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
          variant === 'dark'
            ? 'bg-white/10 border border-white/20 text-white hover:bg-white/20'
            : 'bg-white border border-gray-200 text-gray-700 hover:border-[#005EB8]'
        }`}
      >
        <span className="font-medium truncate max-w-[150px]">
          {currentWorkspace?.name || 'Select Workspace'}
        </span>
        <ChevronDown className={`w-4 h-4 ${variant === 'dark' ? 'text-white/70' : 'text-gray-400'}`} />
      </button>

      {/* Dropdown Menu */}
      {showDropdown && (
        <div className="absolute top-full left-0 mt-1 w-72 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
          <div className="p-2">
            <div className="text-xs font-medium text-gray-500 px-3 py-2 uppercase tracking-wider">
              Workspaces
            </div>
            {workspaces.map(workspace => (
              <div
                key={workspace.id}
                className={`flex items-center gap-2 px-3 py-2 rounded cursor-pointer ${
                  selectedWorkspace === workspace.id
                    ? 'bg-blue-50'
                    : 'hover:bg-gray-50'
                }`}
                onClick={() => {
                  onWorkspaceChange(workspace.id);
                  setShowDropdown(false);
                }}
              >
                <div className="flex-1">
                  <div className={`font-medium ${selectedWorkspace === workspace.id ? 'text-blue-700' : 'text-gray-900'}`}>
                    {workspace.name}
                  </div>
                  {workspace.email_recipient && (
                    <div className="text-xs text-gray-600">
                      {workspace.email_enabled ? '✓' : '✗'} {workspace.email_recipient}
                    </div>
                  )}
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingWorkspace(workspace);
                    setShowSettingsModal(true);
                    setShowDropdown(false);
                  }}
                  className="p-1 hover:bg-gray-200 rounded"
                >
                  <Settings className="w-4 h-4 text-gray-400" />
                </button>
                {workspaces.length > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteWorkspace(workspace.id);
                    }}
                    className="p-1 hover:bg-red-100 rounded"
                  >
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </button>
                )}
              </div>
            ))}
          </div>
          <div className="border-t border-gray-100 p-2">
            <button
              onClick={() => {
                setShowCreateModal(true);
                setShowDropdown(false);
              }}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-[#005EB8] hover:bg-blue-50 rounded"
            >
              <Plus className="w-4 h-4" />
              Create New Workspace
            </button>
          </div>
        </div>
      )}

      {/* Create Workspace Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96">
            <h3 className="text-lg font-semibold mb-4">Create New Workspace</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Workspace Name
                </label>
                <input
                  type="text"
                  value={newWorkspaceName}
                  onChange={(e) => setNewWorkspaceName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-[#005EB8] text-gray-900"
                  placeholder="e.g., ESAB-Eddyfi Analysis"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email Recipient (optional)
                </label>
                <input
                  type="email"
                  value={newWorkspaceEmail}
                  onChange={(e) => setNewWorkspaceEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-[#005EB8] text-gray-900"
                  placeholder="stakeholder@company.com"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Deliverables will be sent to this email
                </p>
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={createWorkspace}
                disabled={!newWorkspaceName.trim()}
                className="flex-1 px-4 py-2 bg-[#005EB8] text-white rounded-lg hover:bg-[#004a93] disabled:opacity-50"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettingsModal && editingWorkspace && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96">
            <h3 className="text-lg font-semibold mb-4">Workspace Settings</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email Recipient
                </label>
                <input
                  type="email"
                  value={editingWorkspace.email_recipient || ''}
                  onChange={(e) => setEditingWorkspace({
                    ...editingWorkspace,
                    email_recipient: e.target.value
                  })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-[#005EB8] text-gray-900"
                  placeholder="stakeholder@company.com"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="email-enabled"
                  checked={editingWorkspace.email_enabled === 1}
                  onChange={(e) => setEditingWorkspace({
                    ...editingWorkspace,
                    email_enabled: e.target.checked ? 1 : 0
                  })}
                  className="w-4 h-4"
                />
                <label htmlFor="email-enabled" className="text-sm text-gray-700">
                  Enable email notifications
                </label>
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button
                onClick={() => setShowSettingsModal(false)}
                className="flex-1 px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={updateWorkspaceSettings}
                className="flex-1 px-4 py-2 bg-[#005EB8] text-white rounded-lg hover:bg-[#004a93]"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
