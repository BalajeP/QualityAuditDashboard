# Supabase Setup — Quality Audit

## Step 1: Run this SQL in your Supabase project (SQL Editor)

```sql
-- Grid snapshots (one row per grid)
CREATE TABLE IF NOT EXISTS grid_snapshots (
  id         TEXT PRIMARY KEY,
  label      TEXT NOT NULL,
  snapshot   JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO grid_snapshots (id, label, snapshot)
VALUES
  ('grid_1', 'Scoring Grid 1', '{}'),
  ('grid_2', 'Scoring Grid 2', '{}')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE grid_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_all" ON grid_snapshots FOR ALL USING (true) WITH CHECK (true);

-- User Permissions (for role-based access control)
CREATE TABLE IF NOT EXISTS user_permissions (
  email      TEXT PRIMARY KEY,
  role       TEXT NOT NULL DEFAULT 'viewer', -- 'admin' | 'viewer'
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_all" ON user_permissions FOR ALL USING (true) WITH CHECK (true);
```

## Step 2: Add your credentials

Create a `.env` file in the project root:

```
VITE_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

Find both values in: **Supabase Dashboard → Settings → API**

## Step 3: Restart the dev server

```
pnpm dev
```

Data will now save to Supabase automatically. localStorage is used as fallback when Supabase is unavailable.
