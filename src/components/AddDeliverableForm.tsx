/**
 * AddDeliverableForm Component
 * Form for manually adding deliverables to a task
 */

'use client';

import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import type { TaskDeliverable } from '@/lib/types';

interface AddDeliverableFormProps {
  taskId: string;
  onDeliverableAdded: (deliverable: TaskDeliverable) => void;
}

export function AddDeliverableForm({ taskId, onDeliverableAdded }: AddDeliverableFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    deliverable_type: 'file' as 'file' | 'url' | 'artifact',
    title: '',
    path: '',
    description: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/tasks/${taskId}/deliverables`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deliverable_type: form.deliverable_type,
          title: form.title.trim(),
          path: form.path.trim() || null,
          description: form.description.trim() || null,
        }),
      });

      if (res.ok) {
        const deliverable = await res.json();
        onDeliverableAdded(deliverable);
        setForm({
          deliverable_type: 'file',
          title: '',
          path: '',
          description: '',
        });
        setIsOpen(false);
      } else {
        const error = await res.json();
        alert(`Failed to add deliverable: ${error.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Failed to add deliverable:', error);
      alert('Failed to add deliverable. Check console for details.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-mc-accent/10 border border-dashed border-mc-accent/30 rounded-lg text-mc-accent hover:bg-mc-accent/20 transition-colors"
      >
        <Plus className="w-4 h-4" />
        Add Deliverable
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-mc-bg rounded-lg border border-mc-border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-sm">Add New Deliverable</h4>
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="p-1 hover:bg-mc-bg-tertiary rounded"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Type Selection */}
      <div>
        <label className="block text-xs font-medium text-mc-text-secondary mb-1">Type</label>
        <div className="flex gap-2">
          {(['file', 'url', 'artifact'] as const).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setForm({ ...form, deliverable_type: type })}
              className={`px-3 py-1.5 text-xs rounded capitalize ${
                form.deliverable_type === type
                  ? 'bg-mc-accent text-mc-bg font-medium'
                  : 'bg-mc-bg-tertiary text-mc-text-secondary hover:text-mc-text'
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* Title */}
      <div>
        <label className="block text-xs font-medium text-mc-text-secondary mb-1">Title *</label>
        <input
          type="text"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          required
          placeholder="e.g., Research Report, Dashboard URL"
          className="w-full bg-mc-bg border border-mc-border rounded px-3 py-2 text-sm focus:outline-none focus:border-mc-accent"
        />
      </div>

      {/* Path/URL */}
      <div>
        <label className="block text-xs font-medium text-mc-text-secondary mb-1">
          {form.deliverable_type === 'url' ? 'URL' : 'File Path'}
        </label>
        <input
          type="text"
          value={form.path}
          onChange={(e) => setForm({ ...form, path: e.target.value })}
          placeholder={
            form.deliverable_type === 'url'
              ? 'https://example.com/report'
              : '/path/to/file.pdf'
          }
          className="w-full bg-mc-bg border border-mc-border rounded px-3 py-2 text-sm focus:outline-none focus:border-mc-accent"
        />
      </div>

      {/* Description */}
      <div>
        <label className="block text-xs font-medium text-mc-text-secondary mb-1">Description</label>
        <textarea
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          rows={2}
          placeholder="Optional description..."
          className="w-full bg-mc-bg border border-mc-border rounded px-3 py-2 text-sm focus:outline-none focus:border-mc-accent resize-none"
        />
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-2">
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="flex-1 px-3 py-2 text-sm text-mc-text-secondary hover:text-mc-text rounded hover:bg-mc-bg-tertiary"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting || !form.title.trim()}
          className="flex-1 px-3 py-2 bg-mc-accent text-mc-bg rounded text-sm font-medium hover:bg-mc-accent/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? 'Adding...' : 'Add Deliverable'}
        </button>
      </div>
    </form>
  );
}
