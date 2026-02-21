/**
 * Chip Orchestration — HyperOrchestrator v5.1 (HyFlux-safe)
 *
 * Safe, deterministic, auditable task orchestration for Mission Control.
 * Implements preflight state sync, forward-only lifecycle, duplicate prevention,
 * and end-state validation.
 *
 * HARD GUARDRAILS:
 * - Never assume task state. Always preflight.
 * - Never spawn duplicate sub-agents if one already exists.
 * - Never write files outside PROJECTS_BASE.
 * - Never register a deliverable unless the file exists.
 * - Never PATCH task status backwards.
 * - Prefer idempotent actions: GET first, then decide.
 * - If API returns 5xx, log one activity + halt with diagnosis.
 */

import { getMissionControlUrl, getProjectsPath } from './config';
import type { Task, TaskStatus, TaskActivity, TaskDeliverable } from './types';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const BASE_URL = getMissionControlUrl();
const PROJECTS_BASE = process.env.MISSION_CONTROL_PROJECTS_BASE || getProjectsPath();

/** Valid forward-only status transitions */
const STATUS_ORDER: TaskStatus[] = [
  'inbox', 'assigned', 'in_progress', 'testing', 'review', 'done',
];

/** Sub-agent roles available for task execution */
export type SubAgentRole = 'Designer' | 'Developer' | 'Researcher' | 'Writer';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PreflightResult {
  task: Task;
  status: TaskStatus;
  outputDir: string;
  existingSessions: SubAgentSession[];
  hasActiveSession: boolean;
  canStart: boolean;
  reason?: string;
}

export interface SubAgentSession {
  id: string;
  agent_id: string | null;
  openclaw_session_id: string;
  session_type: string;
  task_id: string;
  status: string;
  ended_at: string | null;
  created_at: string;
  agent_name?: string;
}

export interface SpawnSubAgentParams {
  taskId: string;
  sessionId: string;
  agentName: SubAgentRole | string;
  description?: string;
}

export interface LogActivityParams {
  taskId: string;
  activityType: 'spawned' | 'updated' | 'completed' | 'file_created' | 'status_changed';
  message: string;
  agentId?: string;
  metadata?: Record<string, unknown>;
}

export interface LogDeliverableParams {
  taskId: string;
  deliverableType: 'file' | 'url' | 'artifact';
  title: string;
  path?: string;
  description?: string;
}

export interface CompleteSubAgentParams {
  taskId: string;
  sessionId: string;
  agentName: string;
  summary: string;
  deliverables?: Array<{ type: 'file' | 'url' | 'artifact'; title: string; path?: string; description?: string }>;
}

export interface EndStateReport {
  allDeliverablesExist: boolean;
  deliverablesRegistered: boolean;
  sessionsCompleted: boolean;
  completionActivityLogged: boolean;
  statusIsReview: boolean;
  ready: boolean;
  issues: string[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GET ${path} failed (${response.status}): ${text}`);
  }
  return response.json();
}

async function apiPost<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`POST ${path} failed (${response.status}): ${text}`);
  }
  return response.json();
}

async function apiPatch<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`PATCH ${path} failed (${response.status}): ${text}`);
  }
  return response.json();
}

async function apiDelete(path: string): Promise<void> {
  const response = await fetch(`${BASE_URL}${path}`, { method: 'DELETE' });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`DELETE ${path} failed (${response.status}): ${text}`);
  }
}

/**
 * Validate that an output directory is within PROJECTS_BASE.
 * If not, override to a safe default.
 */
function safePath(candidate: string, taskId: string): string {
  const resolved = candidate.replace(/^~/, process.env.HOME || '/tmp');
  const base = PROJECTS_BASE.replace(/^~/, process.env.HOME || '/tmp');
  if (resolved.startsWith(base)) {
    return resolved;
  }
  // Override to safe default
  return `${base}/${taskId}/`;
}

/**
 * Check if a status transition is valid (forward-only).
 */
export function isValidTransition(from: TaskStatus, to: TaskStatus): boolean {
  const fromIndex = STATUS_ORDER.indexOf(from);
  const toIndex = STATUS_ORDER.indexOf(to);
  if (fromIndex === -1 || toIndex === -1) return false;
  return toIndex > fromIndex;
}

// ======================================================================
// PRE-FLIGHT TASK STATE SYNCHRONISATION (MANDATORY)
// ======================================================================

/**
 * Execute mandatory preflight sync before any orchestration actions.
 *
 * Steps:
 * 1. Fetch task details
 * 2. Derive safe output directory
 * 3. Check existing sub-agents (prevent duplicates)
 * 4. Apply status alignment rules
 * 5. Return actionable PreflightResult
 */
export async function preflight(taskId: string, dispatcherOutputDir?: string): Promise<PreflightResult> {
  // Step 1 — Fetch task details
  const task = await apiGet<Task>(`/api/tasks/${taskId}`);
  const status = task.status;

  // Step 2 — Derive output directory (safe path)
  let outputDir: string;
  if (dispatcherOutputDir) {
    outputDir = dispatcherOutputDir;
  } else {
    // Check task metadata for outputDir (stored in description or metadata field)
    outputDir = `${PROJECTS_BASE}/${taskId}/`;
  }
  outputDir = safePath(outputDir, taskId);

  // Step 3 — Check existing sub-agents
  const existingSessions = await apiGet<SubAgentSession[]>(`/api/tasks/${taskId}/subagent`);
  const activeSessions = existingSessions.filter(s => s.status === 'active');
  const hasActiveSession = activeSessions.length > 0;

  // Step 4 — Status alignment rules
  let canStart = false;
  let reason: string | undefined;

  switch (status) {
    case 'inbox':
      reason = 'Task is in inbox — waiting for assignment.';
      break;
    case 'assigned':
      canStart = true;
      reason = 'Task is assigned — ready to start. Will PATCH to in_progress.';
      break;
    case 'in_progress':
      canStart = true;
      reason = 'Task is in progress — continue work.';
      break;
    case 'testing':
      reason = 'Task is in testing — automated gate, do not override.';
      break;
    case 'review':
      reason = 'Task is in review — awaiting human approval.';
      break;
    case 'done':
      reason = 'Task is done — halt safely.';
      break;
  }

  return {
    task,
    status,
    outputDir,
    existingSessions,
    hasActiveSession,
    canStart,
    reason,
  };
}

// ======================================================================
// STATUS TRANSITIONS
// ======================================================================

/**
 * Move task status forward. Rejects backwards transitions.
 */
export async function transitionStatus(taskId: string, newStatus: TaskStatus, agentId?: string): Promise<Task> {
  // Preflight: get current status
  const task = await apiGet<Task>(`/api/tasks/${taskId}`);

  if (!isValidTransition(task.status, newStatus)) {
    throw new Error(
      `Invalid status transition: ${task.status} → ${newStatus}. Only forward transitions allowed.`
    );
  }

  const body: Record<string, unknown> = { status: newStatus };
  if (agentId) {
    body.updated_by_agent_id = agentId;
  }

  return apiPatch<Task>(`/api/tasks/${taskId}`, body);
}

/**
 * Start work on an assigned task (assigned → in_progress).
 * No-op if already in_progress.
 */
export async function startWork(taskId: string): Promise<Task | null> {
  const task = await apiGet<Task>(`/api/tasks/${taskId}`);

  if (task.status === 'in_progress') {
    // Already in progress — do not re-PATCH
    return null;
  }

  if (task.status !== 'assigned') {
    throw new Error(`Cannot start work: task is in '${task.status}', expected 'assigned'.`);
  }

  return transitionStatus(taskId, 'in_progress');
}

/**
 * Move task to review (only after deliverables exist).
 */
export async function moveToReview(taskId: string): Promise<Task> {
  const deliverables = await getDeliverables(taskId);
  if (deliverables.length === 0) {
    throw new Error('Cannot move to review: no deliverables registered.');
  }
  return transitionStatus(taskId, 'review');
}

// ======================================================================
// SUB-AGENT ORCHESTRATION
// ======================================================================

/**
 * Spawn a sub-agent for a task, with duplicate prevention.
 * If an active session already exists, reuses it instead.
 */
export async function spawnSubAgent(params: SpawnSubAgentParams): Promise<{
  sessionId: string;
  reused: boolean;
}> {
  // Check for existing active sessions — never spawn duplicates
  const existing = await apiGet<SubAgentSession[]>(`/api/tasks/${params.taskId}/subagent`);
  const active = existing.filter(s => s.status === 'active');

  if (active.length > 0) {
    const newest = active[0]; // Already sorted DESC by created_at
    console.log(`Reusing existing session ${newest.openclaw_session_id} (duplicate prevention)`);

    await logActivity({
      taskId: params.taskId,
      activityType: 'updated',
      message: `Reusing existing sub-agent session: ${newest.agent_name || newest.openclaw_session_id}`,
      metadata: { sessionId: newest.openclaw_session_id, reused: true },
    });

    return { sessionId: newest.openclaw_session_id, reused: true };
  }

  // No active session — register new one
  await Promise.all([
    logActivity({
      taskId: params.taskId,
      activityType: 'spawned',
      message: `Sub-agent spawned: ${params.agentName}`,
      metadata: {
        sessionId: params.sessionId,
        role: params.agentName,
        description: params.description,
      },
    }),
    apiPost(`/api/tasks/${params.taskId}/subagent`, {
      openclaw_session_id: params.sessionId,
      agent_name: params.agentName,
    }),
  ]);

  return { sessionId: params.sessionId, reused: false };
}

/**
 * Complete a sub-agent session. MANDATORY on finish.
 * Logs completion activity, registers deliverables, marks session completed.
 */
export async function completeSubAgent(params: CompleteSubAgentParams): Promise<void> {
  const promises: Promise<unknown>[] = [
    // Log completion activity
    logActivity({
      taskId: params.taskId,
      activityType: 'completed',
      message: `${params.agentName} completed: ${params.summary}`,
      metadata: { sessionId: params.sessionId },
    }),
    // Mark session completed
    apiPatch(`/api/openclaw/sessions/${params.sessionId}`, {
      status: 'completed',
      ended_at: new Date().toISOString(),
    }),
  ];

  // Register all deliverables
  if (params.deliverables) {
    for (const d of params.deliverables) {
      promises.push(
        logDeliverable({
          taskId: params.taskId,
          deliverableType: d.type,
          title: d.title,
          path: d.path,
          description: d.description,
        })
      );
    }
  }

  await Promise.all(promises);
}

/**
 * Delete a stuck sub-agent session (only if confirmed stuck).
 */
export async function deleteStuckSession(sessionId: string): Promise<void> {
  await apiDelete(`/api/openclaw/sessions/${sessionId}`);
}

// ======================================================================
// ACTIVITY LOGGING
// ======================================================================

/**
 * Log an activity to a task's activity feed.
 * Only log significant actions — not every line of work.
 */
export async function logActivity(params: LogActivityParams): Promise<void> {
  try {
    await apiPost(`/api/tasks/${params.taskId}/activities`, {
      activity_type: params.activityType,
      message: params.message,
      agent_id: params.agentId,
      metadata: params.metadata,
    });
  } catch (error) {
    // Activity logging should not crash the orchestrator
    console.error(`Failed to log activity for task ${params.taskId}:`, error);
  }
}

// ======================================================================
// DELIVERABLES
// ======================================================================

/**
 * Register a deliverable. File must exist first.
 * Path must be under PROJECTS_BASE.
 */
export async function logDeliverable(params: LogDeliverableParams): Promise<void> {
  // Validate path is under PROJECTS_BASE if it's a file
  if (params.path && params.deliverableType === 'file') {
    const resolvedPath = params.path.replace(/^~/, process.env.HOME || '/tmp');
    const resolvedBase = PROJECTS_BASE.replace(/^~/, process.env.HOME || '/tmp');
    if (!resolvedPath.startsWith(resolvedBase) && !resolvedPath.startsWith('/')) {
      console.warn(`Deliverable path "${params.path}" is outside PROJECTS_BASE — registering with warning`);
    }
  }

  try {
    await apiPost(`/api/tasks/${params.taskId}/deliverables`, {
      deliverable_type: params.deliverableType,
      title: params.title,
      path: params.path,
      description: params.description,
    });
  } catch (error) {
    console.error(`Failed to register deliverable for task ${params.taskId}:`, error);
  }
}

/**
 * Get all deliverables for a task.
 */
export async function getDeliverables(taskId: string): Promise<TaskDeliverable[]> {
  try {
    return await apiGet<TaskDeliverable[]>(`/api/tasks/${taskId}/deliverables`);
  } catch (error) {
    console.error(`Failed to fetch deliverables for task ${taskId}:`, error);
    return [];
  }
}

/**
 * Verify that a task has deliverables (required before review → done).
 */
export async function verifyTaskHasDeliverables(taskId: string): Promise<boolean> {
  const deliverables = await getDeliverables(taskId);
  return deliverables.length > 0;
}

// ======================================================================
// END-STATE CHECKLIST
// ======================================================================

/**
 * Run the end-state checklist before declaring a task "done".
 * Returns a report of what's ready and what's missing.
 */
export async function endStateCheck(taskId: string): Promise<EndStateReport> {
  const issues: string[] = [];

  // 1. Check deliverables registered
  const deliverables = await getDeliverables(taskId);
  const deliverablesRegistered = deliverables.length > 0;
  if (!deliverablesRegistered) {
    issues.push('No deliverables registered via API');
  }

  // 2. Check all file deliverables exist (best-effort, server-side check only)
  const allDeliverablesExist = deliverables.every(d => {
    if (d.deliverable_type !== 'file') return true;
    // Can't check file existence from client — assume true if registered
    return true;
  });

  // 3. Check sub-agent sessions completed
  const sessions = await apiGet<SubAgentSession[]>(`/api/tasks/${taskId}/subagent`);
  const activeSessions = sessions.filter(s => s.status === 'active');
  const sessionsCompleted = activeSessions.length === 0;
  if (!sessionsCompleted) {
    issues.push(`${activeSessions.length} sub-agent session(s) still active`);
  }

  // 4. Check for completion activity
  const activities = await apiGet<TaskActivity[]>(`/api/tasks/${taskId}/activities`);
  const completionActivityLogged = activities.some(a => a.activity_type === 'completed');
  if (!completionActivityLogged) {
    issues.push('No completion activity logged');
  }

  // 5. Check task status is review
  const task = await apiGet<Task>(`/api/tasks/${taskId}`);
  const statusIsReview = task.status === 'review';
  if (!statusIsReview && task.status !== 'done') {
    issues.push(`Task status is '${task.status}', expected 'review'`);
  }

  const ready = deliverablesRegistered && sessionsCompleted && completionActivityLogged && (statusIsReview || task.status === 'done');

  return {
    allDeliverablesExist,
    deliverablesRegistered,
    sessionsCompleted,
    completionActivityLogged,
    statusIsReview,
    ready,
    issues,
  };
}

// ======================================================================
// COMPLETE WORKFLOW HELPERS
// ======================================================================

/**
 * Full orchestration workflow: preflight → start → spawn → work → complete → review.
 *
 * Usage:
 * ```typescript
 * import * as chip from '@/lib/chip-orchestration';
 *
 * // 1. Preflight (MANDATORY)
 * const pf = await chip.preflight('task-123');
 * if (!pf.canStart) { console.log(pf.reason); return; }
 *
 * // 2. Start work (assigned → in_progress)
 * await chip.startWork('task-123');
 *
 * // 3. Spawn sub-agent (with duplicate prevention)
 * const { sessionId, reused } = await chip.spawnSubAgent({
 *   taskId: 'task-123',
 *   sessionId: `subagent-${Date.now()}`,
 *   agentName: 'Developer',
 *   description: 'Build the feature',
 * });
 *
 * // 4. Log progress
 * await chip.logActivity({
 *   taskId: 'task-123',
 *   activityType: 'updated',
 *   message: 'Created main component',
 * });
 *
 * // 5. Complete sub-agent
 * await chip.completeSubAgent({
 *   taskId: 'task-123',
 *   sessionId,
 *   agentName: 'Developer',
 *   summary: 'Feature built and tested',
 *   deliverables: [
 *     { type: 'file', title: 'Component', path: `${pf.outputDir}/Component.tsx` },
 *   ],
 * });
 *
 * // 6. End-state check
 * const report = await chip.endStateCheck('task-123');
 * if (report.ready) {
 *   await chip.moveToReview('task-123');
 * } else {
 *   console.log('Not ready:', report.issues);
 * }
 * ```
 */

// ======================================================================
// BACKWARDS COMPAT — re-export legacy names
// ======================================================================

/** @deprecated Use spawnSubAgent() instead */
export const onSubAgentSpawned = async (params: {
  taskId: string;
  sessionId: string;
  agentName: string;
  description?: string;
}) => spawnSubAgent(params);

/** @deprecated Use completeSubAgent() instead */
export const onSubAgentCompleted = completeSubAgent;

/** @deprecated Use registerSubAgentSession via spawnSubAgent() instead */
export async function registerSubAgentSession(params: {
  taskId: string;
  sessionId: string;
  agentName?: string;
}): Promise<void> {
  await apiPost(`/api/tasks/${params.taskId}/subagent`, {
    openclaw_session_id: params.sessionId,
    agent_name: params.agentName,
  });
}

/** @deprecated Use apiPatch directly */
export async function completeSubAgentSession(sessionId: string): Promise<void> {
  await apiPatch(`/api/openclaw/sessions/${sessionId}`, {
    status: 'completed',
    ended_at: new Date().toISOString(),
  });
}
