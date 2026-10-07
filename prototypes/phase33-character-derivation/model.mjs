// 獨立原型資料鏡像：正式五族 v2／四職業 v1；不寫入遊戲、不代表已開放職業。
export const attributes = Object.freeze([
  ['strength', '力量'], ['dexterity', '敏捷'], ['constitution', '體質'],
  ['intelligence', '智慧'], ['perception', '感知'], ['charisma', '魅力'],
].map(Object.freeze));
export const races = Object.freeze([
  { id: 'human', name: '人類', bonuses: [0,0,0,0,0,0], aptitudes: ['low','ordinary','high','exceptional'] },
  { id: 'elf', name: '精靈', bonuses: [-1,0,-2,1,2,0], aptitudes: ['high','exceptional'] },
  { id: 'dwarf', name: '矮人', bonuses: [1,-1,2,0,0,-2], aptitudes: ['ordinary'] },
  { id: 'orc', name: '獸人', bonuses: [0,2,0,-3,2,-1], aptitudes: ['low','ordinary','high'] },
  { id: 'dragonborn', name: '龍裔', bonuses: [2,0,2,1,0,0], aptitudes: ['ordinary','high','exceptional'] },
].map(r => Object.freeze({ ...r, bonuses: Object.freeze(r.bonuses), aptitudes: Object.freeze(r.aptitudes) })));
export const classes = Object.freeze([
  { id: 'swordsman', name: '劍士', primary: 'strength' },
  { id: 'archer', name: '弓箭手', primary: 'perception' },
  { id: 'scout', name: '斥候', primary: 'dexterity' },
  { id: 'mage', name: '魔術師', primary: 'intelligence' },
].map(Object.freeze));
export const aptitudes = Object.freeze({ low: Object.freeze(['低',0]), ordinary: Object.freeze(['普通',20]), high: Object.freeze(['高',40]), exceptional: Object.freeze(['極高',70]) });

export function sample() {
  return { race: 'human', profession: 'swordsman', aptitude: 'ordinary',
    allocation: [2,2,2,2,2,2], human: [2,0,0,0,0,0] };
}

export function derive(input) {
  const race = races.find(r => r.id === input.race);
  const profession = classes.find(c => c.id === input.profession);
  if (!race || !profession || !race.aptitudes.includes(input.aptitude)) throw new Error('請選擇有效的樣本種族、職業與資質。');
  const validPoints = (a, max, sum) => Array.isArray(a) && a.length === 6
    && a.every(n => Number.isSafeInteger(n) && n >= 0 && n <= max) && a.reduce((x,y) => x+y,0) === sum;
  if (!validPoints(input.allocation,6,12)) throw new Error('請分配完整 12 點；每項可加 0～6 點，基礎分配後最高 14。');
  if (!validPoints(input.human,2,race.id === 'human' ? 2 : 0)) throw new Error('人類須分配 2 點種族加成；其他種族不使用這 2 點。');
  const rows = attributes.map(([key,name],i) => {
    const base = 8 + input.allocation[i];
    const racial = race.bonuses[i] + input.human[i];
    const intrinsic = base + racial;
    const factor = key === profession.primary ? 1.25 : 1;
    const qualification = Math.floor(intrinsic * factor);
    // 本切片樣本沒有裝備／技能加成，因此最終屬性等於資格數值。
    return Object.freeze({ key, name, base, racial, intrinsic, factor, qualification,
      final: qualification, modifier: Math.floor((qualification - 10) / 2) });
  });
  return Object.freeze({ rows: Object.freeze(rows), maxHp: 25 + rows[2].final * 3,
    maxMp: rows[3].final * 4 + aptitudes[input.aptitude][1] });
}

// 待定的低於資源下限情況明確受阻；不猜死亡、救援、最低 1 或負數截低規則。
export function shiftResource(current, oldMax, newMax, kind) {
  if (!['hp','mp'].includes(kind) || ![current,oldMax,newMax].every(Number.isSafeInteger)
    || oldMax < (kind === 'hp' ? 1 : 0) || newMax < (kind === 'hp' ? 1 : 0)
    || current < 0 || current > oldMax) throw new Error('資源樣本不合法。');
  if (kind === 'hp' && current === 0) return Object.freeze({ ok: true, current: 0 });
  const next = current + newMax - oldMax;
  if (next < (kind === 'hp' ? 1 : 0)) return Object.freeze({ ok: false,
    reason: kind === 'hp' ? '下降後 HP 低於 1 的處理待確認，樣本尚未更新。' : '下降後 MP 小於 0 的處理待確認，樣本尚未更新。' });
  return Object.freeze({ ok: true, current: next });
}

export function previewChange(before, nextInput) {
  const calculated = derive(nextInput);
  const hp = shiftResource(before.currentHp,before.maxHp,calculated.maxHp,'hp');
  const mp = shiftResource(before.currentMp,before.maxMp,calculated.maxMp,'mp');
  if (!hp.ok || !mp.ok) return Object.freeze({ ok: false, reason: !hp.ok ? hp.reason : mp.reason });
  return Object.freeze({ ok: true, calculated, currentHp: hp.current, currentMp: mp.current });
}
