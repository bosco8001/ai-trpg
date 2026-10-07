// 2026-10-07 使用者授權 Codex 親測，9 項通過；來源與限制見第三切片紀錄。
import test from 'node:test';
import assert from 'node:assert/strict';
import { sample, derive, previewChange, shiftResource } from './model.mjs';

test('人類種族先加，再乘劍士；六項修正與 HP／MP 取最終值', () => {
  const r = derive(sample());
  assert.equal(r.rows[0].intrinsic,12); assert.equal(r.rows[0].final,15);
  assert.equal(r.rows[0].modifier,2); assert.equal(r.maxHp,55); assert.equal(r.maxMp,60);
});
test('精靈智慧先加種族 +1 再乘魔術師，向下取整', () => {
  const r = derive({ ...sample(), race:'elf', profession:'mage', aptitude:'high', human:[0,0,0,0,0,0] });
  assert.equal(r.rows[3].intrinsic,11); assert.equal(r.rows[3].final,13);
  assert.equal(r.maxHp,49); assert.equal(r.maxMp,92);
});
test('獸人智慧減益與負修正向下取整', () => {
  const r = derive({ ...sample(), race:'orc', aptitude:'low', human:[0,0,0,0,0,0] });
  assert.equal(r.rows[3].final,7); assert.equal(r.rows[3].modifier,-2); assert.equal(r.maxMp,28);
});
test('14 只限制一般分配，人類種族與職業可超過', () => {
  const r = derive({ ...sample(), allocation:[6,0,0,2,2,2] });
  assert.equal(r.rows[0].intrinsic,16); assert.equal(r.rows[0].final,20);
});
test('來回改上限保留缺少量，避免切換增加資源', () => {
  assert.deepEqual(shiftResource(40,55,64,'hp'),{ok:true,current:49});
  assert.deepEqual(shiftResource(49,64,55,'hp'),{ok:true,current:40});
  assert.deepEqual(shiftResource(18,60,72,'mp'),{ok:true,current:30});
  assert.deepEqual(shiftResource(30,72,60,'mp'),{ok:true,current:18});
});
test('滿資源樣本保留缺少零點，零 HP 不救援，零 MP 可隨上限增加', () => {
  assert.equal(shiftResource(55,55,64,'hp').current,64);
  assert.equal(shiftResource(0,55,64,'hp').current,0);
  assert.equal(shiftResource(0,55,40,'hp').current,0);
  assert.equal(shiftResource(0,60,72,'mp').current,12);
});
test('未定的資源下限變化受阻，不自行補成 1 或 0', () => {
  assert.equal(shiftResource(1,55,49,'hp').ok,false);
  assert.equal(shiftResource(1,60,28,'mp').ok,false);
});
test('兩種資源整體預覽；失敗不修改原始樣本', () => {
  const before = Object.freeze({currentHp:40,maxHp:55,currentMp:1,maxMp:60});
  const next = previewChange(before,{...sample(),race:'orc',aptitude:'low',human:[0,0,0,0,0,0]});
  assert.equal(next.ok,false); assert.deepEqual(before,{currentHp:40,maxHp:55,currentMp:1,maxMp:60});
});
test('拒絕未知引用、非法資質、少分點、小數、負點與非人類自由種族點', () => {
  for (const extra of [{race:'TEST-race'}, {profession:'TEST-class'}, {race:'dwarf',aptitude:'high'},
    {allocation:[1,2,2,2,2,2]}, {allocation:[2.5,1.5,2,2,2,2]}, {allocation:[-1,5,2,2,2,2]},
    {allocation:[7,0,0,1,2,2]}, {race:'dwarf',human:[2,0,0,0,0,0]}]) assert.throws(() => derive({...sample(),...extra}));
});
