import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase, getUserRole, updateUserPermission, getAllUserPermissions } from '../../lib/supabase';
import { User, Session } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  role: 'admin' | 'viewer';
  isAdmin: boolean;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshRole: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  role: 'viewer',
  isAdmin: false,
  loading: true,
  signOut: async () => {},
  refreshRole: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<'admin' | 'viewer'>('viewer');
  const [loading, setLoading] = useState(true);

  const fetchAndSyncRole = async (currentUser: User | null) => {
    if (!currentUser || !currentUser.email) {
      setRole('viewer');
      return;
    }
    try {
      const allPerms = await getAllUserPermissions();
      if (allPerms.length === 0) {
        // First user signup -> set as admin
        await updateUserPermission(currentUser.email, 'admin');
        setRole('admin');
      } else {
        const userRole = await getUserRole(currentUser.email);
        setRole(userRole);
      }
    } catch {
      setRole('viewer');
    }
  };

  useEffect(() => {
    // 1. Get initial session
    supabase.auth.getSession().then(async ({ data: { session: currentSession } }) => {
      setSession(currentSession);
      const currentUser = currentSession?.user ?? null;
      setUser(currentUser);
      if (currentUser) {
        await fetchAndSyncRole(currentUser);
      }
      setLoading(false);
    }).catch(() => {
      setLoading(false);
    });

    // 2. Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, currentSession) => {
      setSession(currentSession);
      const currentUser = currentSession?.user ?? null;
      setUser(currentUser);
      if (currentUser) {
        await fetchAndSyncRole(currentUser);
      } else {
        setRole('viewer');
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const refreshRole = async () => {
    if (user) {
      await fetchAndSyncRole(user);
    }
  };

  const signOut = async () => {
    setLoading(true);
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setRole('viewer');
    setLoading(false);
  };

  const isAdmin = role === 'admin';

  return (
    <AuthContext.Provider value={{ user, session, role, isAdmin, loading, signOut, refreshRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
