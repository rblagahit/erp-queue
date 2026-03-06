export interface QueueEntry {
  id: string;
  name: string;
  branch: string;
  service: string;
  priority: string;
  sourceChannel?: string | null;
  slaTargetMinutes?: number | null;
  checkInTime: string;
  status: 'Waiting' | 'Processing' | 'Completed' | 'No Show';
  firstCalledTime?: string | null;
  calledTime: string | null;
  completedTime: string | null;
  reassignCount?: number | null;
  handledByUserId?: string | null;
  handledByEmail?: string | null;
  outcome?: string | null;
  breachReason?: string | null;
  noShowReason?: string | null;
  notes?: string | null;
}

export type QueueApiEntry = QueueEntry & {
  source_channel?: string | null;
  sla_target_minutes?: number | null;
  first_called_time?: string | null;
  reassign_count?: number | null;
  handled_by_user_id?: string | null;
  handled_by_email?: string | null;
  breach_reason?: string | null;
  no_show_reason?: string | null;
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
