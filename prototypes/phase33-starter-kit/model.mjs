// 僅供獨立原型。名冊鏡像由 catalog.test.ts 核對；物品／技能為已確認樣本。
function freeze(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}
export const attributes = freeze(['strength', 'dexterity', 'constitution', 'intelligence', 'perception', 'charisma']);
export const labels = freeze(['力量', '敏捷', '體質', '智慧', '感知', '魅力']);
export const versions = freeze({ race: 2, profession: 1, prototype: 1 });
export const races = freeze([
  { id: 'race.human', name: '人類', bonuses: [0,0,0,0,0,0], free: 2, aptitudePercent: [20,65,14,1], fixtureAptitude: 'ordinary' },
  { id: 'race.elf', name: '精靈', bonuses: [-1,0,-2,1,2,0], free: 0, aptitudePercent: [0,0,70,30], fixtureAptitude: 'high' },
  { id: 'race.dwarf', name: '矮人', bonuses: [1,-1,2,0,0,-2], free: 0, aptitudePercent: [0,100,0,0], fixtureAptitude: 'ordinary' },
  { id: 'race.orc', name: '獸人', bonuses: [0,2,0,-3,2,-1], free: 0, aptitudePercent: [85,14,1,0], fixtureAptitude: 'low' },
  { id: 'race.dragonborn', name: '龍裔', bonuses: [2,0,2,1,0,0], free: 0, aptitudePercent: [0,65,30,5], fixtureAptitude: 'ordinary' },
]);
export const professions = freeze([
  { id: 'class.swordsman', name: '劍士', primary: 0, passive: '劍術主動技能命中後傷害 +10%（本頁不執行戰鬥）' },
  { id: 'class.archer', name: '弓箭手', primary: 4, passive: '射擊主動技能攻擊判定 +1（本頁不執行戰鬥）' },
  { id: 'class.scout', name: '斥候', primary: 1, passive: '閃避判定 +1（本頁不執行戰鬥）' },
  { id: 'class.mage', name: '魔術師', primary: 3, passive: '合格施法總 MP 成本 −10%（本頁不執行施法）' },
]);
export const aptitudes = freeze({ low: { name: '低', bonus: 0 }, ordinary: { name: '普通', bonus: 20 }, high: { name: '高', bonus: 40 }, exceptional: { name: '極高', bonus: 70 } });
export const items = freeze([
  { id: 'sword', name: '單手劍', kind: 'weapon', family: 'sword', attribute: 0, requirement: 10, bonus: [1,0,0,0,0,0], armor: 0 },
  { id: 'bow', name: '短弓', kind: 'weapon', family: 'bow', attribute: 1, requirement: 10, bonus: [0,0,0,0,1,0], armor: 0 },
  { id: 'dagger', name: '匕首', kind: 'weapon', family: 'dagger', attribute: 1, requirement: 10, bonus: [0,1,0,0,0,0], armor: 0 },
  { id: 'staff', name: '普通木杖', kind: 'weapon', family: 'staff', attribute: 0, requirement: 6, bonus: [0,0,0,0,0,0], armor: 0 },
  { id: 'chainmail', name: '鎖甲', kind: 'armor', attribute: 0, requirement: 10, bonus: [0,0,1,0,0,0], armor: 3 },
  { id: 'leather', name: '皮甲', kind: 'armor', attribute: 1, requirement: 10, bonus: [0,1,0,0,0,0], armor: 2 },
  { id: 'robe', name: '布袍', kind: 'armor', attribute: 3, requirement: 10, bonus: [0,0,0,2,0,0], armor: 1 },
  { id: 'fire-book', name: '火焰箭魔法書', kind: 'book', spell: 'flame', attribute: 3, requirement: 12, bonus: [0,0,0,0,0,0], armor: 0 },
]);
export const skills = freeze([
  { id: 'heavy', name: '重斬', attribute: 0, requirement: 15, bonus: [1,0,0,0,0,0], weapon: 'sword', description: '單體劍術；須有生效劍類武器。' },
  { id: 'aim', name: '瞄準射擊', attribute: 4, requirement: 15, bonus: [0,0,0,0,1,0], weapon: 'bow', description: '單體射擊；須有生效弓類武器。原型不計箭矢。' },
  { id: 'stab', name: '迅刺', attribute: 1, requirement: 15, bonus: [0,1,0,0,0,0], weapon: 'dagger', description: '單體迅速刺擊；須有生效匕首。不是額外攻擊。' },
  { id: 'flame', name: '火焰箭', attribute: 3, requirement: 15, bonus: [0,0,0,1,0,0], description: '單體火系法術；書本來源不等於永久學會，無木杖需求。' },
]);
export const kits = freeze({
  'class.swordsman': { weapon: 'sword', armor: 'chainmail', skill: 'heavy', proficiency: '劍類' },
  'class.archer': { weapon: 'bow', armor: 'leather', skill: 'aim', proficiency: '弓類' },
  'class.scout': { weapon: 'dagger', armor: 'leather', skill: 'stab', proficiency: '匕首類' },
  'class.mage': { weapon: 'staff', armor: 'robe', book: 'fire-book', skill: 'flame', proficiency: '杖類' },
});
export const findItem = id => items.find(x => x.id === id);
export const findSkill = id => skills.find(x => x.id === id);
export const findRace = id => races.find(x => x.id === id);
export const findProfession = id => professions.find(x => x.id === id);
const total = a => a.reduce((sum, n) => sum + n, 0);
const points = (a, max) => Array.isArray(a) && a.length === 6 && Object.keys(a).length === 6 && a.every(n => Number.isSafeInteger(n) && n >= 0 && n <= max);
function need(condition, message) { if (!condition) throw new Error(message); }
export function initialDraft() {
  return { raceId: 'race.human', classId: 'class.swordsman', allocation: [2,2,2,2,2,2], human: [2,0,0,0,0,0] };
}
export function allocationErrors(draft, complete = true) {
  const errors = [], race = findRace(draft.raceId);
  if (!race || !findProfession(draft.classId)) errors.push('請選擇五族及四初階職業中的一項。');
  if (!points(draft.allocation, 6) || (complete ? total(draft.allocation) !== 12 : total(draft.allocation) > 12)) errors.push('自由分配須合共 12 點，每項最多加 6 點。');
  if (!points(draft.human, 2) || (race && (complete ? total(draft.human) !== race.free : total(draft.human) > race.free))) errors.push('人類另分配 2 點；其他種族不用人類加成。');
  return errors;
}
function baseRows(draft, classId) {
  need(allocationErrors(draft, false).length === 0, '配點樣本不合法。');
  const race = findRace(draft.raceId), profession = findProfession(classId);
  need(profession, '職業樣本不存在。');
  return attributes.map((key, i) => {
    const intrinsic = 8 + draft.allocation[i] + race.bonuses[i] + draft.human[i];
    const multiplier = profession.primary === i ? 1.25 : 1;
    return { key, name: labels[i], intrinsic, multiplier, equipmentBase: Math.floor(intrinsic * multiplier) };
  });
}
function requirement(definition, values) {
  const current = values[definition.attribute], missing = Math.max(0, definition.requirement - current);
  return { current, required: definition.requirement, missing, attribute: definition.attribute,
    text: `需要${labels[definition.attribute]} ${definition.requirement}，目前 ${current}${missing ? `，還差 ${missing} 點` : '，已達標'}` };
}
const blankConfiguration = () => ({ weapon: null, armor: null, accessory1: null, accessory2: null, slots: Array(6).fill(null) });
function validateConfiguration(state, configuration) {
  need(configuration && Object.keys(configuration).length === 5 && ['weapon','armor','accessory1','accessory2','slots'].every(k => Object.hasOwn(configuration,k)), '配裝欄位不合法。');
  for (const key of ['weapon','armor']) {
    const id = configuration[key];
    need(id === null || (state.inventory.includes(id) && findItem(id)?.kind === key), '物品未持有或不屬於此欄位。');
  }
  need(configuration.accessory1 === null && configuration.accessory2 === null, '本批樣本沒有飾品內容。');
  need(Array.isArray(configuration.slots) && configuration.slots.length === 6 && Object.keys(configuration.slots).length === 6, '主動技能必須保留六格。');
  const skillIds = new Set(), books = new Set();
  for (const entry of configuration.slots) {
    if (entry === null) continue;
    const skill = findSkill(entry.skillId);
    need(skill && !skillIds.has(skill.id), '技能不存在或已配置於其他格。');
    skillIds.add(skill.id);
    if (entry.source === 'book') {
      const book = findItem(entry.bookId);
      need(skill.id === 'flame' && book?.kind === 'book' && book.spell === skill.id && state.inventory.includes(book.id) && !books.has(book.id), '須綁定持有且未重複配置的對應魔法書。');
      books.add(book.id);
    } else {
      need(entry.source === (skill.id === 'flame' ? 'direct' : 'learned') && state.learned.includes(skill.id), '技能尚未永久學會或來源不合法。');
    }
  }
}
// 配點預覽不使用資質、資格、龍息或亂數，也不初始化資源。
export function evaluate(state, configuration = state.configuration, classId = state.currentClass) {
  validateConfiguration(state, configuration);
  const rows = baseRows(state.birth, classId), base = rows.map(x => x.equipmentBase);
  const gear = ['weapon','armor'].flatMap(position => configuration[position] ? [{ position, id: configuration[position] }] : []);
  configuration.slots.forEach((entry, i) => { if (entry?.source === 'book') gear.push({ position: `book-${i}`, id: entry.bookId }); });
  const equipment = gear.map(entry => {
    const item = findItem(entry.id), check = requirement(item, base);
    return { ...entry, item, check, active: check.missing === 0, reasons: check.missing ? [check.text] : [] };
  });
  const equipmentBonus = attributes.map((_, i) => equipment.reduce((sum, g) => sum + (g.active ? g.item.bonus[i] : 0), 0));
  const qualification = base.map((n,i) => n + equipmentBonus[i]);
  const slots = configuration.slots.map((entry, i) => {
    if (!entry) return null;
    const skill = findSkill(entry.skillId), check = requirement(skill, qualification), reasons = check.missing ? [check.text] : [];
    if (skill.weapon && !equipment.some(g => g.position === 'weapon' && g.active && g.item.family === skill.weapon)) {
      reasons.push(`需要生效的${{ sword: '劍類', bow: '弓類', dagger: '匕首類' }[skill.weapon]}武器。`);
    }
    if (entry.source === 'book' && !equipment.find(g => g.position === `book-${i}`)?.active) reasons.push('綁定魔法書未生效，失去書本施法來源。');
    if (entry.source === 'direct' && !state.directCasting) reasons.push('沒有獨立的直接施法資格；高資質或職業不賦予資格。');
    return { ...entry, skill, check, active: reasons.length === 0, reasons, position: i };
  });
  const skillBonus = attributes.map((_,i) => slots.reduce((sum,s) => sum + (s?.active ? s.skill.bonus[i] : 0),0));
  rows.forEach((r,i) => { r.equipment = equipmentBonus[i]; r.qualification = qualification[i]; r.skill = skillBonus[i]; r.final = qualification[i] + skillBonus[i]; r.modifier = Math.floor((r.final - 10) / 2); });
  const warnings = [...equipment.filter(g => !g.active).map(g => ({ name: g.item.name, reasons: g.reasons })), ...slots.filter(s => s && !s.active).map(s => ({ name: s.skill.name, reasons: s.reasons }))];
  return { rows, equipment, slots, warnings, armor: equipment.reduce((sum,g) => sum + (g.active ? g.item.armor : 0),0) };
}
function plannedKit(draft) {
  need(allocationErrors(draft, false).length === 0, '配點樣本不合法。');
  const kit = kits[draft.classId], configuration = blankConfiguration();
  configuration.weapon = kit.weapon; configuration.armor = kit.armor;
  configuration.slots[0] = kit.book ? { skillId: kit.skill, source: 'book', bookId: kit.book } : { skillId: kit.skill, source: 'learned' };
  return { mode: 'starter', birth: structuredClone(draft), initialClass: draft.classId, currentClass: draft.classId,
    inventory: [kit.weapon, kit.armor, ...(kit.book ? [kit.book] : [])], learned: kit.book ? [] : [kit.skill],
    proficiency: kit.proficiency, directCasting: false, configuration };
}
export function previewStarter(draft) {
  const state = plannedKit(draft), planned = evaluate(state);
  const configuration = structuredClone(state.configuration);
  for (const key of ['weapon','armor']) if (!planned.equipment.find(g => g.position === key)?.active) configuration[key] = null;
  if (!planned.slots[0].active) configuration.slots[0] = null;
  return { state: { ...state, configuration }, planned, actual: evaluate(state, configuration) };
}
export function limits(evaluation, aptitude) {
  need(aptitudes[aptitude], '樣本資質不合法。');
  return { maxHp: 25 + evaluation.rows[2].final * 3, maxMp: evaluation.rows[3].final * 4 + aptitudes[aptitude].bonus };
}
export function capacity(before, next) {
  need(before && [before.currentHp,before.currentMp,before.maxHp,before.maxMp,next.maxHp,next.maxMp].every(Number.isSafeInteger)
    && before.maxHp >= 1 && next.maxHp >= 1 && before.maxMp >= 0 && next.maxMp >= 0
    && before.currentHp >= 0 && before.currentHp <= before.maxHp && before.currentMp >= 0 && before.currentMp <= before.maxMp, '資源樣本不合法。');
  return { ...next, currentHp: Math.min(before.currentHp,next.maxHp), currentMp: Math.min(before.currentMp,next.maxMp) };
}
export function createSample(draft) {
  need(allocationErrors(draft).length === 0, '請完成合法的點數分配。');
  const { state, actual } = previewStarter(draft), aptitude = findRace(draft.raceId).fixtureAptitude;
  const birthLimits = limits(evaluate(state, blankConfiguration()), aptitude);
  const resources = capacity({ ...birthLimits, currentHp: birthLimits.maxHp, currentMp: birthLimits.maxMp }, limits(actual, aptitude));
  return freeze({ ...state, aptitude, resources });
}
// 新配置必須生效；既有配置可因職業／來源變動失效而留在原位。
export function previewAction(state, action) {
  const next = structuredClone(state);
  if (action.type === 'class') {
    need(findProfession(action.id), '職業樣本不存在。'); next.currentClass = action.id;
  } else if (action.type === 'equipment') {
    need(['weapon','armor'].includes(action.position), '裝備欄位不合法。');
    next.configuration[action.position] = action.id;
  } else if (action.type === 'skill') {
    need(Number.isInteger(action.position) && action.position >= 0 && action.position < 6, '技能格不合法。');
    next.configuration.slots[action.position] = action.entry === null ? null : structuredClone(action.entry);
  } else throw new Error('不支援這項原型操作。');
  const calculated = evaluate(next);
  if (action.type === 'equipment' && action.id !== null) {
    const gear = calculated.equipment.find(g => g.position === action.position);
    need(gear?.active, gear?.reasons.join('；') || '新裝備不符合需求，不能配置。');
  }
  if (action.type === 'skill' && action.entry !== null) {
    const skill = calculated.slots[action.position];
    need(skill?.active, skill?.reasons.join('；') || '新技能或其來源不符合需求，不能配置。');
  }
  next.resources = capacity(state.resources, limits(calculated, state.aptitude));
  return freeze(next);
}
export function loadTestLibrary(state) {
  return freeze({ ...structuredClone(state), mode: 'loadout', inventory: items.map(x => x.id), learned: ['heavy','aim','stab'] });
}
export function resourceFixture(state, kind) {
  need(['injured','zero','full'].includes(kind), '資源測試情境不存在。');
  const next = structuredClone(state), { maxHp, maxMp } = state.resources;
  next.resources = { maxHp, maxMp, currentHp: kind === 'zero' ? 0 : kind === 'full' ? maxHp : Math.min(40,maxHp),
    currentMp: kind === 'full' ? maxMp : kind === 'zero' ? 0 : Math.min(40,maxMp) };
  return freeze(next);
}
