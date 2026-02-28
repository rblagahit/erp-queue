export type Priority = 'low' | 'medium' | 'high' | 'urgent';
export type Status = 'pending' | 'in-progress' | 'completed' | 'cancelled';

export interface QueueTask {
  id: string;
  title: string;
  description?: string;
  priority: Priority;
  status: Status;
  createdAt: number;
  updatedAt: number;
  category: string;
  assignee?: string;
}

export interface QueueStats {
  total: number;
  pending: number;
  inProgress: number;
  completed: number;
}
