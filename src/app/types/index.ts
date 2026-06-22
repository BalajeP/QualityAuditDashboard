export interface Agent {
  id: string;
  name: string;
  email: string;
  team: string;   // kept for compat — used as shift value
  shift?: string; // Morning | Afternoon | Night
  status: 'active' | 'inactive';
}

export interface Category {
  id: string;
  name: string;
  maxScore: number;
  weight: number;
}

export interface AuditScore {
  categoryId: string;
  score: number;
  comments: string;
}

export interface Audit {
  id: string;
  agentId: string;
  agentName: string;
  date: string;
  scores: AuditScore[];
  totalScore: number;
  percentage: number;
  auditorName: string;
  callId?: string;
  duration?: string;
}

export interface WeeklyReport {
  weekStart: string;
  weekEnd: string;
  agentId: string;
  agentName: string;
  totalAudits: number;
  averageScore: number;
  trend: 'up' | 'down' | 'stable';
}
