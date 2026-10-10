import { attributes, labels, races, professions, aptitudes, items, skills, kits, findItem, findSkill,
  findRace, findProfession, initialDraft, allocationBudget, allocatedPoints, changePoint, chooseRace, allocationErrors, previewStarter, createSample, evaluate,
  previewAction, loadTestLibrary, resourceFixture } from './model.mjs';

// 正式狀態、保存及 AI 不參與此頁。草稿／計算與 DOM 呈現分開。
const screen = document.querySelector('#screen'), navigation = document.querySelector('#navigation');
const feedback = document.querySelector('#feedback'), dialog = document.querySelector('#sheet');
const sheetHeader = document.querySelector('#sheet-header'), sheetBody = document.querySelector('#sheet-body');
const sheetFooter = document.querySelector('#sheet-footer');
const app = document.querySelector('.app'), masthead = document.querySelector('.masthead');
let draft = initialDraft(), character = null, view = 'allocation', submitted = false;
let stack = [], returnFocus = null;
const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sum = a => a.reduce((s,n) => s+n,0);
const signed = n => n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '0';
const glyphs = {
  sword: '<path d="m15 3 6 0 0 6-10 10-6-6Z M3 21l5-5 M4 12l8 8"/>',
  bow: '<path d="M5 3c17 2 17 16 0 18l6-9Z M3 12h18 M17 8l4 4-4 4"/>',
  dagger: '<path d="m14 3 6 1 1 6-11 9-5-5Z M3 21l5-5 M3 12l9 9"/>',
  rune: '<path d="m12 2 8 10-8 10-8-10Z M8 12h8 M12 6v12"/>',
  gear: '<path d="m8 3 4 3 4-3 5 5-4 4v9H7v-9L3 8Z"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  close: '<path d="m6 6 12 12 M6 18 18 6"/>', back: '<path d="m15 5-7 7 7 7"/>',
  plus: '<path d="M12 5v14 M5 12h14"/>', minus: '<path d="M5 12h14"/>',
};
const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${glyphs[name] || glyphs.rune}</svg>`;
function button(text, command, key, extra = '', cls = 'quiet') {
  const opens = ['race','birth-class','class','stats','skills','inventory','equipment-slot','skill-slot','settings'].includes(command);
  return `<button type="button" class="${cls}" data-command="${command}" data-focus="${escape(key)}" ${opens ? 'aria-haspopup="dialog" aria-expanded="false"' : ''} ${extra}>${text}</button>`;
}
function announce(text) { feedback.textContent = text; }
function focusedKey() { return document.activeElement?.dataset?.focus; }
function restoreKey(key, container = document) {
  if (!key) return false;
  const target = [...container.querySelectorAll('[data-focus]')].find(el => el.dataset.focus === key && !el.disabled);
  if (!target) return false;
  target.focus(); return true;
}
// 字體或視窗變化時改用單一閱讀捲動區；不縮字、不裁掉內容，也不改樣本狀態。
function adaptLayout() {
  const em = parseFloat(getComputedStyle(app).fontSize);
  const available = app.clientHeight - masthead.offsetHeight - feedback.offsetHeight - navigation.offsetHeight;
  app.classList.toggle('reflow', available < 16 * em);
  if (dialog.open) {
    const availableSheet = dialog.clientHeight - sheetHeader.offsetHeight - sheetFooter.offsetHeight;
    dialog.classList.toggle('reflow', availableSheet < 10 * em);
  }
}
function mainScroller() { return app.classList.contains('reflow') ? app : screen; }
function warnings(calculated) {
  if (!calculated.warnings.length) return '<p class="notice success">起始配套全部符合啟用條件。</p>';
  return `<div class="warnings"><h2>配套提醒：無法啟用</h2><ul>${calculated.warnings.map(w => {
    const scope = items.some(item => item.name === w.name) ? '裝備判定' : '技能資格';
    return `<li class="danger"><strong>${escape(w.name)}</strong>：${w.reasons.map(reason => escape(reason.replace('，目前 ', `，${scope}目前 `))).join('；')}</li>`;
  }).join('')}</ul><p class="hint">合法分配仍可繼續；物品與已學技能保留，暫不配置。</p></div>`;
}
const bonusText = bonus => bonus.flatMap((n,i) => n ? [`${labels[i]} ${signed(n)}`] : []).join('、') || '無屬性加成';
const requirementText = definition => `${labels[definition.attribute]} ${definition.requirement}`;
function entryText(entry) { return entry.source === 'book' ? `魔法書來源 · ${findItem(entry.bookId).name}` : entry.source === 'direct' ? '永久已學 · 直接施法' : '永久已學 · 物理技能'; }
function renderAllocation() {
  const race = findRace(draft.raceId), profession = findProfession(draft.classId);
  const planned = previewStarter(draft), points = allocatedPoints(draft), budget = allocationBudget(draft);
  const remaining = budget - sum(points);
  const errors = submitted ? allocationErrors(draft) : [];
  return `<span class="eyebrow">01 / 02 · 決定起點</span><h1 id="screen-title" tabindex="-1">準備你的旅人</h1><p class="hint">先看配套需求，再分配屬性。職業是起點，技能仍看自身條件。</p>
    <div class="select-pair">${button(`<span class="small">種族</span><strong>${race.name}</strong><span class="small">查看固定加成 ›</span>`, 'race', 'race')}${button(`<span class="small">初始職業</span><strong>${profession.name}</strong><span class="small">${labels[profession.primary]} ×1.25 ›</span>`, 'birth-class', 'birth-class')}</div>
    <section class="section" aria-labelledby="allocation-heading"><div class="section-head"><h2 id="allocation-heading">分配屬性</h2><span id="point-budget" class="point-tally">剩餘 ${remaining} 點</span></div>
      <p id="point-hint" class="small">基礎 8，可分配 ${budget} 點，單項最多 +${6 + race.free}；先加種族，再乘職業。已分 ${sum(points)}/${budget}。</p>
      ${errors.length ? `<div id="allocation-errors" class="error-summary" tabindex="-1" role="alert">${errors.map(escape).join('<br>')} <a href="#attribute-0">返回屬性分配</a></div>` : ''}
      <div>${attributes.map((_,i) => {
        const row = planned.actual.rows[i], n = points[i], max = 6 + race.free;
        return `<div class="attribute-row" id="attribute-${i}"><div><strong>${labels[i]}</strong><span id="point-detail-${i}" class="readout">分配 +${n} · 種族 ${signed(race.bonuses[i])}<br>裝備判定 ${row.equipmentBase} · 技能資格 ${row.qualification}</span></div><div class="stepper">${button(icon('minus'), 'point', `minus-${i}`, `data-index="${i}" data-delta="-1" aria-label="減少${labels[i]}點數" aria-describedby="point-hint point-detail-${i}" ${n === 0 ? 'disabled' : ''}`)}<span class="number" aria-label="${labels[i]}已分配 ${n} 點">${n}</span>${button(icon('plus'), 'point', `plus-${i}`, `data-index="${i}" data-delta="1" aria-label="增加${labels[i]}點數" aria-describedby="point-hint point-detail-${i}" ${n >= max || remaining === 0 ? 'disabled' : ''}`)}</div></div>`;
      }).join('')}</div>
    </section><section id="kit-warning" class="section" aria-label="起始配套啟用提醒">${warnings(planned.planned)}</section><p class="hint">原型門檻可調；個別資質、施法資格與龍息不在配點時揭曉。</p>`;
}
function renderReview() {
  const p = previewStarter(draft), kit = kits[draft.classId];
  return `<span class="eyebrow">02 / 02 · 核對配套</span><h1 id="screen-title" tabindex="-1">你的出發行囊</h1><p class="hint">${findRace(draft.raceId).name} · ${findProfession(draft.classId).name} · Lv.1 樣本</p>
    <section class="section stack">${p.planned.equipment.map(g => `<div class="card"><div class="row"><strong>${g.item.name}</strong><span class="${g.active && g.item.kind !== 'book' || g.item.kind === 'book' && p.planned.slots[0].active ? 'success' : 'warning'}">${g.active && (g.item.kind !== 'book' || p.planned.slots[0].active) ? '將自動配置' : '保留於背包'}</span></div><p class="hint">需求 ${requirementText(g.item)} · ${bonusText(g.item.bonus)}${g.item.armor ? ` · 護甲 ${g.item.armor}` : ''}</p></div>`).join('')}
      <div class="card"><div class="row"><strong>${findSkill(kit.skill).name}</strong><span class="${p.planned.slots[0].active ? 'success' : 'warning'}">${p.planned.slots[0].active ? '將配置第 1 格' : '暫不配置'}</span></div><p class="hint">${kit.book ? '來自魔法書，不永久學會法術。' : '保留為已學物理技能。'}需求 ${requirementText(findSkill(kit.skill))}。</p></div>
      <div class="card"><strong>${kit.proficiency}武器熟練</strong><p class="hint">獨立於六格技能；職業切換不刪除或重發。</p></div>
    </section><section class="section">${warnings(p.planned)}</section><p class="notice section">只建立本頁樣本。完成後採固定測試資質，不抽亂數、不保存、不發放到正式角色。</p>`;
}
function gearSlot(calculated, position, name) {
  const g = calculated.equipment.find(x => x.position === position);
  return button(`<span class="ordinal">${name}</span><strong>${g ? g.item.name : '空格'}</strong><span class="state ${g ? g.active ? 'success' : 'warning' : 'muted'}">${g ? g.active ? '生效' : '停用 · 查看原因' : '選擇裝備 ›'}</span>`, 'equipment-slot', `equip-${position}`, `data-position="${position}"`, `slot${g && !g.active ? ' inactive' : ''}`);
}
function skillSlots(calculated, prefix = 'skill') {
  return `<div class="skill-grid">${calculated.slots.map((entry,i) => button(`<span class="ordinal">${String(i+1).padStart(2,'0')}</span><strong>${entry ? entry.skill.name : '空技能格'}</strong><span class="state ${entry ? entry.active ? 'success' : 'warning' : 'muted'}">${entry ? entry.active ? '生效' : '停用 · 仍佔格' : '配置技能 ›'}</span>`, 'skill-slot', `${prefix}-${i}`, `data-index="${i}"`, `slot${entry && !entry.active ? ' inactive' : ''}`)).join('')}</div>`;
}
function renderCharacter() {
  const calculated = evaluate(character), profession = findProfession(character.currentClass), r = character.resources;
  return `<div class="card hero"><div class="class-title"><span class="crest" aria-hidden="true">${icon({ 'class.swordsman':'sword','class.archer':'bow','class.scout':'dagger','class.mage':'rune' }[profession.id])}</span><div><span class="eyebrow">${findRace(character.birth.raceId).name} · Lv.1</span><h1 id="screen-title" tabindex="-1">${profession.name}</h1></div>${button('切換 ›','class','class')}</div>
      <div class="resource-grid"><div class="resource"><div class="row"><span>HP</span><span class="number">${r.currentHp} / ${r.maxHp}</span></div><progress class="hp" value="${r.currentHp}" max="${r.maxHp}" aria-label="HP ${r.currentHp}／${r.maxHp}"></progress></div><div class="resource"><div class="row"><span>MP</span><span class="number">${r.currentMp} / ${r.maxMp}</span></div><progress value="${r.currentMp}" max="${r.maxMp}" aria-label="MP ${r.currentMp}／${r.maxMp}"></progress></div></div><p class="hint">上限提高不回復；降低只截掉超出的部分。</p>
    </div><section class="section"><div class="section-head"><h2>配裝</h2><span class="small">生效護甲 ${calculated.armor}</span></div><div class="equipment-grid">${gearSlot(calculated,'weapon','武器')}${gearSlot(calculated,'armor','身體防具')}<div class="accessory-empty">飾品 1 · 空格</div><div class="accessory-empty">飾品 2 · 空格</div></div></section>
      <section class="section"><div class="section-head"><h2>主動技能</h2><span class="small">${calculated.slots.filter(Boolean).length} / 6 格</span></div>${skillSlots(calculated)}${calculated.warnings.length ? `<p class="hint warning">${calculated.warnings.length} 項配置停用。點格子查看原因，符合需求後自動恢復。</p>` : ''}</section>
      <p class="hint section">${character.mode === 'loadout' ? '換裝測試樣本：八件樣本裝備、三項已學物理技能及書本來源。' : '起始配套樣本：只取得初始職業的固定配套。'}所有數值僅供原型。</p>`;
}
function renderMain({ fresh = false } = {}) {
  const key = focusedKey(), oldScroll = mainScroller().scrollTop;
  screen.innerHTML = view === 'allocation' ? renderAllocation() : view === 'review' ? renderReview() : renderCharacter();
  navigation.innerHTML = view === 'character' ? `<nav class="navigation" aria-label="角色操作">${button(`${icon('rune')}數值`,'stats','stats')}${button(`${icon('grid')}技能庫`,'skills','skills')}${button(`${icon('gear')}背包`,'inventory','inventory')}</nav>` : `<div class="wizard-cta">${view === 'review' ? button('返回配點','back-allocation','back-allocation') : ''}${button(view === 'review' ? '建立本頁樣本' : '核對起始配套',view === 'review' ? 'create' : 'review','continue','', 'primary')}</div>`;
  adaptLayout();
  if (fresh) { app.scrollTop = 0; screen.scrollTop = 0; screen.querySelector('#screen-title').focus({ preventScroll: true }); }
  else {
    mainScroller().scrollTop = oldScroll;
    if (!dialog.open && key && !restoreKey(key)) {
      if (key.startsWith('plus-') || key.startsWith('minus-')) restoreKey(`${key.startsWith('plus-') ? 'minus' : 'plus'}-${key.split('-')[1]}`);
    }
  }
}
function openSheet(task, control) {
  // 點擊來源直接決定返回入口；不依賴 Safari 是否把按鈕設成 activeElement。
  returnFocus = control.dataset.focus; control.setAttribute('aria-expanded','true');
  stack = [task]; dialog.classList.remove('reflow'); dialog.showModal(); renderSheet(true);
}
function push(task, control) {
  stack[stack.length-1].returnKey = control?.dataset.focus || focusedKey(); stack.push(task); renderSheet(true);
}
function closeSheet(message = '已取消，樣本與資源保持原狀。') {
  // 不依賴延後到達的原生 close 事件，避免快關快開時清掉新任務。
  stack = []; const key = returnFocus; returnFocus = null; dialog.close();
  document.querySelector('.masthead button').setAttribute('aria-expanded','false');
  renderMain(); restoreKey(key); announce(message);
}
function backSheet() {
  if (stack.length < 2) return closeSheet();
  stack.pop(); const key = stack[stack.length-1].returnKey; renderSheet(true); restoreKey(key,dialog);
}
function catalogChoices(list, selected, command, describe) {
  return `<div class="stack">${list.map(entry => button(`<span class="choice-title"><strong>${entry.name}</strong>${selected === entry.id ? '<span>✓ 已選</span>' : ''}</span><span class="description">${describe(entry)}</span>`,command,`${command}-${entry.id}`,`data-id="${entry.id}" aria-pressed="${selected === entry.id}"`,'choice')).join('')}</div>`;
}
function candidate(action) {
  try { return { next: previewAction(character,action), error: null }; }
  catch (error) { return { next: null, error: error.message }; }
}
function candidateButton(title, action, index, details) {
  const result = candidate(action);
  // 即使不能新配置，保留可見的條件文字，停用按鈕不能啟動。
  return button(`<strong>${title}</strong><span class="description">${details}</span>${result.error ? `<span class="warning">無法新配置：${escape(result.error)}</span>` : '<span class="success">可配置 · 查看影響 ›</span>'}`,'candidate',`candidate-${index}`,`data-choice="${index}" ${result.error ? 'disabled' : ''}`,'choice');
}
function previewDetails(next) {
  const before = evaluate(character), after = evaluate(next), a = character.resources, b = next.resources;
  return `<div class="comparison"><div class="row"><strong>目前職業</strong><span>${findProfession(character.currentClass).name} → ${findProfession(next.currentClass).name}</span></div><div class="row"><strong>HP</strong><span class="number">${a.currentHp}/${a.maxHp} → ${b.currentHp}/${b.maxHp}</span></div><div class="row"><strong>MP</strong><span class="number">${a.currentMp}/${a.maxMp} → ${b.currentMp}/${b.maxMp}</span></div><div class="row"><strong>生效護甲</strong><span>${before.armor} → ${after.armor}</span></div>${after.rows.map((r,i) => `<div class="row"><strong>${r.name}</strong><span>資格 ${before.rows[i].qualification} → ${r.qualification} · 最終 ${before.rows[i].final} → ${r.final}</span></div>`).join('')}</div>
    <section class="section"><h3>套用後的配置</h3><div class="stack section">${after.equipment.map(g => `<div class="notice"><strong>${g.item.name} · <span class="${g.active ? 'success' : 'warning'}">${g.active ? '生效' : '停用，保留位置'}</span></strong><p>${g.reasons.map(escape).join('；') || g.check.text}</p></div>`).join('')}${after.slots.filter(Boolean).map(s => `<div class="notice"><strong>第 ${s.position+1} 格 · ${s.skill.name} · <span class="${s.active ? 'success' : 'warning'}">${s.active ? '生效' : '停用，仍佔格'}</span></strong><p>${s.reasons.map(escape).join('；') || s.check.text}</p></div>`).join('')}</div></section><p class="hint">只預覽。確認套用才更新；取消不改目前值。被截掉的資源不會因上限恢復而補回。</p>`;
}
function renderSheet(fresh = false) {
  const task = stack[stack.length-1]; if (!task) return;
  const key = focusedKey(), scroll = (dialog.classList.contains('reflow') ? dialog : sheetBody).scrollTop;
  let title = '', body = '', footer = button('完成','close-sheet','sheet-done','','secondary');
  if (task.kind === 'race') {
    title = '選擇種族'; body = catalogChoices(races,draft.raceId,'choose-race',r => r.free ? '可分配 14 點屬性點。' : `可分配 12 點；${r.bonuses.map((n,i) => `${labels[i]} ${signed(n)}`).join('、')}`);
  } else if (task.kind === 'birth-class') {
    title = '選擇初始職業'; body = catalogChoices(professions,draft.classId,'choose-birth-class',p => { const kit = kits[p.id]; return `${labels[p.primary]} ×1.25 · ${findItem(kit.weapon).name}、${findItem(kit.armor).name}、${findSkill(kit.skill).name}`; });
  } else if (task.kind === 'class') {
    title = '切換職業'; body = '<p class="notice">為核對轉職，原型暫開放四職業。正式創角只開放初始所選職業。切換不重發配套、不改初始職業或已學技能。</p><div class="stack section">'+professions.map((p,i) => { task.choices ??= []; task.choices[i] = { type:'class',id:p.id }; return candidateButton(`${p.name}${p.id === character.currentClass ? ' · 目前' : ''}`, task.choices[i],i,`${labels[p.primary]} ×1.25；${p.passive}`); }).join('')+'</div>';
  } else if (task.kind === 'equipment' || task.kind === 'inventory') {
    const calculated = evaluate(character);
    title = task.kind === 'inventory' ? '背包與配置' : task.position === 'weapon' ? '武器配置' : '身體防具配置';
    if (task.kind === 'inventory') {
      body = '<p class="notice">物品需求只用種族與職業計算後數值。兩格飾品暫空；魔法書在技能格綁定。</p><div class="stack section">'+['weapon','armor'].map(position => gearSlot(calculated,position,position === 'weapon' ? '武器' : '身體防具')).join('')+'</div><section class="section"><h3>持有物品</h3><div class="stack section">'+character.inventory.map(id => { const item = findItem(id); return `<div class="notice"><strong>${item.name}</strong><p>需求 ${requirementText(item)} · ${bonusText(item.bonus)}${item.armor ? ` · 護甲 ${item.armor}` : ''}</p>${item.kind === 'book' ? '<p>從技能格選火焰箭並綁定此書；不是永久已學。</p>' : ''}</div>`; }).join('')+'</div></section>';
    } else {
      const current = calculated.equipment.find(g => g.position === task.position);
      body = current ? `<div class="notice"><strong>目前：${current.item.name} · ${current.active ? '生效' : '停用'}</strong><p class="warning">${current.reasons.map(escape).join('；')}</p></div>` : '<p class="notice">此欄位目前空置。</p>';
      task.choices = [{ type:'equipment', position:task.position,id:null }, ...character.inventory.filter(id => findItem(id).kind === task.position).map(id => ({ type:'equipment',position:task.position,id }))];
      body += '<div class="stack section">'+task.choices.map((action,i) => { const item = findItem(action.id); return candidateButton(item ? item.name : '卸下／空置',action,i,item ? `需求 ${requirementText(item)}；${bonusText(item.bonus)}；目前裝備判定 ${calculated.rows[item.attribute].equipmentBase}` : '物品留在背包；依完整結果重新核對技能。'); }).join('')+'</div>';
    }
  } else if (task.kind === 'skills') {
    title = '六格技能配置'; body = '<p class="notice">物理技能與書本法術共用六格。停用仍佔原格；點選一格調整。普通攻擊、熟練及種族能力不佔格。</p><div class="section">'+skillSlots(evaluate(character),'library-slot')+'</div>';
  } else if (task.kind === 'skill') {
    title = `第 ${task.position+1} 格技能`;
    const calculated = evaluate(character), current = calculated.slots[task.position];
    body = current ? `<div class="notice"><strong>${current.skill.name} · ${current.active ? '生效' : '停用，仍佔格'}</strong><p>${entryText(current)}</p><p class="warning">${current.reasons.map(escape).join('；')}</p><p>${bonusText(current.skill.bonus)}${current.active ? '已加入最終屬性' : '不生效'}。</p></div>` : '<p class="notice">選擇已學技能，或綁定持有的魔法書。職業不鎖技能種類。</p>';
    const entries = character.learned.map(skillId => ({ skillId,source:skillId === 'flame' ? 'direct' : 'learned' }));
    character.inventory.filter(id => findItem(id).kind === 'book').forEach(bookId => entries.push({ skillId:findItem(bookId).spell,source:'book',bookId }));
    task.choices = [{ type:'skill',position:task.position,entry:null },...entries.map(entry => ({ type:'skill',position:task.position,entry }))];
    body += '<div class="stack section">'+task.choices.map((action,i) => { const s = findSkill(action.entry?.skillId); return candidateButton(s ? `${s.name} · ${action.entry.source === 'book' ? '書本' : '已學'}` : '清空此格',action,i,s ? `需求 ${requirementText(s)}；目前技能資格 ${calculated.rows[s.attribute].qualification}；${s.description} ${bonusText(s.bonus)}只加入最終屬性。` : '技能與持有物品保留；解除本格書本綁定。'); }).join('')+'</div>';
  } else if (task.kind === 'preview') {
    title = '核對配置影響'; body = previewDetails(task.next); footer = button('確認套用','apply','sheet-apply','','primary');
  } else if (task.kind === 'stats') {
    title = '屬性與來源';
    body = `<p class="notice">種族名冊 v2 · 職業名冊 v1 · 裝備／技能樣本 v1。先加種族、再乘職業向下取整；技能加成不支撐任何需求。</p><dl>${evaluate(character).rows.map(r => `<div class="stat-detail"><dt>${r.name} · 最終 <span class="number">${r.final}</span></dt><dd>固有 ${r.intrinsic} × ${r.multiplier} → 裝備判定 ${r.equipmentBase}</dd><dd>生效裝備 ${signed(r.equipment)} → 技能資格 ${r.qualification}</dd><dd>生效技能 ${signed(r.skill)} → 最終 ${r.final} · 修正 ${signed(r.modifier)}</dd></div>`).join('')}</dl><section class="section"><h3>固定測試結果</h3><p class="hint">魔力資質：${aptitudes[character.aptitude].name}（固定樣本，不代表抽取結果）。直接施法資格：無（固定樣本，不做 1% 抽取）。${character.birth.raceId === 'race.dragonborn' ? '龍息：火（固定樣本，沒有戰鬥效果）。' : ''}</p><p class="hint">HP 上限 = 25 + 最終體質 ×3；MP 上限 = 最終智慧 ×4 + 資質加成 ${aptitudes[character.aptitude].bonus}。</p><p class="hint">初始職業：${findProfession(character.initialClass).name}；熟練：${character.proficiency}。${findProfession(character.currentClass).passive}。</p></section>`;
  } else if (task.kind === 'settings') {
    title = '原型樣本設定';
    body = '<p class="notice">所有設定只改本頁記憶體樣本。重新整理會重設；沒有正式角色、資料庫或存檔連線。</p>';
    if (character) body += `<div class="stack section">${button('載入換裝測試物品與已學技能','test-library','test-library','','choice')}<p class="small">另加八件樣本裝備與三項已學物理技能，不自動換裝、不補充資源。這些是測試資料，不是起始贈送。</p>${button('載入受傷／耗魔樣本 · HP 40、MP 40','resource-fixture','fixture-injured','data-kind="injured"','choice')}${button('載入零 HP／MP 樣本','resource-fixture','fixture-zero','data-kind="zero"','choice')}${button('載入目前上限值樣本 · 用於截低核對','resource-fixture','fixture-full','data-kind="full"','choice')}${button('回到配點 · 清除本頁樣本','restart','restart','','choice')}</div>`;
    body += '<section class="section"><h3>此原型的界線</h3><p class="hint">沒有戰鬥、治療、回魔、職業解鎖或法術學習命令。箭矢暫不計數；頭／手／腿防具與正式保存另做。</p></section>';
  } else if (task.kind === 'fixture-confirm') {
    title = '載入獨立測試情境'; body = `<p class="notice">${task.description}</p><p class="hint">這是測試樣本設定，不是正式取得、治療或復活操作。</p>`; footer = button('確認載入樣本','apply-fixture','sheet-apply-fixture','','primary');
  }
  sheetHeader.innerHTML = `<div class="sheet-controls">${stack.length > 1 ? button(icon('back'),'sheet-back','sheet-back','aria-label="返回上一層"') : '<span class="eyebrow">本頁樣本</span>'}${button(icon('close'),'close-sheet','sheet-close','aria-label="取消並關閉"')}</div><h2 id="sheet-title" tabindex="-1">${title}</h2>`;
  sheetBody.innerHTML = body; sheetFooter.innerHTML = footer;
  adaptLayout();
  if (fresh) { dialog.scrollTop = 0; sheetBody.scrollTop = 0; if (dialog.open) sheetHeader.querySelector('h2').focus({ preventScroll: true }); }
  else { (dialog.classList.contains('reflow') ? dialog : sheetBody).scrollTop = scroll; restoreKey(key,dialog); }
}
function chooseCandidate(index, control) {
  const action = stack[stack.length-1].choices?.[index]; if (!action) return;
  const result = candidate(action); if (result.error) return announce(result.error);
  push({ kind:'preview',next:result.next,action },control);
}
function run(command, control) {
  const task = stack[stack.length-1];
  if (command === 'point') {
    const i = Number(control.dataset.index), delta = Number(control.dataset.delta);
    draft = changePoint(draft,i,delta); renderMain();
    const points = allocatedPoints(draft), p = previewStarter(draft);
    announce(`${labels[i]}分配 ${points[i]} 點，剩餘 ${allocationBudget(draft) - sum(points)} 點。${p.planned.warnings.length ? `${p.planned.warnings.length} 項無法啟用，詳見紅字配套提醒。` : '起始配套全部符合啟用條件。'}`);
  } else if (command === 'race' || command === 'birth-class') openSheet({ kind:command },control);
  else if (command === 'choose-race') {
    const race = findRace(control.dataset.id);
    draft = chooseRace(draft,race.id);
    closeSheet(`已選${race.name}，剩餘 ${allocationBudget(draft) - sum(allocatedPoints(draft))} 點。切換種族會移除舊種族額外點，請核對分配與紅字提醒。`);
  } else if (command === 'choose-birth-class') {
    draft.classId = control.dataset.id; closeSheet(`已選${findProfession(draft.classId).name}，請核對配套提醒。`);
  } else if (command === 'review') {
    submitted = true;
    if (allocationErrors(draft).length) { renderMain(); screen.querySelector('#allocation-errors').focus(); return announce('請完成合法點數分配。配套不能啟用的警告本身不阻擋繼續。'); }
    view = 'review'; renderMain({ fresh:true }); announce('請核對配套。返回配點會保留分配。');
  } else if (command === 'back-allocation') { view = 'allocation'; renderMain({ fresh:true }); }
  else if (command === 'create') {
    character = createSample(draft); view = 'character'; renderMain({ fresh:true }); announce('已建立本頁樣本。資源只在出生推導初始化一次；配套提高上限不補滿。');
  } else if (command === 'class' || command === 'stats' || command === 'skills' || command === 'inventory' || command === 'settings') openSheet({ kind:command },control);
  else if (command === 'equipment-slot') {
    const next = { kind:'equipment',position:control.dataset.position }; if (dialog.open) push(next,control); else openSheet(next,control);
  } else if (command === 'skill-slot') {
    const next = { kind:'skill',position:Number(control.dataset.index) }; if (dialog.open) push(next,control); else openSheet(next,control);
  } else if (command === 'candidate') chooseCandidate(Number(control.dataset.choice),control);
  else if (command === 'apply' && task?.kind === 'preview') {
    // 再從目前樣本求值；不把 DOM 文字或舊預覽當成權威狀態。
    character = previewAction(character,task.action); closeSheet('配置已套用。屬性、停用原因與資源上限同步更新。');
  } else if (command === 'sheet-back') backSheet();
  else if (command === 'close-sheet') closeSheet(task?.kind === 'preview' ? '已取消預覽，配置與資源保持原狀。' : '已關閉，樣本未變更。');
  else if (command === 'test-library') push({ kind:'fixture-confirm',fixture:'library',description:'載入換裝測試物品及三項已學物理技能；保留原配裝、初始熟練及目前資源。火焰箭仍只來自書本，不永久學會。' },control);
  else if (command === 'resource-fixture') push({ kind:'fixture-confirm',fixture:control.dataset.kind,description:control.dataset.kind === 'zero' ? '載入 HP 0、MP 0，核對上限變更不使 HP 復活或補魔。' : control.dataset.kind === 'full' ? '把測試目前值設為目前上限，以核對卸裝時截低、再穿回時不補回。' : '把測試目前 HP／MP 設為各 40（若上限低於 40，採該上限），核對換裝提高上限不補滿。' },control);
  else if (command === 'restart') push({ kind:'fixture-confirm',fixture:'restart',description:'清除本頁角色樣本並返回配點；正式角色與存檔不受影響。' },control);
  else if (command === 'apply-fixture' && task?.kind === 'fixture-confirm') {
    if (task.fixture === 'restart') { character = null; draft = initialDraft(); submitted = false; view = 'allocation'; }
    else character = task.fixture === 'library' ? loadTestLibrary(character) : resourceFixture(character,task.fixture);
    closeSheet('已載入本頁測試情境。正式角色與存檔未變更。');
    if (view === 'allocation') renderMain({ fresh:true });
  }
}
document.addEventListener('click',event => {
  const control = event.target.closest('button[data-command]'); if (!control || control.disabled) return;
  try { run(control.dataset.command,control); } catch (error) { announce(`操作未套用：${error.message}`); }
});
dialog.addEventListener('cancel',event => { event.preventDefault(); closeSheet(); });
dialog.addEventListener('click',event => {
  if (event.target !== dialog) return;
  const r = dialog.getBoundingClientRect();
  if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) closeSheet();
});
document.addEventListener('focusin',event => {
  if (event.target.closest('.scroll')) event.target.scrollIntoView({ block:'nearest',inline:'nearest',behavior:'instant' });
});
const layoutObserver = new ResizeObserver(adaptLayout);
[app,masthead,feedback,navigation,sheetHeader,sheetFooter].forEach(element => layoutObserver.observe(element));
renderMain();
