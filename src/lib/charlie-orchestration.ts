/**
 * Charlie's Orchestration Helper — LEGACY COMPAT
 *
 * This module re-exports from chip-orchestration.ts (HyperOrchestrator v5.1).
 * New code should import from '@/lib/chip-orchestration' directly.
 *
 * @deprecated Use '@/lib/chip-orchestration' instead.
 */

export {
  // Core workflow
  preflight,
  startWork,
  moveToReview,
  transitionStatus,
  endStateCheck,

  // Sub-agent management
  spawnSubAgent,
  completeSubAgent,
  deleteStuckSession,

  // Activity & deliverables
  logActivity,
  logDeliverable,
  getDeliverables,
  verifyTaskHasDeliverables,

  // Status validation
  isValidTransition,

  // Legacy compat names
  onSubAgentSpawned,
  onSubAgentCompleted,
  registerSubAgentSession,
  completeSubAgentSession,

  // Types
  type PreflightResult,
  type SubAgentSession,
  type SubAgentRole,
  type SpawnSubAgentParams,
  type LogActivityParams,
  type LogDeliverableParams,
  type CompleteSubAgentParams,
  type EndStateReport,
} from './chip-orchestration';
