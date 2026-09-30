/** Phase 26 keeps gameplay and History coordination in the same locked JSONB row. */
export const up = (pgm) => {
  pgm.sql(`ALTER TABLE game_states ADD CONSTRAINT phase26_snapshot_object
    CHECK (NOT (snapshot ? 'phase26') OR jsonb_typeof(snapshot->'phase26') = 'object')`);
  pgm.sql(`CREATE FUNCTION phase26_narrative_unique(entries jsonb) RETURNS boolean
    LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
    SELECT CASE WHEN jsonb_typeof(entries) <> 'array' OR entries IS NULL THEN false ELSE
      NOT EXISTS (SELECT 1 FROM jsonb_array_elements(entries) e GROUP BY e->>'id' HAVING count(*) > 1)
      AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(entries) e WHERE e->>'category' = 'placed'
        GROUP BY e->>'sequence' HAVING count(*) > 1)
      AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(entries) e WHERE e->>'type' = 'post-combat'
        GROUP BY e->>'sourceCombatId', e->>'sourceStateRevision' HAVING count(*) > 1)
    END $$`);
  pgm.sql(`ALTER TABLE game_states ADD CONSTRAINT phase26_narrative_unique
    CHECK (NOT (snapshot ? 'phase26') OR
      (phase26_narrative_unique(snapshot #> '{phase26,history}')
       AND phase26_narrative_unique(snapshot #> '{phase26,narrativeLedger}')))`);
  pgm.sql(`CREATE UNIQUE INDEX phase26_run_identity ON game_states ((snapshot #>> '{phase26,runId}'))
    WHERE snapshot ? 'phase26'`);
};
export const down = false;
