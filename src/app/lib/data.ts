import { Agent, Category, Audit } from '../types';

export const defaultCategories: Category[] = [
  { id: '1', name: 'Communication Skills', maxScore: 20, weight: 1 },
  { id: '2', name: 'Product Knowledge', maxScore: 20, weight: 1 },
  { id: '3', name: 'Problem Solving', maxScore: 20, weight: 1 },
  { id: '4', name: 'Professionalism', maxScore: 15, weight: 0.75 },
  { id: '5', name: 'Call Handling', maxScore: 15, weight: 0.75 },
  { id: '6', name: 'Compliance', maxScore: 10, weight: 0.5 },
];

// Agents are now managed via the Scores (ScoringGrid) page and sync here in future
export const defaultAgents: Agent[] = [
  { id: 'agent-1', name: 'Agent 1', email: 'agent1@company.com', team: 'Morning', status: 'active' }
];

// Returns empty — real audits come from New Audit form
export const generateSampleAudits = (): Audit[] => [];

// Versioned keys — bump version to clear old cached sample data
const V = 'v2';
export const STORAGE_KEYS = {
  AGENTS: `quality_audit_agents_${V}`,
  CATEGORIES: `quality_audit_categories_${V}`,
  AUDITS: `quality_audit_audits_${V}`,
};

export function loadFromStorage<T>(key: string, defaultValue: T): T {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : defaultValue;
  } catch {
    return defaultValue;
  }
}

export function saveToStorage<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error('Error saving to localStorage:', error);
  }
}
