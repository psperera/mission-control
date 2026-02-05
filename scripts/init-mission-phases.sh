#!/bin/bash
# Initialize ESAB-Eddyfi mission phases in the database

cd /Users/paulperera/dev/mission-control

echo "Initializing mission phases for esab-eddyfi-waygate-2026..."

# Insert Phase 1: Research
sqlite3 mission-control.db <<EOF
INSERT OR IGNORE INTO mission_phases (id, mission_id, phase_number, title, description, status, created_at)
VALUES (
  'esab-eddyfi-waygate-2026-phase-1',
  'esab-eddyfi-waygate-2026',
  1,
  'Research',
  'Deep dive into ESAB and Eddyfi companies, acquisition terms, and market context',
  'in_progress',
  datetime('now')
);

INSERT OR IGNORE INTO mission_phases (id, mission_id, phase_number, title, description, status, created_at)
VALUES (
  'esab-eddyfi-waygate-2026-phase-2',
  'esab-eddyfi-waygate-2026',
  2,
  'Analysis',
  'Portfolio mapping, competitive threat assessment, and timeline scenarios',
  'pending',
  datetime('now')
);

INSERT OR IGNORE INTO mission_phases (id, mission_id, phase_number, title, description, status, created_at)
VALUES (
  'esab-eddyfi-waygate-2026-phase-3',
  'esab-eddyfi-waygate-2026',
  3,
  'Synthesis',
  'Executive brief and comparison matrix creation',
  'pending',
  datetime('now')
);

INSERT OR IGNORE INTO mission_phases (id, mission_id, phase_number, title, description, status, created_at)
VALUES (
  'esab-eddyfi-waygate-2026-phase-4',
  'esab-eddyfi-waygate-2026',
  4,
  'Outputs',
  'Waygate response plan and presentation deck',
  'pending',
  datetime('now')
);
EOF

echo "Mission phases initialized successfully!"
echo ""
echo "Current mission status:"
sqlite3 mission-control.db "SELECT phase_number, title, status FROM mission_phases WHERE mission_id = 'esab-eddyfi-waygate-2026' ORDER BY phase_number;"
