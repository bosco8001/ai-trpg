// 尚未執行。由 Grok 用真實正式名冊核對原型鏡像；不是互相比較兩份原型。
import test from 'node:test';
import assert from 'node:assert/strict';
import { OFFICIAL_RACES_V2 } from '../../src/server/content/races-v2.js';
import { OFFICIAL_CLASSES_V1 } from '../../src/server/content/classes-v1.js';
import { races, professions, attributes, versions } from './model.mjs';
test('原型五族鏡像對應正式 v2 名冊', () => {
  assert.equal(versions.race,OFFICIAL_RACES_V2.catalogVersion);
  assert.equal(races.length,OFFICIAL_RACES_V2.races.length);
  for (const mirror of races) {
    const official = OFFICIAL_RACES_V2.races.find(r => r.id === mirror.id)!;
    assert.ok(official); assert.equal(mirror.name,official.name); assert.equal(mirror.free,official.freeAttributePoints);
    assert.deepEqual(mirror.bonuses,attributes.map((key: keyof typeof official.attributeModifiers) => official.attributeModifiers[key]));
    assert.deepEqual(mirror.aptitudePercent,['low','ordinary','high','exceptional'].map(key => official.aptitudePercent[key as keyof typeof official.aptitudePercent]));
    assert.ok(official.aptitudePercent[mirror.fixtureAptitude as keyof typeof official.aptitudePercent] > 0);
  }
});
test('原型四職業鏡像對應正式 v1 名冊全部倍率', () => {
  assert.equal(versions.profession,OFFICIAL_CLASSES_V1.catalogVersion);
  assert.equal(professions.length,OFFICIAL_CLASSES_V1.classes.length);
  for (const mirror of professions) {
    const official = OFFICIAL_CLASSES_V1.classes.find(c => c.id === mirror.id)!;
    assert.ok(official); assert.equal(mirror.name,official.name);
    assert.equal(attributes[mirror.primary],official.primaryAttribute);
    attributes.forEach((key: keyof typeof official.attributeMultipliers,i: number) => assert.equal(i === mirror.primary ? 1.25 : 1,official.attributeMultipliers[key]));
  }
});
