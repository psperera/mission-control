-- Mission Progress Tracking Schema
-- Add these to the database for enhanced mission management

-- Mission phases/steps table
CREATE TABLE IF NOT EXISTS mission_phases (
  id TEXT PRIMARY KEY,
  mission_id TEXT NOT NULL,
  phase_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'blocked')),
  assigned_agent_id TEXT REFERENCES agents(id),
  deliverable_path TEXT,
  due_date TEXT,
  completed_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Mission deliverables with download tracking
CREATE TABLE IF NOT EXISTS mission_deliverables (
  id TEXT PRIMARY KEY,
  mission_id TEXT NOT NULL,
  phase_id TEXT REFERENCES mission_phases(id),
  title TEXT NOT NULL,
  description TEXT,
  file_path TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  download_count INTEGER DEFAULT 0,
  last_downloaded_at TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'approved', 'archived')),
  created_by_agent_id TEXT REFERENCES agents(id),
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Mission progress log
CREATE TABLE IF NOT EXISTS mission_progress_log (
  id TEXT PRIMARY KEY,
  mission_id TEXT NOT NULL,
  phase_id TEXT REFERENCES mission_phases(id),
  agent_id TEXT REFERENCES agents(id),
  action TEXT NOT NULL,
  message TEXT,
  metadata TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_mission_phases_mission ON mission_phases(mission_id, phase_number);
CREATE INDEX IF NOT EXISTS idx_mission_deliverables_mission ON mission_deliverables(mission_id, status);
CREATE INDEX IF NOT EXISTS idx_mission_progress_log ON mission_progress_log(mission_id, created_at DESC);
