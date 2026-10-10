// 80d5f32 的 18 項由 Grok 外部回報通過；本輪配點變更與新增案例未執行。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { initialDraft, allocationBudget, allocatedPoints, changePoint, chooseRace, allocationErrors, previewStarter, createSample, evaluate, previewAction,
  loadTestLibrary, resourceFixture, capacity, limits, races, professions, kits, items } from './model.mjs';
const changeClass = (state,id) => previewAction(state,{ type:'class',id });
const equip = (state,position,id) => previewAction(state,{ type:'equipment',position,id });
const configure = (state,position,entry) => previewAction(state,{ type:'skill',position,entry });
// 明確測試配點，不再把 UI 的空白初始草稿當成完成樣本。
const completedDraft = () => ({ ...initialDraft(),allocation:[2,2,2,2,2,2],human:[2,0,0,0,0,0] });
const mageDraft = () => ({ ...completedDraft(),classId:'class.mage',allocation:[2,2,1,3,2,2],human:[2,0,0,0,0,0] });

test('五族 × 四職業：先加種族再乘職業，起始取得固定配套，資料不重發', () => {
  for (const race of races) for (const profession of professions) {
    const draft = { ...completedDraft(),raceId:race.id,classId:profession.id,human:race.free ? [2,0,0,0,0,0] : [0,0,0,0,0,0] };
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
  const draft = completedDraft(); draft.allocation[0] = 1;
  assert.doesNotThrow(() => previewStarter(draft)); assert.throws(() => createSample(draft));
  for (const bad of [[7,1,1,1,1,1],[2.5,1.5,2,2,2,2],[3,2,2,2,2,2],[-1,3,3,3,2,2]]) assert.ok(allocationErrors({ ...completedDraft(),allocation:bad }).length);
  assert.throws(() => createSample({ ...completedDraft(),raceId:'race.elf' }));
});
test('不合格配套保留持有及已學，紅字資料包含當前值、門檻、差額與來源', () => {
  const draft = { ...completedDraft(),allocation:[0,3,3,2,2,2],human:[0,0,0,0,0,2] };
  const p = previewStarter(draft), state = createSample(draft);
  assert.equal(p.planned.slots[0].active,false); assert.equal(p.planned.slots[0].check.missing,4);
  assert.match(p.planned.warnings.find(w => w.name === '重斬').reasons.join(' '),/需要力量 15，目前 11，還差 4 點/);
  assert.deepEqual(state.learned,['heavy']); assert.equal(state.configuration.slots[0],null);
  const weak = previewStarter({ ...draft,classId:'class.archer',allocation:[3,0,3,2,2,2] });
  assert.equal(weak.state.configuration.weapon,null);
  assert.ok(weak.planned.slots[0].reasons.some(r => r.includes('需要生效的弓類')));
});
test('自己的裝備加成、其他裝備及技能加成都不能支撐裝備門檻', () => {
  let state = loadTestLibrary(createSample({ ...completedDraft(),classId:'class.mage',allocation:[1,3,2,2,2,2],human:[0,0,0,2,0,0] }));
  assert.equal(evaluate(state).rows[0].equipmentBase,9);
  assert.throws(() => equip(state,'weapon','sword'),/目前 9，還差 1/);
  assert.throws(() => equip(state,'armor','chainmail'),/目前 9，還差 1/);
  const mage = changeClass(createSample(mageDraft()),'class.swordsman');
  const e = evaluate(mage); assert.equal(e.rows[3].qualification,13); assert.equal(e.rows[3].equipmentBase,11);
  assert.equal(e.equipment.find(g => g.item.id === 'fire-book').active,false);
});
test('所有技能加成都不能支撐自身或其他技能門檻', () => {
  const state = loadTestLibrary(createSample({ ...completedDraft(),allocation:[3,2,2,1,2,2],human:[0,2,0,0,0,0] }));
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
  const swordsman = loadTestLibrary(createSample(completedDraft()));
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
  assert.equal(equip(resourceFixture(createSample(completedDraft()),'zero'),'armor',null).resources.currentHp,0);
  assert.throws(() => capacity({ currentHp:41,maxHp:40,currentMp:0,maxMp:40 },{ maxHp:54,maxMp:54 }));
});
test('起始資源先按無配套出生推導初始化，配套與技能增加容量不補滿', () => {
  const sword = createSample(completedDraft()); assert.equal(sword.resources.currentHp,55); assert.equal(sword.resources.maxHp,58);
  const mage = createSample(mageDraft()); assert.equal(mage.resources.currentMp,72); assert.equal(mage.resources.maxMp,84);
});
test('六格上限、未持有書本、未學技能、重複技能／書本與直接施法邊界', () => {
  const state = createSample(completedDraft());
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
  const state = createSample(completedDraft()), next = loadTestLibrary(state);
  assert.deepEqual(next.configuration,state.configuration); assert.deepEqual(next.resources,state.resources);
  assert.equal(next.mode,'loadout'); assert.deepEqual(next.inventory,items.map(i => i.id));
  assert.deepEqual(loadTestLibrary(next).inventory,next.inventory); assert.equal(next.initialClass,state.initialClass);
});

test('停用防具保留位置但不提供屬性，恢復後才再加入', () => {
  const state = createSample({ ...completedDraft(),raceId:'race.elf',human:[0,0,0,0,0,0] });
  assert.equal(evaluate(state).rows[2].final,9);
  const off = changeClass(state,'class.mage'), result = evaluate(off);
  assert.equal(result.equipment.find(g => g.position === 'armor').active,false);
  assert.equal(off.configuration.armor,'chainmail');
  assert.equal(result.rows[2].equipment,0);
  assert.equal(result.rows[2].qualification,8);
  assert.equal(result.rows[2].final,8);
  assert.equal(evaluate(changeClass(off,'class.swordsman')).rows[2].final,9);
});
test('停用防具不提供護甲，恢復後才再加入', () => {
  const state = createSample({ ...completedDraft(),raceId:'race.elf',human:[0,0,0,0,0,0] });
  assert.equal(evaluate(state).armor,3);
  const off = changeClass(state,'class.mage');
  assert.equal(evaluate(off).armor,0);
  assert.equal(evaluate(changeClass(off,'class.swordsman')).armor,3);
});
test('高與極高資質不自動提供直接施法資格，即使已學且智慧達標', () => {
  const elf = createSample({ ...mageDraft(),raceId:'race.elf',human:[0,0,0,0,0,0] });
  for (const aptitude of ['high','exceptional']) {
    const state = { ...structuredClone(elf),aptitude,learned:['flame'],configuration:{ ...structuredClone(elf.configuration),slots:Array(6).fill(null) } };
    assert.equal(state.directCasting,false);
    assert.ok(evaluate(state).rows[3].qualification >= 15);
    assert.throws(() => configure(state,0,{ skillId:'flame',source:'direct' }),/直接施法資格/);
    assert.equal(evaluate(configure({ ...state,directCasting:true },0,{ skillId:'flame',source:'direct' })).slots[0].active,true);
  }
});
test('其他生效技能的跨屬性加成亦不能支撐新技能資格（隔離測試數值）', async () => {
  // 現有四能力沒有相同需求屬性；只在此隔離模組給火焰箭敏捷 +2，
  // 以真正的跨技能邊界測試需求算法，不增加 UI 內容或改正式／原型名冊。
  const source = await readFile(new URL('./model.mjs',import.meta.url),'utf8');
  const original = "{ id: 'flame', name: '火焰箭', attribute: 3, requirement: 15, bonus: [0,0,0,1,0,0]";
  assert.ok(source.includes(original),'隔離樣本必須匹配現有火焰箭定義');
  const fixture = source.replace(original,original.replace('[0,0,0,1,0,0]','[0,2,0,1,0,0]'));
  const model = await import(`data:text/javascript;base64,${Buffer.from(fixture).toString('base64')}`);
  let state = model.loadTestLibrary(model.createSample({ ...mageDraft(),allocation:[2,4,1,3,1,1] }));
  state = model.previewAction(state,{ type:'equipment',position:'weapon',id:'dagger' });
  const calculated = model.evaluate(state);
  assert.equal(calculated.slots[0].active,true);
  assert.equal(calculated.rows[1].qualification,13);
  assert.equal(calculated.rows[1].final,15);
  assert.throws(() => model.previewAction(state,{ type:'skill',position:1,entry:{ skillId:'stab',source:'learned' } }),/目前 13，還差 2/);
});
test('普通資質轉職的 MP 包含 +20，並分開未截低與滿值截低案例', () => {
  const mage = createSample(mageDraft());
  assert.deepEqual(mage.resources,{ currentHp:52,maxHp:52,currentMp:72,maxMp:84 });
  const off = changeClass(mage,'class.swordsman');
  assert.equal(off.resources.maxMp,72); assert.equal(off.resources.currentMp,72);
  assert.equal(changeClass(off,'class.mage').resources.currentMp,72);
  const full = resourceFixture(mage,'full'), clipped = changeClass(full,'class.swordsman');
  assert.equal(full.resources.currentMp,84);
  assert.equal(clipped.resources.currentMp,72); assert.equal(clipped.resources.maxMp,72);
  const back = changeClass(clipped,'class.mage');
  assert.equal(back.resources.currentMp,72); assert.equal(back.resources.maxMp,84);
});


test('配點從零開始：人類一組14點，其他種族12點；空草稿可預覽不能建立', () => {
  for (const race of races) {
    const draft = chooseRace(initialDraft(),race.id);
    assert.deepEqual(allocatedPoints(draft),[0,0,0,0,0,0]);
    assert.deepEqual(draft.human,[0,0,0,0,0,0]);
    assert.equal(allocationBudget(draft),race.free ? 14 : 12);
    assert.doesNotThrow(() => previewStarter(draft));
    assert.throws(() => createSample(draft),/完成合法/);
  }
  const first = initialDraft(), second = initialDraft(); first.allocation[0] = 1;
  assert.equal(second.allocation[0],0,'初始草稿不能共用可變陣列');
});
test('人類單一額度加減：逐點分完14、阻擋第15點、可回退再分配', () => {
  const original = initialDraft(); let draft = original;
  for (let i = 0; i < 6; i++) for (let n = 0; n < (i === 0 ? 4 : 2); n++) draft = changePoint(draft,i,1);
  assert.deepEqual(allocatedPoints(original),[0,0,0,0,0,0]);
  assert.deepEqual(allocatedPoints(draft),[4,2,2,2,2,2]);
  assert.deepEqual(allocationErrors(draft),[]);
  assert.deepEqual(createSample(draft).resources,createSample(completedDraft()).resources);
  assert.deepEqual(evaluate(createSample(draft)).rows,evaluate(createSample(completedDraft())).rows);
  assert.throws(() => changePoint(draft,1,1));
  draft = changePoint(draft,0,-1);
  assert.ok(allocationErrors(draft).length);
  assert.throws(() => createSample(draft));
  draft = changePoint(draft,1,1);
  assert.deepEqual(allocatedPoints(draft),[3,3,2,2,2,2]);
  assert.deepEqual(allocationErrors(draft),[]);
  assert.throws(() => changePoint(initialDraft(),0,-1));
  for (const [i,delta] of [[6,1],[-1,1],[0,0],[0,2],[0,0.5]]) assert.throws(() => changePoint(draft,i,delta));
});
test('合併額度保持原單項上限：人類+8、其他+6；人類7+7亦能完成', () => {
  let human = initialDraft();
  for (let n = 0; n < 8; n++) human = changePoint(human,0,1);
  assert.throws(() => changePoint(human,0,1));
  for (let n = 0; n < 6; n++) human = changePoint(human,1,1);
  assert.deepEqual(allocatedPoints(human),[8,6,0,0,0,0]);
  assert.deepEqual(allocationErrors(human),[]);
  human = changePoint(changePoint(human,0,-1),1,1);
  assert.deepEqual(allocatedPoints(human),[7,7,0,0,0,0]);
  assert.deepEqual(allocationErrors(human),[]);
  for (const race of races.filter(r => !r.free)) {
    let draft = chooseRace(initialDraft(),race.id);
    for (let n = 0; n < 6; n++) draft = changePoint(draft,0,1);
    assert.throws(() => changePoint(draft,0,1));
    for (let n = 0; n < 6; n++) draft = changePoint(draft,1,1);
    assert.deepEqual(allocationErrors(draft),[]);
    assert.throws(() => changePoint(draft,2,1));
  }
});
test('同族保持合併點數；換族移除舊種族點，切回人類多2點待玩家分配', () => {
  let human = initialDraft();
  for (let i = 0; i < 6; i++) for (let n = 0; n < (i === 0 ? 4 : 2); n++) human = changePoint(human,i,1);
  assert.deepEqual(chooseRace(human,'race.human'),human);
  const elf = chooseRace(human,'race.elf');
  assert.deepEqual(elf.allocation,human.allocation);
  assert.deepEqual(elf.human,[0,0,0,0,0,0]);
  assert.equal(allocatedPoints(elf).reduce((a,b) => a+b,0),12);
  const back = chooseRace(elf,'race.human');
  assert.deepEqual(allocatedPoints(back),allocatedPoints(elf));
  assert.equal(allocationBudget(back) - allocatedPoints(back).reduce((a,b) => a+b,0),2);
  assert.throws(() => createSample(back));
  const finished = changePoint(changePoint(back,0,1),0,1);
  assert.deepEqual(allocatedPoints(finished),allocatedPoints(human));
  assert.deepEqual(allocationErrors(finished),[]);
});
