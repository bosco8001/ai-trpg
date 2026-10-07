import { attributes, races, classes, aptitudes, sample, derive, previewChange } from './model.mjs';

const $ = id => document.getElementById(id);
let input = sample();
let calculated = derive(input);
let currentHp = 40, currentMp = 48;
let origin = null;
const sign = n => n > 0 ? `+${n}` : String(n).replace('-', '−');
const resourceState = () => ({ maxHp: calculated.maxHp, maxMp: calculated.maxMp, currentHp, currentMp });

function render() {
  $('identity').textContent = `${races.find(r => r.id === input.race).name} · ${classes.find(c => c.id === input.profession).name}`;
  for (const [id,current,max] of [['hp',currentHp,calculated.maxHp],['mp',currentMp,calculated.maxMp]]) {
    $(id).textContent = current; $(`max-${id}`).textContent = `/ ${max}`;
    $(`${id}-bar`).max = max; $(`${id}-bar`).value = current;
    $(`${id}-bar`).setAttribute('aria-valuetext', `${current}／${max}`);
    $(`${id}-missing`).textContent = id === 'hp' && current === 0 ? 'HP 為 0，變更上限不救援或復活' : `缺少 ${max-current} 點`;
  }
  $('attributes').innerHTML = calculated.rows.map(r => `<article class="stat"><h3>${r.name}</h3><strong class="${r.factor > 1 ? 'boost' : ''}">${r.final}</strong><small>修正 ${sign(r.modifier)}</small></article>`).join('');
}

function openSheet(title, source) {
  origin = source; $('sheet-title').textContent = title;
  $('sheet-body').replaceChildren(); $('sheet-footer').replaceChildren();
  $('sheet').showModal(); $('sheet-title').focus(); $('sheet-body').scrollTop = 0;
}
function closeSheet(message = '') {
  $('sheet').close();
  if (message) $('feedback').textContent = message;
  origin?.focus(); origin = null;
}
$('close').addEventListener('click', () => closeSheet('已關閉，保留原樣本。'));
$('sheet').addEventListener('cancel', event => { event.preventDefault(); closeSheet('已取消，保留原樣本。'); });

$('edit').addEventListener('click', () => {
  openSheet('調整核對樣本', $('edit'));
  const before = resourceState();
  $('sheet-body').innerHTML = `<p class="explain">Lv.1、無裝備、無技能。這是公式核對，不是創角；資質選項是已知樣本，不代表玩家可選擇最終資質。職業清單也不代表角色已開放全部職業。</p>
    <form id="sample-form" class="fields">
      <label>樣本種族<select id="race" name="race">${races.map(r => `<option value="${r.id}">${r.name}</option>`).join('')}</select></label>
      <label>樣本職業<select id="profession" name="profession">${classes.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}</select></label>
      <label>樣本魔力資質<select id="aptitude" name="aptitude"></select></label>
      <fieldset><legend>12 點創角分配</legend><p class="explain">六項基礎皆為 8；每項分配 0～6 點。</p><div class="allocation">${attributes.map(([key,name],i) => `<label>${name}<input id="allocation-${i}" name="${key}" type="number" inputmode="numeric" min="0" max="6" step="1" required value="${input.allocation[i]}"></label>`).join('')}</div></fieldset>
      <fieldset id="human-fields"><legend>人類另有 2 點種族加成</legend><p class="explain">逐點選擇，同一屬性可選兩次。</p><label>第 1 點<select id="human-one"></select></label><label>第 2 點<select id="human-two"></select></label></fieldset>
      <p id="form-error" class="error" tabindex="-1" role="alert"></p>
      <div id="preview" class="preview" role="status" aria-live="polite" aria-atomic="true"></div>
    </form>`;
  $('sheet-footer').innerHTML = '<button type="submit" form="sample-form" id="apply" class="primary">更新核對樣本</button>';
  $('race').value = input.race; $('profession').value = input.profession;
  const humanIndices = input.human.flatMap((count,i) => Array(count).fill(i));
  for (const [id,n] of [['human-one',humanIndices[0] ?? 0],['human-two',humanIndices[1] ?? 0]]) {
    $(id).innerHTML = attributes.map(([key,name],i) => `<option value="${i}">${name}</option>`).join(''); $(id).value = n;
  }
  const refreshRace = () => {
    const r = races.find(r => r.id === $('race').value);
    const previous = $('aptitude').value || input.aptitude;
    $('aptitude').innerHTML = r.aptitudes.map(a => `<option value="${a}">${aptitudes[a][0]}（MP +${aptitudes[a][1]}）</option>`).join('');
    $('aptitude').value = r.aptitudes.includes(previous) ? previous : r.aptitudes[0];
    $('human-fields').hidden = r.id !== 'human';
  };
  const readDraft = () => {
    const human = [0,0,0,0,0,0];
    if ($('race').value === 'human') { human[Number($('human-one').value)]++; human[Number($('human-two').value)]++; }
    return { race: $('race').value, profession: $('profession').value, aptitude: $('aptitude').value,
      allocation: attributes.map((a,i) => $(`allocation-${i}`).valueAsNumber), human };
  };
  const preview = () => {
    try {
      const next = previewChange(before,readDraft());
      if (!next.ok) throw new Error(next.reason);
      $('form-error').textContent = ''; $('apply').setAttribute('aria-disabled','false');
      $('preview').textContent = `HP ${before.currentHp}／${before.maxHp} → ${next.currentHp}／${next.calculated.maxHp}；MP ${before.currentMp}／${before.maxMp} → ${next.currentMp}／${next.calculated.maxMp}。確認前不更新總覽。`;
      return next;
    } catch (e) {
      $('form-error').textContent = e.message; $('apply').setAttribute('aria-disabled','true');
      $('preview').textContent = '請先完成合法分配；總覽仍保留原樣本。'; return null;
    }
  };
  refreshRace(); preview();
  $('race').addEventListener('change', () => { refreshRace(); preview(); });
  $('sample-form').addEventListener('input', preview);
  $('sample-form').addEventListener('submit', event => {
    event.preventDefault(); const next = preview();
    if (!next) { $('form-error').focus(); return; }
    input = readDraft(); calculated = next.calculated; currentHp = next.currentHp; currentMp = next.currentMp;
    $('change').textContent = `最近核對：HP ${before.currentHp}／${before.maxHp} → ${currentHp}／${calculated.maxHp}；MP ${before.currentMp}／${before.maxMp} → ${currentMp}／${calculated.maxMp}。`;
    render(); closeSheet('樣本已更新；遊戲資料與存檔沒有變更。');
  });
});

$('details').addEventListener('click', () => {
  openSheet('計算來源', $('details'));
  $('sheet-body').innerHTML = `<p class="explain">順序：創角分配 → 種族加成 → 目前職業倍率 → 生效裝備 → 生效技能。本樣本裝備與技能加成都為 0。</p>
    <ul class="detail-list">${calculated.rows.map(r => `<li><strong>${r.name} ${r.final} · 修正 ${sign(r.modifier)}</strong><p class="formula">基礎分配 ${r.base} ＋種族 ${sign(r.racial)} ＝固有 ${r.intrinsic}<br>floor（${r.intrinsic} × ${r.factor}）＝ ${r.qualification}<br>裝備 +0、技能 +0 → 最終 ${r.final}</p></li>`).join('')}</ul>
    <section class="block"><h3>最大 HP／MP</h3><p class="formula">HP：20 ＋ 1 × 5 ＋ ${calculated.rows[2].final} × 3 ＝ ${calculated.maxHp}<br>MP：${calculated.rows[3].final} × 4 ＋ ${aptitudes[input.aptitude][1]} ＝ ${calculated.maxMp}</p><p>樣本資質：${aptitudes[input.aptitude][0]}。魔力資質與魔術師職業不自動賦予直接施法資格。</p></section>
    <section class="block"><h3>資源上限變化</h3><p>目前值加上新舊上限差額，保留缺少的量。例：40／55 → 49／64 → 40／55。HP 為 0 時維持 0。</p><p>下降後 HP 低於 1 或 MP 小於 0 的處理尚待確認；原型遇到時拒絕更新樣本。</p></section>
    <section class="block"><h3>特殊情況樣本</h3><p>只更改這份原型的記憶體樣本，用於核對零 HP 規則。</p><div class="link-row"><button id="zero-hp">載入 HP 為 0 樣本</button><button id="reset">重設核對樣本</button></div></section>`;
  $('zero-hp').addEventListener('click', () => { currentHp = 0; render(); $('change').textContent = '零 HP 樣本：之後變更上限，HP 仍維持 0。'; closeSheet('已載入零 HP 核對樣本。'); });
  $('reset').addEventListener('click', () => { input = sample(); calculated = derive(input); currentHp = 40; currentMp = 48; render(); $('change').textContent = '起始樣本：HP 40／55，MP 48／60。'; closeSheet('已重設獨立核對樣本。'); });
});
render();
