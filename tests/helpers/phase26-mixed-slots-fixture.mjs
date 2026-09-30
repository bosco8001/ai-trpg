/** 只在指定隔離驗收 DB 的空槽建立健康 v2／受阻 v1；不覆蓋既有資料。 */
import assert from 'node:assert/strict';
import pg from 'pg';
import {createTestGameState} from '../../src/server/test-game-state.js';
import {hydrateStateRow,snapshotOf} from '../../src/server/postgres-game-state-repository.js';
import {createSaveSnapshot} from '../../src/server/save-game/service.js';
const db=new URL(process.env.TEST_DATABASE_URL ?? 'postgres://invalid');
if(db.hostname!=='127.0.0.1' || db.port!=='55426' || db.username!=='phase26_test' || !['/ai_trpg_phase26_review_manual','/ai_trpg_phase26_review_slots'].includes(db.pathname)) throw new Error('只允許專用 review_manual／review_slots 隔離資料庫。');
const pool=new pg.Pool({connectionString:db.href,max:1}),client=await pool.connect();
try {
  await client.query('BEGIN');
  await client.query('LOCK TABLE save_slots IN EXCLUSIVE MODE');
  const occupied=await client.query('SELECT slot_id FROM save_slots WHERE slot_id IN (1,3)');
  assert.equal(occupied.rowCount,0,'槽 1 或 3 已有資料；拒絕覆蓋，請使用新的隔離驗收 DB。');
  const seed=createTestGameState();
  await client.query('INSERT INTO game_states(character_id,revision,snapshot) VALUES($1,$2,$3::jsonb) ON CONFLICT(character_id) DO NOTHING',[seed.character.id,seed.revision,JSON.stringify(snapshotOf(seed))]);
  const rows=await client.query('SELECT character_id,revision,snapshot FROM game_states WHERE character_id=$1 FOR UPDATE',[seed.character.id]);
  const state=hydrateStateRow(rows.rows[0]);
  assert.equal(state.phase26?.fixtureId,'phase26-test-v1');assert.equal(state.combat,null,'需要 TEST 探索狀態。');
  const good=createSaveSnapshot(state);
  // 這是未知舊格式的工程樣本，不是正式角色資料。
  const blocked={activity:'outside-combat',character:{...state.character,id:'FORMAL-legacy-fixture'},inventory:state.inventory,exploration:state.exploration};
  await client.query('INSERT INTO save_slots(slot_id,format_version,source_revision,snapshot) VALUES(1,2,$1,$2::jsonb),(3,1,0,$3::jsonb)',[state.revision,JSON.stringify(good.state),JSON.stringify(blocked)]);
  await client.query('COMMIT');
  console.log(JSON.stringify({prepared:true,healthySlot:1,blockedSlot:3,issue:'migration-blocked',revision:state.revision,overwritten:false}));
}catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();await pool.end();}
