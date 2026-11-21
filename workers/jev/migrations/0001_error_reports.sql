-- Anonymous client crash reports (POST /api/errors). No IP is stored; client is
-- an HMAC that rotates daily and is used only for rate limiting.
CREATE TABLE IF NOT EXISTS error_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  received_at INTEGER NOT NULL,
  client TEXT NOT NULL,
  kind TEXT NOT NULL,
  message TEXT NOT NULL,
  stack TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT '',
  build TEXT NOT NULL DEFAULT '',
  host TEXT NOT NULL DEFAULT '',
  path TEXT NOT NULL DEFAULT '',
  user_agent TEXT NOT NULL DEFAULT '',
  gpu TEXT NOT NULL DEFAULT '',
  game TEXT NOT NULL DEFAULT '',
  mode TEXT NOT NULL DEFAULT '',
  detail TEXT NOT NULL DEFAULT '',
  uptime_seconds INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS error_reports_received ON error_reports(received_at);
CREATE INDEX IF NOT EXISTS error_reports_client ON error_reports(client, received_at);
