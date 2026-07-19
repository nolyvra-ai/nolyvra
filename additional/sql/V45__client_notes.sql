-- Timestamped notes log for a client (replaces the single clients.notes value
-- going forward; that column is left in place, unused, for history).
CREATE TABLE client_notes (
    id         BIGSERIAL PRIMARY KEY,
    client_id  BIGINT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    login_id   TEXT NOT NULL,
    note       TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_client_notes_client_id ON client_notes (client_id, created_at DESC);

-- Preserve any existing free-text note as the first historical entry.
INSERT INTO client_notes (client_id, login_id, note, created_at)
SELECT id, login_id, notes, created_at FROM clients
WHERE notes IS NOT NULL AND btrim(notes) <> '';
