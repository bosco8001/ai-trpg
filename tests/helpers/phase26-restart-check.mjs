/** 工程整合驗證：只允許連接本階段專用隔離資料庫。 */
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {setTimeout as delay} from 'node:timers/promises';
const db=new URL(process.env.TEST_DATABASE_URL ?? 'postgres://invalid');
if(db.hostname!=='127.0.0.1' || db.port!=='55426' || db.username!=='phase26_test' || !db.pathname.startsWith('/ai_trpg_phase26_')) throw new Error('必須使用 Phase 26 專用隔離資料庫。');
const port=30426,url=`http://127.0.0.1:${port}`;
let child;
async function start() {
  child=spawn(process.execPath,['--import','tsx','src/server/index.ts'],{env:{...process.env,NODE_ENV:'test',PORT:String(port),DOMAIN_SANDBOX:'1',COMBAT_SANDBOX:'1',DOMAIN_STORAGE:'postgres',DATABASE_URL:db.href,COMBAT_ROLL_FIXTURE_MODE:'normal',COMBAT_ENCOUNTER_FIXTURE:'1'},stdio:['ignore','ignore','pipe']});
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
  await start();let state=(await call('/api/game-state')).state;
  state=(await call('/api/dev/combat/reset','POST',{expectedRevision:state.revision})).state;
  state=(await call('/api/dev/combat/start','POST',{expectedRevision:state.revision})).state;
  for(const [targetId,amount] of [['TEST-player',3],['TEST-companion-1',8],['TEST-enemy-1',6],['TEST-enemy-2',6]]) state=(await call('/api/dev/combat/apply-damage','POST',{expectedRevision:state.revision,targetId,amount})).state;
  const ended=state,combatId=state.combat.lifecycle.combatId,generation=state.phase26.runtimeGeneration;
  await call('/api/save-slots/1','PUT',{expectedRevision:state.revision});
  await stop();await start();assert.deepEqual((await call('/api/game-state')).state,ended);
  const settled=await call('/api/combat/settle','POST',{expectedRevision:state.revision});
  assert.equal(settled.state.revision,ended.revision+1);assert.equal(settled.state.combat,null);assert.equal(settled.state.phase26.characters[0].currentHp,7);assert.equal(settled.state.phase26.characters[1].currentHp,1);assert.equal(settled.state.phase26.encounters[0].resolved,true);
  state=(await call('/api/game-state')).state;assert.equal(state.phase26.history.length,1);assert.equal(state.phase26.runtimeGeneration,generation);
  const sequence=state.phase26.sequenceHighWater,entry=state.phase26.history[0];
  await stop();await start();assert.deepEqual((await call('/api/game-state')).state,state);
  const loaded=await call('/api/save-slots/1/load','POST',{expectedRevision:state.revision});state=loaded.authoritative.state;
  assert.equal(state.combat.lifecycle.combatId,combatId);assert.equal(state.revision,ended.revision+2);assert.notEqual(state.phase26.runtimeGeneration,generation);assert.equal(state.phase26.history.length,0);assert.equal(state.phase26.sequenceHighWater,sequence);
  const replay=await call('/api/combat/settle','POST',{expectedRevision:state.revision});
  assert.equal(replay.settlementResult.combatId,combatId);assert.notEqual(replay.settlementResult.settlementRevision,settled.settlementResult.settlementRevision);
  state=(await call('/api/game-state')).state;assert.equal(state.phase26.history.length,1);assert.ok(state.phase26.sequenceHighWater>sequence);assert.ok(state.phase26.narrativeLedger.some(e=>e.id===entry.id));
  await stop();await start();assert.deepEqual((await call('/api/game-state')).state,state);
  console.log(JSON.stringify({passed:true,processRestarts:3,endedRevision:ended.revision,firstSettlementRevision:settled.state.revision,replayRevision:state.revision,sequenceHighWater:state.phase26.sequenceHighWater,combatIdPreserved:true,historyRestored:true,generationChangedOnLoad:true}));
}finally {await stop();}
