/** 建立 TEST 驗收情境，停在結果頁；繼續結算留給使用者。 */
import assert from 'node:assert/strict';
const url=process.env.PHASE26_API_URL ?? 'http://127.0.0.1:3001';
if(!/^http:\/\/127\.0\.0\.1:\d+$/.test(url)) throw new Error('僅允許本機 TEST API。');
const mode=process.argv[2] ?? 'victory';
if(!['victory','escape','defeat','dead-companion'].includes(mode)) throw new Error('情境只接受 victory、escape、defeat、dead-companion。');
async function call(path,body) {
  const response=await fetch(url+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
  const result=await response.json();assert.equal(response.status,200,JSON.stringify(result));return result;
}
let response=await call('/api/game-state'),state=response.state;
assert.equal(response.sandbox,true,'需要 DOMAIN_SANDBOX 與 COMBAT_SANDBOX。');
assert.equal(state.phase26?.fixtureId,'phase26-test-v1','拒絕重建非本階段 TEST 世界。');
state=(await call('/api/dev/combat/reset',{expectedRevision:state.revision})).state;
const resetRevision=state.revision;
state=(await call('/api/dev/combat/start',{expectedRevision:state.revision})).state;
async function act(path,fields={}) {state=(await call(path,{expectedRevision:state.revision,...fields})).state;}
async function hurt(targetId,amount) {await act('/api/dev/combat/apply-damage',{targetId,amount});}
if(mode==='defeat') {await hurt('TEST-companion-1',8);await hurt('TEST-player',10);}
else if(mode==='escape') {
  await hurt('TEST-player',4);await act('/api/dev/combat/advance');await act('/api/combat/run');
  assert.equal(state.combat.endReason,'escaped','請啟用 COMBAT_ESCAPE_ROLL_FIXTURE_MODE=success。');
} else {
  await hurt('TEST-player',3);await hurt('TEST-companion-1',8);
  if(mode==='dead-companion') for(let cycle=0;cycle<2;cycle++) {
    for(let step=0;step<3;step++) await act('/api/dev/combat/advance');
    await act('/api/combat/dying-turn');
  }
  await hurt('TEST-enemy-1',6);await hurt('TEST-enemy-2',6);
}
console.log(JSON.stringify({mode,storage:response.storage,resetRevision,endedRevision:state.revision,endReason:state.combat.endReason,
  combatId:state.combat.lifecycle.combatId,combatParty:state.combat.participants.filter(p=>p.side==='party').map(p=>({name:p.displayName,hp:p.health.currentHp,maxHp:p.health.maxHp,lifeState:p.health.lifeState,mp:p.mp})),
  persistent:state.phase26.characters,party:state.partyMembers,encounters:state.phase26.encounters},null,2));
