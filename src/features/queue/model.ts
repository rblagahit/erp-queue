export interface QueueEntry {
  id: string;
  tenantId?: string | null;
  name: string;
  branch: string;
  service: string;
  priority: string;
  sourceChannel?: string | null;
  slaTargetMinutes?: number | null;
  checkInTime: string;
  status: 'Waiting' | 'Processing' | 'On Hold' | 'Completed' | 'No Show';
  firstCalledTime?: string | null;
  calledTime: string | null;
  completedTime: string | null;
  pausedAt?: string | null;
  reassignCount?: number | null;
  handledByUserId?: string | null;
  handledByEmail?: string | null;
  outcome?: string | null;
  breachReason?: string | null;
  noShowReason?: string | null;
  pauseReason?: string | null;
  resolutionCode?: string | null;
  notes?: string | null;
}

export type QueueApiEntry = QueueEntry & {
  tenant_id?: string | null;
  source_channel?: string | null;
  sla_target_minutes?: number | null;
  first_called_time?: string | null;
  paused_at?: string | null;
  reassign_count?: number | null;
  handled_by_user_id?: string | null;
  handled_by_email?: string | null;
  breach_reason?: string | null;
  no_show_reason?: string | null;
  pause_reason?: string | null;
  resolution_code?: string | null;
};

export const SLA_THRESHOLD_MINUTES = 10;

export const BREACH_REASON_OPTIONS = [
  'High volume',
  'Complex case',
  'Customer unavailable',
  'System issue',
  'Staff shortage',
  'Manual verification',
];

export const NO_SHOW_REASON_OPTIONS = [
  'Customer unavailable',
  'Left the premises',
  'Called multiple times',
  'Incomplete requirements',
  'Requested cancellation',
];

export const PAUSE_REASON_OPTIONS = [
  'Awaiting documents',
  'Customer stepped away',
  'Escalation review',
  'System verification',
  'Counter handoff',
];

export const RESOLUTION_CODE_OPTIONS = [
  'served',
  'redirected',
  'escalated',
  'follow_up_required',
  'incomplete_requirements',
];
