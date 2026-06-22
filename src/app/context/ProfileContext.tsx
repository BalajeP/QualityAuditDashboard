import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useAuth } from './AuthContext';

export interface UserProfile {
  id: string;
  name: string;
  letter: string;
  bgColor: string;
}

interface ProfileContextType {
  profiles: UserProfile[];
  activeProfileId: string | null;
  activeProfile: UserProfile | null;
  switchProfile: (id: string) => void;
  updateProfile: (id: string, name: string, letter: string, bgColor: string) => void;
  createProfile: (name: string, letter: string, bgColor: string) => string;
  deleteProfile: (id: string) => void;
}

const ProfileContext = createContext<ProfileContextType>({
  profiles: [],
  activeProfileId: null,
  activeProfile: null,
  switchProfile: () => {},
  updateProfile: () => {},
  createProfile: () => '',
  deleteProfile: () => {},
});

export const PROFILE_COLORS = [
  '#5D5CDE', // Purple/Indigo
  '#8B5CF6', // Purple
  '#EC4899', // Magenta/Pink
  '#EF4444', // Red
  '#F97316', // Orange
  '#F59E0B', // Amber
  '#10B981', // Green
  '#14B8A6', // Teal
  '#3B82F6', // Blue
  '#475569', // Slate
  '#78716C', // Stone/Grey
];

export function ProfileProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);

  const storageKey = user ? `qa_profiles_${user.id}` : null;
  const activeKey = user ? `qa_active_profile_${user.id}` : null;

  // Load profiles from storage
  useEffect(() => {
    if (!user || !storageKey || !activeKey) {
      setProfiles([]);
      setActiveProfileId(null);
      return;
    }

    try {
      const stored = localStorage.getItem(storageKey);
      const activeId = localStorage.getItem(activeKey);
      
      let parsed: UserProfile[] = stored ? JSON.parse(stored) : [];
      
      if (parsed.length === 0) {
        // Initialize with default profile from user email
        const initialName = user.email?.split('@')[0].toUpperCase() || 'USER';
        const initialLetter = initialName.charAt(0);
        const defaultProfile: UserProfile = {
          id: `profile-default-${Date.now()}`,
          name: initialName,
          letter: initialLetter,
          bgColor: '#14B8A6', // default teal
        };
        parsed = [defaultProfile];
        localStorage.setItem(storageKey, JSON.stringify(parsed));
      }

      setProfiles(parsed);
      
      // Determine active profile
      const exists = parsed.some(p => p.id === activeId);
      const finalActiveId = exists ? activeId : parsed[0].id;
      setActiveProfileId(finalActiveId);
      localStorage.setItem(activeKey, finalActiveId || '');
    } catch (e) {
      console.error(e);
    }
  }, [user, storageKey, activeKey]);

  const switchProfile = (id: string) => {
    if (!activeKey) return;
    setActiveProfileId(id);
    localStorage.setItem(activeKey, id);
  };

  const updateProfile = (id: string, name: string, letter: string, bgColor: string) => {
    if (!storageKey) return;
    setProfiles(prev => {
      const updated = prev.map(p => p.id === id ? { ...p, name, letter, bgColor } : p);
      localStorage.setItem(storageKey, JSON.stringify(updated));
      return updated;
    });
  };

  const createProfile = (name: string, letter: string, bgColor: string) => {
    if (!storageKey) return '';
    const newId = `profile-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const newProfile: UserProfile = { id: newId, name, letter, bgColor };
    
    setProfiles(prev => {
      const updated = [...prev, newProfile];
      localStorage.setItem(storageKey, JSON.stringify(updated));
      return updated;
    });
    
    switchProfile(newId);
    return newId;
  };

  const deleteProfile = (id: string) => {
    if (!storageKey || profiles.length <= 1) return; // cannot delete last profile
    
    setProfiles(prev => {
      const updated = prev.filter(p => p.id !== id);
      localStorage.setItem(storageKey, JSON.stringify(updated));
      
      if (activeProfileId === id) {
        const nextId = updated[0].id;
        setActiveProfileId(nextId);
        if (activeKey) localStorage.setItem(activeKey, nextId);
      }
      return updated;
    });
  };

  const activeProfile = profiles.find(p => p.id === activeProfileId) || null;

  return (
    <ProfileContext.Provider value={{
      profiles,
      activeProfileId,
      activeProfile,
      switchProfile,
      updateProfile,
      createProfile,
      deleteProfile
    }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfiles() {
  return useContext(ProfileContext);
}
