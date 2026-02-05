-- Migration: Add workspace email configuration
-- Run this to add email settings to businesses/workspaces

-- Add email configuration columns to businesses table
ALTER TABLE businesses ADD COLUMN email_recipient TEXT;
ALTER TABLE businesses ADD COLUMN email_subject_template TEXT DEFAULT 'Mission Deliverables - {mission_name}';
ALTER TABLE businesses ADD COLUMN email_enabled INTEGER DEFAULT 1;
ALTER TABLE businesses ADD COLUMN auto_send_on_complete INTEGER DEFAULT 0;
ALTER TABLE businesses ADD COLUMN last_email_sent_at TEXT;

-- Create workspace_email_logs table for tracking
CREATE TABLE IF NOT EXISTS workspace_email_logs (
  id TEXT PRIMARY KEY,
  workspace_id TEXT REFERENCES businesses(id),
  mission_id TEXT,
  recipient TEXT NOT NULL,
  subject TEXT NOT NULL,
  files_attached TEXT, -- JSON array of file names
  status TEXT DEFAULT 'sent' CHECK (status IN ('sent', 'failed', 'pending')),
  error_message TEXT,
  sent_at TEXT DEFAULT (datetime('now'))
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_workspace_email_logs_workspace ON workspace_email_logs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_email_logs_sent_at ON workspace_email_logs(sent_at);
