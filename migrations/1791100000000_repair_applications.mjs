/** Source tokens are outside raw snapshots. Triggers also cover same-value UPDATEs. */
export const up = pgm => {
  pgm.sql(`
    CREATE TABLE repair_apply_epoch (singleton boolean PRIMARY KEY CHECK (singleton), token uuid NOT NULL);
    INSERT INTO repair_apply_epoch VALUES (true, gen_random_uuid());
    CREATE TABLE repair_source_versions (source_key text PRIMARY KEY, token uuid NOT NULL);
    INSERT INTO repair_source_versions SELECT 'current:' || character_id, gen_random_uuid() FROM game_states;
    INSERT INTO repair_source_versions SELECT 'slot:' || slot_id::text, gen_random_uuid() FROM save_slots;
    CREATE FUNCTION touch_repair_source() RETURNS trigger LANGUAGE plpgsql AS $$
    DECLARE old_key text; new_key text;
    BEGIN
      IF TG_OP <> 'INSERT' THEN
        IF TG_TABLE_NAME = 'game_states' THEN old_key := 'current:' || OLD.character_id;
        ELSE old_key := 'slot:' || OLD.slot_id::text; END IF;
        INSERT INTO repair_source_versions VALUES (old_key, gen_random_uuid())
          ON CONFLICT (source_key) DO UPDATE SET token = EXCLUDED.token;
      END IF;
      IF TG_OP <> 'DELETE' THEN
        IF TG_TABLE_NAME = 'game_states' THEN new_key := 'current:' || NEW.character_id;
        ELSE new_key := 'slot:' || NEW.slot_id::text; END IF;
        IF old_key IS DISTINCT FROM new_key THEN
          INSERT INTO repair_source_versions VALUES (new_key, gen_random_uuid())
            ON CONFLICT (source_key) DO UPDATE SET token = EXCLUDED.token;
        END IF;
      END IF;
      RETURN NULL;
    END $$;
    CREATE TRIGGER game_state_repair_version AFTER INSERT OR UPDATE OR DELETE ON game_states
      FOR EACH ROW EXECUTE FUNCTION touch_repair_source();
    CREATE TRIGGER save_slot_repair_version AFTER INSERT OR UPDATE OR DELETE ON save_slots
      FOR EACH ROW EXECUTE FUNCTION touch_repair_source();
    CREATE FUNCTION invalidate_repair_epoch() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN UPDATE repair_apply_epoch SET token = gen_random_uuid(); RETURN NULL; END $$;
    CREATE TRIGGER game_state_repair_truncate AFTER TRUNCATE ON game_states
      FOR EACH STATEMENT EXECUTE FUNCTION invalidate_repair_epoch();
    CREATE TRIGGER save_slot_repair_truncate AFTER TRUNCATE ON save_slots
      FOR EACH STATEMENT EXECUTE FUNCTION invalidate_repair_epoch();
    CREATE TABLE repair_applications (
      repair_id uuid PRIMARY KEY REFERENCES repair_preparations(repair_id),
      character_id text NOT NULL,
      certificate_text text NOT NULL CHECK (octet_length(certificate_text) BETWEEN 1 AND 65536),
      owner_token uuid,
      started_at text,
      report_text text CHECK (report_text IS NULL OR octet_length(report_text) BETWEEN 1 AND 65536),
      reserved_bytes integer NOT NULL DEFAULT 0 CHECK (reserved_bytes BETWEEN 0 AND 65536),
      CHECK ((owner_token IS NULL) = (started_at IS NULL)),
      CHECK (report_text IS NULL OR owner_token IS NOT NULL)
    );
    CREATE INDEX repair_application_character ON repair_applications(character_id, repair_id);
  `);
};
// Backups and application results must not be removed by an ordinary rollback.
export const down = false;
