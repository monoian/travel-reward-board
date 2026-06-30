export const SETUP_SQL = `
CREATE TABLE IF NOT EXISTS winners (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_no TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  unit TEXT NOT NULL,
  country TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS listings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  winner_id INTEGER NOT NULL,
  price INTEGER NOT NULL,
  negotiable TEXT NOT NULL CHECK (negotiable IN ('yes', 'no')),
  contact TEXT NOT NULL,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'published'
    CHECK (status IN ('published', 'sold', 'closed', 'expired')),
  close_reason TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  FOREIGN KEY (winner_id) REFERENCES winners(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_listings_one_published
  ON listings (winner_id)
  WHERE status = 'published';

CREATE INDEX IF NOT EXISTS idx_listings_status_expires
  ON listings (status, expires_at);

CREATE INDEX IF NOT EXISTS idx_listings_winner
  ON listings (winner_id, created_at);

CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_no TEXT NOT NULL,
  action TEXT NOT NULL,
  listing_id INTEGER,
  ip_address TEXT,
  user_agent TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_created_at
  ON audit_logs (created_at);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
`;
