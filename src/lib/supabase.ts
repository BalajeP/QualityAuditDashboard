import { createClient } from '@supabase/supabase-js';

// ── Credentials — hardcoded for reliability (env vars are optional override) ──
// Project: Quality Audit database1  |  ref: rdtwzhmadiucxehjajxs
const SUPABASE_URL  =
  (import.meta.env.VITE_SUPABASE_URL  as string | undefined) ||
  'https://ojtdnhtuzqytyrkhefgx.supabase.co';

const SUPABASE_KEY  =
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9qdGRuaHR1enF5dHlya2hlZmd4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEzNjg4MzYsImV4cCI6MjA5Njk0NDgzNn0.-u9_G_1g7tROOZRse57a_a70fM6UCVtD6LGu7pDHFPo';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Connection test (called once at startup) ──────────────────────────────────
supabase.from('grid_snapshots').select('id').limit(1).then(({ error }) => {
  if (error) {
    console.error('[Supabase] ❌ Cannot reach grid_snapshots table:', error.message);
    console.error('[Supabase] → Run the SQL from SUPABASE_SETUP.md in your project SQL Editor');
  } else {
    console.info('[Supabase] ✅ Connected to Quality Audit database1');
  }
});

// ── Helpers ───────────────────────────────────────────────────────────────────

export async function supabaseSave(gridId: 'grid_1' | 'grid_2', snapshot: any): Promise<void> {
  const { error } = await supabase
    .from('grid_snapshots')
    .upsert(
      { id: gridId, label: snapshot.label || (gridId === 'grid_1' ? 'Scoring Grid 1' : 'Scoring Grid 2'), snapshot, updated_at: new Date().toISOString() },
      { onConflict: 'id' }
    );
  if (error) console.warn('[Supabase save]', gridId, error.message);
}

export async function supabaseLoad(gridId: 'grid_1' | 'grid_2'): Promise<object | null> {
  const { data, error } = await supabase
    .from('grid_snapshots')
    .select('snapshot')
    .eq('id', gridId)
    .maybeSingle();
  if (error) { console.warn('[Supabase load]', gridId, error.message); return null; }
  const snap = data?.snapshot;
  // Reject empty placeholder inserted by the seed SQL
  if (!snap || typeof snap !== 'object' || Object.keys(snap).length === 0) return null;
  return snap as object;
}

export async function getUserRole(email: string): Promise<'admin' | 'viewer'> {
  try {
    const { data, error } = await supabase
      .from('user_permissions')
      .select('role')
      .eq('email', email.toLowerCase().trim())
      .maybeSingle();
    
    if (error) {
      console.warn('[Supabase getUserRole]', error.message);
      return 'viewer';
    }
    
    return (data?.role as 'admin' | 'viewer') || 'viewer';
  } catch {
    return 'viewer';
  }
}

export async function getAllUserPermissions(): Promise<{ email: string; role: 'admin' | 'viewer' }[]> {
  try {
    const { data, error } = await supabase
      .from('user_permissions')
      .select('email, role')
      .order('email');
    
    if (error) {
      console.warn('[Supabase getAllUserPermissions]', error.message);
      return [];
    }
    
    return (data || []) as { email: string; role: 'admin' | 'viewer' }[];
  } catch {
    return [];
  }
}

export async function updateUserPermission(email: string, role: 'admin' | 'viewer'): Promise<void> {
  const { error } = await supabase
    .from('user_permissions')
    .upsert(
      { email: email.toLowerCase().trim(), role, updated_at: new Date().toISOString() },
      { onConflict: 'email' }
    );
  if (error) {
    console.warn('[Supabase updateUserPermission]', error.message);
  }
}
