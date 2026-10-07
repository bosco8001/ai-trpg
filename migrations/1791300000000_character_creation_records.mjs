// Independent immutable birth records; no changes to game_states, save_slots or repair archives.
export const up = pgm => {
  pgm.sql(`CREATE TABLE character_creation_records (
    character_id uuid PRIMARY KEY,
    owner_key text NOT NULL CHECK (char_length(owner_key) BETWEEN 1 AND 80),
    request_id uuid NOT NULL,
    request_hash text NOT NULL CHECK (request_hash ~ '^[0-9a-f]{64}$'),
    record jsonb NOT NULL CHECK (jsonb_typeof(record) = 'object' AND octet_length(record::text) <= 32768),
    UNIQUE (owner_key), UNIQUE (owner_key, request_id)
  )`);
};
// Ordinary rollback must not silently destroy a generated, saved character.
export const down = false;
