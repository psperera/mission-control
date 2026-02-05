'use client';

import { useState, useEffect } from 'react';
import { 
  Folder, 
  Download, 
  CheckCircle, 
  Circle, 
  Clock, 
  AlertCircle,
  FileText,
  ChevronDown,
  ChevronRight,
  ExternalLink
} from 'lucide-react';
import { useMissionControl } from '@/lib/store';

interface Mission {
  id: string;
  name: string;
  status: string;
  progress: number;
  phases: MissionPhase[];
  deliverables: MissionDeliverable[];
}

interface MissionPhase {
  id: string;
  title: string;
  status: 'pending' | 'in_progress' | 'completed' | 'blocked';
  phase_number: number;
  assigned_agent_id?: string;
  deliverable_path?: string;
}

interface MissionDeliverable {
  id: string;
  title: string;
  file_path: string;
  file_type?: string;
  status: 'draft' | 'review' | 'approved' | 'archived';
  download_count: number;
}

export function MissionPanel() {
  const { agents } = useMissionControl();
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedMission, setExpandedMission] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    fetchMissions();
  }, []);

  const fetchMissions = async () => {
    try {
      const res = await fetch('/api/missions');
      if (res.ok) {
        const data = await res.json();
        setMissions(data.missions || []);
      }
    } catch (error) {
      console.error('Failed to fetch missions:', error);
    } finally {
      setLoading(false);
    }
  };

  const downloadFile = async (missionId: string, filePath: string, fileName: string) => {
    setDownloading(filePath);
    try {
      const res = await fetch(`/api/missions/${missionId}/download?file=${encodeURIComponent(filePath)}`);
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        alert('Failed to download file');
      }
    } catch (error) {
      console.error('Download error:', error);
      alert('Failed to download file');
    } finally {
      setDownloading(null);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <div className="flex items-center justify-center w-6 h-6 bg-green-500 rounded-full">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        );
      case 'in_progress':
        return <Clock className="w-6 h-6 text-yellow-500" />;
      case 'blocked':
        return <AlertCircle className="w-6 h-6 text-red-500" />;
      default:
        return <Circle className="w-6 h-6 text-gray-300" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      completed: 'bg-green-100 text-green-700',
      in_progress: 'bg-yellow-100 text-yellow-700',
      active: 'bg-blue-100 text-blue-700',
      pending: 'bg-gray-100 text-gray-600',
      blocked: 'bg-red-100 text-red-700',
    };
    return styles[status] || styles.pending;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-6 h-6 border-2 border-[#005EB8] border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
          <Folder className="w-5 h-5 text-[#005EB8]" />
          Active Missions
        </h2>
      </div>

      <div className="divide-y divide-gray-100">
        {missions.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <Folder className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>No active missions</p>
            <p className="text-sm text-gray-400 mt-1">
              Create missions in ~/openclaw/missions/
            </p>
          </div>
        ) : (
          missions.map((mission) => (
            <div key={mission.id} className="">
              {/* Mission Header */}
              <button
                onClick={() => setExpandedMission(expandedMission === mission.id ? null : mission.id)}
                className="w-full p-4 flex items-center gap-3 hover:bg-gray-50 transition-colors"
              >
                {expandedMission === mission.id ? (
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                )}
                
                <div className="flex-1 text-left">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-800">{mission.name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${getStatusBadge(mission.status)}`}>
                      {mission.status}
                    </span>
                  </div>
                  <div className="text-sm text-gray-500 mt-0.5">{mission.id}</div>
                </div>

                {/* Progress Bar */}
                <div className="w-32">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-gray-500">Progress</span>
                    <span className="font-medium text-gray-700">{mission.progress}%</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-[#005EB8] rounded-full transition-all duration-300"
                      style={{ width: `${mission.progress}%` }}
                    />
                  </div>
                </div>
              </button>

              {/* Expanded Content */}
              {expandedMission === mission.id && (
                <div className="px-4 pb-4 bg-gray-50/50">
                  {/* Phases */}
                  {mission.phases.length > 0 && (
                    <div className="mb-4">
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Phases</h4>
                      <div className="space-y-2">
                        {mission.phases.map((phase) => (
                          <div 
                            key={phase.id}
                            className={`flex items-center gap-3 p-3 rounded-lg border ${
                              phase.status === 'completed' 
                                ? 'bg-green-50 border-green-200' 
                                : phase.status === 'in_progress'
                                ? 'bg-yellow-50 border-yellow-200'
                                : 'bg-white border-gray-100'
                            }`}
                          >
                            {getStatusIcon(phase.status)}
                            <span className="text-sm font-medium text-gray-600 w-6">{phase.phase_number}.</span>
                            <span className={`text-sm flex-1 ${
                              phase.status === 'completed' ? 'text-green-800 font-medium' : 'text-gray-800'
                            }`}>{phase.title}</span>
                            <span className={`text-xs px-2 py-1 rounded-full ${
                              phase.status === 'completed' 
                                ? 'bg-green-100 text-green-700' 
                                : phase.status === 'in_progress'
                                ? 'bg-yellow-100 text-yellow-700'
                                : 'bg-gray-100 text-gray-500'
                            }`}>
                              {phase.status === 'completed' ? '✓ Completed' : phase.status === 'in_progress' ? 'In Progress' : 'Pending'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Deliverables */}
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Deliverables</h4>
                    <div className="space-y-1">
                      {/* README */}
                      <button
                        onClick={() => downloadFile(mission.id, 'README.md', `${mission.id}-README.md`)}
                        disabled={downloading === 'README.md'}
                        className="w-full flex items-center gap-3 p-2 bg-white rounded border border-gray-100 hover:border-[#005EB8] transition-colors text-left"
                      >
                        <FileText className="w-4 h-4 text-blue-500" />
                        <span className="text-sm text-gray-800 flex-1">README.md</span>
                        <span className="text-xs text-gray-400">Mission Overview</span>
                        {downloading === 'README.md' ? (
                          <div className="w-4 h-4 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Download className="w-4 h-4 text-gray-400" />
                        )}
                      </button>

                      {/* STATUS */}
                      <button
                        onClick={() => downloadFile(mission.id, 'STATUS.md', `${mission.id}-STATUS.md`)}
                        disabled={downloading === 'STATUS.md'}
                        className="w-full flex items-center gap-3 p-2 bg-white rounded border border-gray-100 hover:border-[#005EB8] transition-colors text-left"
                      >
                        <FileText className="w-4 h-4 text-green-500" />
                        <span className="text-sm text-gray-800 flex-1">STATUS.md</span>
                        <span className="text-xs text-gray-400">Progress Tracking</span>
                        {downloading === 'STATUS.md' ? (
                          <div className="w-4 h-4 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Download className="w-4 h-4 text-gray-400" />
                        )}
                      </button>

                      {/* Dynamic deliverables */}
                      {mission.deliverables?.map((deliverable) => (
                        <button
                          key={deliverable.id}
                          onClick={() => downloadFile(mission.id, deliverable.file_path, deliverable.title)}
                          disabled={downloading === deliverable.file_path}
                          className="w-full flex items-center gap-3 p-2 bg-white rounded border border-gray-100 hover:border-[#005EB8] transition-colors text-left"
                        >
                          <FileText className="w-4 h-4 text-gray-400" />
                          <span className="text-sm text-gray-800 flex-1">{deliverable.title}</span>
                          <span className={`text-xs px-2 py-0.5 rounded ${getStatusBadge(deliverable.status)}`}>
                            {deliverable.status}
                          </span>
                          {deliverable.download_count > 0 && (
                            <span className="text-xs text-gray-400">
                              {deliverable.download_count} downloads
                            </span>
                          )}
                          {downloading === deliverable.file_path ? (
                            <div className="w-4 h-4 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <Download className="w-4 h-4 text-gray-400" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Open Folder Link */}
                  <div className="mt-4 pt-3 border-t border-gray-200">
                    <a
                      href={`file://${process.env.HOME}/openclaw/missions/${mission.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-[#005EB8] hover:underline flex items-center gap-1"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Open mission folder
                    </a>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
