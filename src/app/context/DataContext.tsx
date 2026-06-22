import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Agent, Category, Audit } from '../types';
import { 
  defaultAgents, 
  defaultCategories, 
  generateSampleAudits,
  loadFromStorage,
  saveToStorage,
  STORAGE_KEYS 
} from '../lib/data';
import { supabaseSave } from '../../lib/supabase';

interface DataContextType {
  agents: Agent[];
  categories: Category[];
  audits: Audit[];
  addAgent: (agent: Agent) => void;
  updateAgent: (agent: Agent) => void;
  deleteAgent: (id: string) => void;
  addAudit: (audit: Audit) => void;
  updateCategory: (category: Category) => void;
  deleteAudit: (id: string) => void;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export function DataProvider({ children }: { children: ReactNode }) {
  const [agents, setAgents] = useState<Agent[]>(() => 
    loadFromStorage(STORAGE_KEYS.AGENTS, defaultAgents)
  );
  const [categories, setCategories] = useState<Category[]>(() => 
    loadFromStorage(STORAGE_KEYS.CATEGORIES, defaultCategories)
  );
  const [audits, setAudits] = useState<Audit[]>(() => 
    loadFromStorage(STORAGE_KEYS.AUDITS, generateSampleAudits())
  );

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.AGENTS, agents);
  }, [agents]);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.CATEGORIES, categories);
  }, [categories]);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.AUDITS, audits);
  }, [audits]);

  const addAgent = (agent: Agent) => {
    setAgents(prev => [...prev, agent]);
  };

  const updateAgent = (agent: Agent) => {
    setAgents(prev => prev.map(a => a.id === agent.id ? agent : a));
  };

  const deleteAgent = (id: string) => {
    const agent = agents.find(a => a.id === id);
    setAgents(prev => prev.filter(a => a.id !== id));
    
    if (agent) {
      const name = agent.name;
      const keys = ['qa_grid_1', 'qa_grid_2', 'qa_saved_grid1_v1', 'qa_saved_grid2_v1'];
      keys.forEach(key => {
        try {
          const raw = localStorage.getItem(key);
          if (!raw) return;
          const snap = JSON.parse(raw);
          if (snap && Array.isArray(snap.rows)) {
            const initialLen = snap.rows.length;
            snap.rows = snap.rows.filter((r: any) => r.agentName !== name);
            if (snap.rows.length !== initialLen) {
              localStorage.setItem(key, JSON.stringify(snap));
              const dbKey = key.includes('grid_1') || key.includes('grid1') ? 'grid_1' : 'grid_2';
              supabaseSave(dbKey, snap).catch(() => {});
            }
          }
        } catch (e) {
          console.error('[deleteAgent sync error]', e);
        }
      });
    }
  };

  const addAudit = (audit: Audit) => {
    setAudits(prev => [audit, ...prev]);
  };

  const deleteAudit = (id: string) => {
    setAudits(prev => prev.filter(a => a.id !== id));
  };

  const updateCategory = (category: Category) => {
    setCategories(prev => prev.map(c => c.id === category.id ? category : c));
  };

  return (
    <DataContext.Provider value={{
      agents,
      categories,
      audits,
      addAgent,
      updateAgent,
      deleteAgent,
      addAudit,
      updateCategory,
      deleteAudit,
    }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within DataProvider');
  }
  return context;
}
