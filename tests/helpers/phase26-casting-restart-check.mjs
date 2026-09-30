/** 詠唱中勝利的工程重啟檢查；只允許 Phase 26 隔離 PostgreSQL。 */
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {setTimeout as delay} from 'node:timers/promises';
const db=new URL(process.env.TEST_DATABASE_URL ?? 'postgres://invalid');
if(db.hostname!=='127.0.0.1' || db.port!=='55426' || db.username!=='phase26_test' || !db.pathname.startsWith('/ai_trpg_phase26_')) throw new Error('必須使用 Phase 26 專用隔離資料庫。');
const port=30427,url=`http://127.0.0.1:${port}`;
let child;
async function start() {
  child=spawn(process.execPath,['--import','tsx','src/server/index.ts'],{env:{...process.env,NODE_ENV:'test',PORT:String(port),DOMAIN_SANDBOX:'1',COMBAT_SANDBOX:'1',DOMAIN_STORAGE:'postgres',DATABASE_URL:db.href,COMBAT_ROLL_FIXTURE_MODE:'normal',COMBAT_ENCOUNTER_FIXTURE:'0'},stdio:['ignore','ignore','pipe']});
  let errors='';child.stderr.on('data',d=>{errors+=d;});
  for(let attempt=0;attempt<80;attempt++) {
    if(child.exitCode!==null) throw new Error(`API 啟動失敗：${errors}`);
    try {if((await fetch(url+'/api/health')).ok) return;}catch{}
    await delay(50);
  }
  throw new Error('API 啟動逾時。');
}
async function stop() {if(child && child.exitCode===null) {const exited=once(child,'exit');child.kill('SIGTERM');await exited;}}
async function call(path,method='GET',body) {
  const response=await fetch(url+path,{method,headers:{'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
  const value=await response.json();assert.equal(response.status,200,JSON.stringify(value));return value;
}
try {
  await start();
  const fixture=spawn(process.execPath,['tests/helpers/phase26-manual-fixture.mjs','casting-victory'],{env:{...process.env,PHASE26_API_URL:url},stdio:['ignore','pipe','pipe']});
  let fixtureErrors='';fixture.stderr.on('data',d=>{fixtureErrors+=d;});fixture.stdout.resume();
  const [fixtureExit]=await once(fixture,'exit');assert.equal(fixtureExit,0,fixtureErrors);
  let state=(await call('/api/game-state')).state;
  const ended=state,combatId=ended.combat.lifecycle.combatId;
  assert.equal(ended.combat.status,'ended');assert.deepEqual(ended.combat.activeCastings,[]);assert.equal(ended.character.currentMp,24);assert.equal(ended.combat.participants[0].mp.currentMp,18);
  await call('/api/save-slots/1','PUT',{expectedRevision:state.revision});
  await stop();await start();assert.deepEqual((await call('/api/game-state')).state,ended);
  const settled=await call('/api/combat/settle','POST',{expectedRevision:state.revision});
  assert.equal(settled.state.revision,ended.revision+1);assert.equal(settled.state.character.currentMp,18);
  state=(await call('/api/game-state')).state;
  await stop();await start();assert.deepEqual((await call('/api/game-state')).state,state);
  state=(await call('/api/save-slots/1/load','POST',{expectedRevision:state.revision})).authoritative.state;
  assert.equal(state.combat.lifecycle.combatId,combatId);assert.equal(state.character.currentMp,24);assert.equal(state.combat.participants[0].mp.currentMp,18);assert.deepEqual(state.combat.activeCastings,[]);
  const loaded=state;
  await stop();await start();assert.deepEqual((await call('/api/game-state')).state,loaded);
  state=(await call('/api/combat/settle','POST',{expectedRevision:state.revision})).state;
  assert.equal(state.character.currentMp,18);
  state=(await call('/api/dev/combat/start','POST',{expectedRevision:state.revision})).state;
  assert.notEqual(state.combat.lifecycle.combatId,combatId);assert.equal(state.combat.participants[0].mp.currentMp,18);
  console.log(JSON.stringify({passed:true,processRestarts:3,endedRevision:ended.revision,settlementRevision:settled.state.revision,loadedRevision:loaded.revision,nextStartRevision:state.revision,combatMp:18,persistentMp:18,nextCombatMp:18,refund:false,combatIdPreservedOnLoad:true}));
}finally {await stop();}
