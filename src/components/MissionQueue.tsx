'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useMissionControl } from '@/lib/store';
import type { Task, TaskStatus } from '@/lib/types';
import { TaskModal } from './TaskModal';
import { formatDistanceToNow } from 'date-fns';

const COLUMNS: { id: TaskStatus; label: string; color: string }[] = [
  { id: 'inbox', label: 'Inbox', color: 'border-t-gray-400' },
  { id: 'assigned', label: 'Assigned', color: 'border-t-yellow-400' },
  { id: 'in_progress', label: 'In Progress', color: 'border-t-[#005EB8]' },
  { id: 'testing', label: 'Testing', color: 'border-t-purple-400' },
  { id: 'review', label: 'Review', color: 'border-t-orange-400' },
  { id: 'done', label: 'Done', color: 'border-t-green-500' },
];

export function MissionQueue() {
  const { tasks, updateTaskStatus, addEvent } = useMissionControl();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);

  const getTasksByStatus = (status: TaskStatus) =>
    tasks.filter((task) => task.status === status);

  const handleDragStart = (e: React.DragEvent, task: Task) => {
    setDraggedTask(task);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e: React.DragEvent, targetStatus: TaskStatus) => {
    e.preventDefault();
    if (!draggedTask || draggedTask.status === targetStatus) {
      setDraggedTask(null);
      return;
    }

    // Optimistic update
    updateTaskStatus(draggedTask.id, targetStatus);

    // Persist to API
    try {
      const res = await fetch(`/api/tasks/${draggedTask.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: targetStatus }),
      });

      if (res.ok) {
        // Add event
        addEvent({
          id: crypto.randomUUID(),
          type: targetStatus === 'done' ? 'task_completed' : 'task_status_changed',
          task_id: draggedTask.id,
          message: `Task "${draggedTask.title}" moved to ${targetStatus}`,
          created_at: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error('Failed to update task status:', error);
      // Revert on error
      updateTaskStatus(draggedTask.id, draggedTask.status);
    }

    setDraggedTask(null);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-gray-50">
      {/* Header */}
      <div className="px-6 py-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-800">Mission Queue</h2>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#005EB8] hover:bg-[#004a93] text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          New Task
        </button>
      </div>

      {/* Kanban Columns */}
      <div className="flex-1 flex gap-4 px-6 pb-6 overflow-x-auto">
        {COLUMNS.map((column) => {
          const columnTasks = getTasksByStatus(column.id);
          return (
            <div
              key={column.id}
              className={`w-72 flex-shrink-0 flex flex-col bg-white rounded-xl border border-gray-200 border-t-4 ${column.color} shadow-sm`}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, column.id)}
            >
              {/* Column Header */}
              <div className="p-3 border-b border-gray-100 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                  {column.label}
                </span>
                <span className="text-xs bg-gray-100 px-2 py-0.5 rounded-full text-gray-600 font-medium">
                  {columnTasks.length}
                </span>
              </div>

              {/* Tasks */}
              <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {columnTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onDragStart={handleDragStart}
                    onClick={() => setEditingTask(task)}
                    isDragging={draggedTask?.id === task.id}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modals */}
      {showCreateModal && (
        <TaskModal onClose={() => setShowCreateModal(false)} />
      )}
      {editingTask && (
        <TaskModal task={editingTask} onClose={() => setEditingTask(null)} />
      )}
    </div>
  );
}

interface TaskCardProps {
  task: Task;
  onDragStart: (e: React.DragEvent, task: Task) => void;
  onClick: () => void;
  isDragging: boolean;
}

function TaskCard({ task, onDragStart, onClick, isDragging }: TaskCardProps) {
  const priorityColors = {
    low: 'bg-gray-100 text-gray-600',
    normal: 'bg-blue-50 text-blue-600',
    high: 'bg-yellow-50 text-yellow-600',
    urgent: 'bg-red-50 text-red-600',
  };

  const priorityDots = {
    low: 'bg-gray-300',
    normal: 'bg-blue-400',
    high: 'bg-yellow-400',
    urgent: 'bg-red-500',
  };

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, task)}
      onClick={onClick}
      className={`bg-white border border-gray-200 rounded-lg p-3 cursor-pointer hover:shadow-md hover:border-[#005EB8]/30 transition-all ${
        isDragging ? 'opacity-50 scale-95' : ''
      }`}
    >
      {/* Priority dot + Title */}
      <div className="flex items-start gap-2 mb-2">
        <span className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${priorityDots[task.priority]}`} />
        <h4 className="text-sm font-medium text-gray-800 line-clamp-2 leading-tight">{task.title}</h4>
      </div>

      {/* Agent */}
      {task.assigned_agent && (
        <div className="flex items-center gap-1.5 mt-2">
          <span className="text-sm">{(task.assigned_agent as unknown as { avatar_emoji: string }).avatar_emoji}</span>
          <span className="text-xs text-gray-500 truncate">
            {(task.assigned_agent as unknown as { name: string }).name}
          </span>
        </div>
      )}

      {/* Footer: Priority + Time */}
      <div className="flex items-center justify-between mt-3">
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${priorityColors[task.priority]}`}>
          {task.priority}
        </span>
        <span className="text-xs text-gray-400">
          {formatDistanceToNow(new Date(task.created_at), { addSuffix: true })}
        </span>
      </div>
    </div>
  );
}
