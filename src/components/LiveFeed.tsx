'use client';

import { useState } from 'react';
import { Activity } from 'lucide-react';
import { useMissionControl } from '@/lib/store';
import type { Event } from '@/lib/types';
import { formatDistanceToNow } from 'date-fns';

type FeedFilter = 'all' | 'tasks' | 'agents';

export function LiveFeed() {
  const { events } = useMissionControl();
  const [filter, setFilter] = useState<FeedFilter>('all');

  const filteredEvents = events.filter((event) => {
    if (filter === 'all') return true;
    if (filter === 'tasks')
      return ['task_created', 'task_assigned', 'task_status_changed', 'task_completed'].includes(
        event.type
      );
    if (filter === 'agents')
      return ['agent_joined', 'agent_status_changed', 'message_sent'].includes(event.type);
    return true;
  });

  return (
    <aside className="w-80 bg-white border-l border-gray-200 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-center gap-2 mb-3">
          <Activity className="w-4 h-4 text-[#005EB8]" />
          <span className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Live Feed</span>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-1">
          {(['all', 'tasks', 'agents'] as FeedFilter[]).map((tab) => (
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

      {/* Events List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {filteredEvents.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-sm">
            No events yet
          </div>
        ) : (
          filteredEvents.map((event) => (
            <EventItem key={event.id} event={event} />
          ))
        )}
      </div>
    </aside>
  );
}

function EventItem({ event }: { event: Event }) {
  const getEventIcon = (type: string) => {
    switch (type) {
      case 'task_created':
        return '📋';
      case 'task_assigned':
        return '👤';
      case 'task_status_changed':
        return '🔄';
      case 'task_completed':
        return '✅';
      case 'message_sent':
        return '💬';
      case 'agent_joined':
        return '🎉';
      case 'agent_status_changed':
        return '🔔';
      case 'system':
        return '⚙️';
      default:
        return '📌';
    }
  };

  const getEventColor = (type: string) => {
    switch (type) {
      case 'task_completed':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'task_created':
        return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'task_assigned':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'message_sent':
        return 'text-[#005EB8] bg-blue-50 border-blue-200';
      case 'agent_joined':
        return 'text-purple-600 bg-purple-50 border-purple-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const colorClasses = getEventColor(event.type);

  return (
    <div className={`p-3 rounded-lg border ${colorClasses} animate-slide-in`}>
      <div className="flex items-start gap-2">
        <span className="text-lg">{getEventIcon(event.type)}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-800 leading-snug">
            {event.message}
          </p>
          <span className="text-xs text-gray-400 mt-1 block">
            {formatDistanceToNow(new Date(event.created_at), { addSuffix: true })}
          </span>
        </div>
      </div>
    </div>
  );
}
