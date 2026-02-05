/**
 * Settings Page
 * Configure Mission Control paths, URLs, and preferences
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Settings, Save, RotateCcw, FolderOpen, Link as LinkIcon, Wand2 } from 'lucide-react';
import { getConfig, updateConfig, resetConfig, type MissionControlConfig } from '@/lib/config';
import { AgentCreationWizard } from '@/components/AgentCreationWizard';

export default function SettingsPage() {
  const router = useRouter();
  const [config, setConfig] = useState<MissionControlConfig | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setConfig(getConfig());
  }, []);

  const handleSave = async () => {
    if (!config) return;

    setIsSaving(true);
    setError(null);
    setSaveSuccess(false);

    try {
      updateConfig(config);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    if (confirm('Reset all settings to defaults? This cannot be undone.')) {
      resetConfig();
      setConfig(getConfig());
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    }
  };

  const handleChange = (field: keyof MissionControlConfig, value: string) => {
    if (!config) return;
    setConfig({ ...config, [field]: value });
  };

  if (!config) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header - matching main page Header style */}
      <div className="border-b border-gray-200 bg-white">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/')}
              className="p-2 hover:bg-gray-100 rounded text-gray-500 transition-colors"
              title="Back to Mission Control"
            >
              ← Back
            </button>
            <Settings className="w-6 h-6 text-[#005EB8]" />
            <h1 className="text-2xl font-bold text-gray-800">Settings</h1>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleReset}
              className="px-4 py-2 border border-gray-200 rounded hover:bg-gray-50 text-gray-600 flex items-center gap-2 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              Reset to Defaults
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-2 bg-[#005EB8] text-white rounded hover:bg-[#003D7A] flex items-center gap-2 disabled:opacity-50 transition-colors"
            >
              <Save className="w-4 h-4" />
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Success Message */}
        {saveSuccess && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
            ✓ Settings saved successfully
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600">
            ✗ {error}
          </div>
        )}

        {/* Workspace Paths */}
        <section className="mb-8 p-6 bg-white border border-gray-200 rounded-lg shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <FolderOpen className="w-5 h-5 text-[#005EB8]" />
            <h2 className="text-xl font-semibold text-gray-800">Workspace Paths</h2>
          </div>
          <p className="text-sm text-gray-500 mb-4">
            Configure where Mission Control stores projects and deliverables.
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Workspace Base Path
              </label>
              <input
                type="text"
                value={config.workspaceBasePath}
                onChange={(e) => handleChange('workspaceBasePath', e.target.value)}
                placeholder="~/Documents/Shared"
                className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded text-gray-700 focus:border-[#005EB8] focus:outline-none focus:ring-1 focus:ring-[#005EB8]"
              />
              <p className="text-xs text-gray-400 mt-1">
                Base directory for all Mission Control files. Use ~ for home directory.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Projects Path
              </label>
              <input
                type="text"
                value={config.projectsPath}
                onChange={(e) => handleChange('projectsPath', e.target.value)}
                placeholder="~/Documents/Shared/projects"
                className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded text-gray-700 focus:border-[#005EB8] focus:outline-none focus:ring-1 focus:ring-[#005EB8]"
              />
              <p className="text-xs text-gray-400 mt-1">
                Directory where project folders are created. Each project gets its own folder.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Default Project Name
              </label>
              <input
                type="text"
                value={config.defaultProjectName}
                onChange={(e) => handleChange('defaultProjectName', e.target.value)}
                placeholder="mission-control"
                className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded text-gray-700 focus:border-[#005EB8] focus:outline-none focus:ring-1 focus:ring-[#005EB8]"
              />
              <p className="text-xs text-gray-400 mt-1">
                Default name for new projects. Can be changed per project.
              </p>
            </div>
          </div>
        </section>

        {/* API Configuration */}
        <section className="mb-8 p-6 bg-white border border-gray-200 rounded-lg shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <LinkIcon className="w-5 h-5 text-[#005EB8]" />
            <h2 className="text-xl font-semibold text-gray-800">API Configuration</h2>
          </div>
          <p className="text-sm text-gray-500 mb-4">
            Configure Mission Control API URL for agent orchestration.
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Mission Control URL
              </label>
              <input
                type="text"
                value={config.missionControlUrl}
                onChange={(e) => handleChange('missionControlUrl', e.target.value)}
                placeholder="http://localhost:3000"
                className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded text-gray-700 focus:border-[#005EB8] focus:outline-none focus:ring-1 focus:ring-[#005EB8]"
              />
              <p className="text-xs text-gray-400 mt-1">
                URL where Mission Control is running. Auto-detected by default. Change for remote access.
              </p>
            </div>
          </div>
        </section>

        {/* Agent Creation Wizard */}
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Wand2 className="w-5 h-5 text-[#005EB8]" />
            <h2 className="text-xl font-semibold text-gray-800">Agent Creation</h2>
          </div>
          <p className="text-sm text-gray-500 mb-4">
            Create new AI agents with properly configured SOUL.md, USER.md, and AGENTS.md files.
          </p>
          <AgentCreationWizard />
        </section>

        {/* Environment Variables Note */}
        <section className="p-6 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="text-lg font-semibold text-blue-700 mb-2">
            📝 Environment Variables
          </h3>
          <p className="text-sm text-blue-600 mb-3">
            Some settings are also configurable via environment variables in <code className="px-2 py-1 bg-white rounded border border-blue-200">.env.local</code>:
          </p>
          <ul className="text-sm text-blue-600 space-y-1 ml-4 list-disc">
            <li><code className="px-1 py-0.5 bg-white rounded border border-blue-200">MISSION_CONTROL_URL</code> - API URL override</li>
            <li><code className="px-1 py-0.5 bg-white rounded border border-blue-200">WORKSPACE_BASE_PATH</code> - Base workspace directory</li>
            <li><code className="px-1 py-0.5 bg-white rounded border border-blue-200">PROJECTS_PATH</code> - Projects directory</li>
            <li><code className="px-1 py-0.5 bg-white rounded border border-blue-200">OPENCLAW_GATEWAY_URL</code> - Gateway WebSocket URL</li>
            <li><code className="px-1 py-0.5 bg-white rounded border border-blue-200">OPENCLAW_GATEWAY_TOKEN</code> - Gateway auth token</li>
          </ul>
          <p className="text-xs text-blue-500 mt-3">
            Environment variables take precedence over UI settings for server-side operations.
          </p>
        </section>
      </div>
    </div>
  );
}
