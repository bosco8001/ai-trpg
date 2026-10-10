// 已準備，尚未執行。依 AGENTS.md 交由指定 Grok bot 驗證。
import test from 'node:test';
import assert from 'node:assert/strict';
import { initialDraft, allocationErrors, previewStarter, createSample, evaluate, previewAction,
  loadTestLibrary, resourceFixture, capacity, limits, races, professions, kits, items } from './model.mjs';
const changeClass = (state,id) => previewAction(state,{ type:'class',id });
const equip = (state,position,id) => previewAction(state,{ type:'equipment',position,id });
const configure = (state,position,entry) => previewAction(state,{ type:'skill',position,entry });
const mageDraft = () => ({ ...initialDraft(),classId:'class.mage',allocation:[2,2,1,3,2,2],human:[2,0,0,0,0,0] });

test('五族 × 四職業：先加種族再乘職業，起始取得固定配套，資料不重發', () => {
  for (const race of races) for (const profession of professions) {
    const draft = { ...initialDraft(),raceId:race.id,classId:profession.id,human:race.free ? [2,0,0,0,0,0] : [0,0,0,0,0,0] };
    const state = createSample(draft), calculated = evaluate(state), kit = kits[profession.id];
    calculated.rows.forEach((row,i) => {
      assert.equal(row.intrinsic,10+race.bonuses[i]+draft.human[i]);
      assert.equal(row.equipmentBase,Math.floor(row.intrinsic * (profession.primary === i ? 1.25 : 1)));
    });
    assert.deepEqual(state.inventory,[kit.weapon,kit.armor,...(kit.book ? [kit.book] : [])]);
    assert.deepEqual(state.learned,kit.book ? [] : [kit.skill]);
    const switched = changeClass(state,'class.mage');
    assert.deepEqual(switched.inventory,state.inventory); assert.deepEqual(switched.learned,state.learned);
    assert.equal(switched.initialClass,state.initialClass); assert.equal(switched.proficiency,state.proficiency);
    assert.equal(state.configuration.slots.length,6);
  }
});
test('配點未完成可預覽；建立阻擋少分、多分、小數、單項超限與錯誤種族點', () => {
  const draft = initialDraft(); draft.allocation[0] = 1;
  assert.doesNotThrow(() => previewStarter(draft)); assert.throws(() => createSample(draft));
  for (const bad of [[7,1,1,1,1,1],[2.5,1.5,2,2,2,2],[3,2,2,2,2,2],[-1,3,3,3,2,2]]) assert.ok(allocationErrors({ ...initialDraft(),allocation:bad }).length);
  assert.throws(() => createSample({ ...initialDraft(),raceId:'race.elf' }));
});
test('不合格配套保留持有及已學，紅字資料包含當前值、門檻、差額與來源', () => {
  const draft = { ...initialDraft(),allocation:[0,3,3,2,2,2],human:[0,0,0,0,0,2] };
  const p = previewStarter(draft), state = createSample(draft);
  assert.equal(p.planned.slots[0].active,false); assert.equal(p.planned.slots[0].check.missing,4);
  assert.match(p.planned.warnings.find(w => w.name === '重斬').reasons.join(' '),/需要力量 15，目前 11，還差 4 點/);
  assert.deepEqual(state.learned,['heavy']); assert.equal(state.configuration.slots[0],null);
  const weak = previewStarter({ ...draft,classId:'class.archer',allocation:[3,0,3,2,2,2] });
  assert.equal(weak.state.configuration.weapon,null);
  assert.ok(weak.planned.slots[0].reasons.some(r => r.includes('需要生效的弓類')));
});
test('自己的裝備加成、其他裝備及技能加成都不能支撐裝備門檻', () => {
  let state = loadTestLibrary(createSample({ ...initialDraft(),classId:'class.mage',allocation:[1,3,2,2,2,2],human:[0,0,0,2,0,0] }));
  assert.equal(evaluate(state).rows[0].equipmentBase,9);
  assert.throws(() => equip(state,'weapon','sword'),/目前 9，還差 1/);
  assert.throws(() => equip(state,'armor','chainmail'),/目前 9，還差 1/);
  const mage = changeClass(createSample(mageDraft()),'class.swordsman');
  const e = evaluate(mage); assert.equal(e.rows[3].qualification,13); assert.equal(e.rows[3].equipmentBase,11);
  assert.equal(e.equipment.find(g => g.item.id === 'fire-book').active,false);
});
test('所有技能加成都不能支撐自身或其他技能門檻', () => {
  const state = loadTestLibrary(createSample({ ...initialDraft(),allocation:[3,2,2,1,2,2],human:[0,2,0,0,0,0] }));
  const next = equip(equip(state,'armor','leather'),'weapon','dagger');
  assert.equal(evaluate(next).rows[1].qualification,14);
  assert.throws(() => configure(next,1,{ skillId:'stab',source:'learned' }),/目前 14，還差 1/);
});
test('魔法書無木杖需求，不永久學會；裝備與法術門檻獨立', () => {
  const mage = createSample(mageDraft()), e = evaluate(mage);
  assert.equal(e.rows[3].equipmentBase,13); assert.equal(e.rows[3].qualification,15); assert.equal(e.rows[3].final,16);
  assert.deepEqual(mage.learned,[]); assert.equal(e.slots[0].active,true);
  assert.equal(evaluate(equip(mage,'weapon',null)).slots[0].active,true);
  const belowSpell = createSample({ ...mageDraft(),allocation:[2,2,2,2,2,2] });
  assert.equal(belowSpell.configuration.slots[0],null);
  assert.ok(belowSpell.inventory.includes('fire-book')); assert.deepEqual(belowSpell.learned,[]);
});
test('職業切換保留停用書本與技能格，恢復來源後自動生效且不補魔', () => {
  const mage = createSample(mageDraft()), oldResources = { ...mage.resources };
  const off = changeClass(mage,'class.swordsman'), offEval = evaluate(off);
  assert.deepEqual(off.configuration,mage.configuration); assert.equal(offEval.slots[0].active,false);
  assert.equal(offEval.rows[3].skill,0); assert.equal(offEval.rows[3].final,13);
  const back = changeClass(off,'class.mage'); assert.equal(evaluate(back).slots[0].active,true);
  assert.equal(back.resources.maxMp,oldResources.maxMp);
  assert.equal(back.resources.currentMp,Math.min(oldResources.currentMp,off.resources.maxMp));
});
test('合法武器替換停用原技能；恢復武器重新生效，不刪熟練', () => {
  const swordsman = loadTestLibrary(createSample(initialDraft()));
  const off = equip(swordsman,'weapon','staff');
  assert.equal(evaluate(off).slots[0].active,false); assert.equal(evaluate(off).rows[0].skill,0);
  assert.deepEqual(off.configuration.slots,swordsman.configuration.slots);
  const back = equip(off,'weapon','sword'); assert.equal(evaluate(back).slots[0].active,true);
  assert.equal(back.proficiency,'劍類');
});
test('預覽不修改原配置、資源或配點；一次完整結果更新不經中間截低', () => {
  const state = resourceFixture(createSample(mageDraft()),'full'), original = structuredClone(state);
  const next = previewAction(state,{ type:'class',id:'class.swordsman' });
  assert.deepEqual(state,original); assert.notStrictEqual(next,state);
  assert.deepEqual(next.resources,capacity(state.resources,limits(evaluate(next),state.aptitude)));
});
test('容量提高不補充，降低只截超出，重新提高不補回，HP0不復活', () => {
  const raised = capacity({ currentHp:40,maxHp:40,currentMp:40,maxMp:40 },{ maxHp:54,maxMp:54 });
  assert.deepEqual(raised,{ currentHp:40,maxHp:54,currentMp:40,maxMp:54 });
  const low = capacity({ currentHp:50,maxHp:54,currentMp:50,maxMp:54 },{ maxHp:40,maxMp:40 });
  assert.deepEqual(capacity(low,{ maxHp:54,maxMp:54 }),raised);
  assert.equal(capacity({ currentHp:0,maxHp:40,currentMp:0,maxMp:40 },{ maxHp:54,maxMp:54 }).currentHp,0);
  assert.equal(equip(resourceFixture(createSample(initialDraft()),'zero'),'armor',null).resources.currentHp,0);
  assert.throws(() => capacity({ currentHp:41,maxHp:40,currentMp:0,maxMp:40 },{ maxHp:54,maxMp:54 }));
});
test('起始資源先按無配套出生推導初始化，配套與技能增加容量不補滿', () => {
  const sword = createSample(initialDraft()); assert.equal(sword.resources.currentHp,55); assert.equal(sword.resources.maxHp,58);
  const mage = createSample(mageDraft()); assert.equal(mage.resources.currentMp,72); assert.equal(mage.resources.maxMp,84);
});
test('六格上限、未持有書本、未學技能、重複技能／書本與直接施法邊界', () => {
  const state = createSample(initialDraft());
  assert.throws(() => configure(state,6,null));
  assert.throws(() => configure(state,1,{ skillId:'heavy',source:'learned' }),/已配置/);
  assert.throws(() => configure(state,1,{ skillId:'flame',source:'book',bookId:'fire-book' }),/持有/);
  assert.throws(() => configure(state,1,{ skillId:'stab',source:'learned' }),/未永久學會/);
  assert.throws(() => configure(state,1,{ skillId:'flame',source:'direct' }),/未永久學會/);
  const mage = createSample(mageDraft());
  assert.throws(() => configure(mage,1,{ skillId:'flame',source:'book',bookId:'fire-book' }),/已配置/);
  const learnedMage = { ...structuredClone(mage),learned:['flame'],configuration:{ ...structuredClone(mage.configuration),slots:Array(6).fill(null) } };
  assert.throws(() => configure(learnedMage,0,{ skillId:'flame',source:'direct' }),/直接施法資格/);
  assert.equal(evaluate(configure({ ...learnedMage,directCasting:true },0,{ skillId:'flame',source:'direct' })).slots[0].active,true);
});
test('測試庫是明確額外樣本，不自動配置、補血或重發物品', () => {
  const state = createSample(initialDraft()), next = loadTestLibrary(state);
  assert.deepEqual(next.configuration,state.configuration); assert.deepEqual(next.resources,state.resources);
  assert.equal(next.mode,'loadout'); assert.deepEqual(next.inventory,items.map(i => i.id));
  assert.deepEqual(loadTestLibrary(next).inventory,next.inventory); assert.equal(next.initialClass,state.initialClass);
});
