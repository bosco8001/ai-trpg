/** Canonical sources: docs/world/races.md §§3–7; docs/gameplay/character_system.md §5.
 * Creation metadata only. Does not implement racial abilities, generate a character or grant casting eligibility. */
export const OFFICIAL_RACES_V1 = {
  schemaVersion: 1, catalogVersion: 1, namespace: "official", scope: "race-creation-metadata",
  pendingKinds: ["class", "item", "skill", "spell"],
  races: [
    { id: "race.human", name: "人類", freeAttributePoints: 2,
      attributeModifiers: { strength: 0, dexterity: 0, constitution: 0, intelligence: 0, perception: 0, charisma: 0 },
      aptitudePercent: { low: 20, ordinary: 65, high: 14, exceptional: 1 }, aptitudeReveal: "unspecified" },
    { id: "race.elf", name: "精靈", freeAttributePoints: 0,
      attributeModifiers: { strength: -1, dexterity: 0, constitution: -2, intelligence: 1, perception: 2, charisma: 0 },
      aptitudePercent: { low: 0, ordinary: 0, high: 70, exceptional: 30 }, aptitudeReveal: "after-creation" },
    { id: "race.dwarf", name: "矮人", freeAttributePoints: 0,
      attributeModifiers: { strength: 1, dexterity: -1, constitution: 2, intelligence: 0, perception: 0, charisma: -2 },
      aptitudePercent: { low: 0, ordinary: 100, high: 0, exceptional: 0 }, aptitudeReveal: "unspecified" },
    { id: "race.orc", name: "獸人", freeAttributePoints: 0,
      attributeModifiers: { strength: 0, dexterity: 2, constitution: 0, intelligence: -3, perception: 2, charisma: -1 },
      aptitudePercent: { low: 85, ordinary: 14, high: 1, exceptional: 0 }, aptitudeReveal: "unspecified" },
    { id: "race.dragonborn", name: "龍裔", freeAttributePoints: 0,
      attributeModifiers: { strength: 2, dexterity: 0, constitution: 2, intelligence: 1, perception: 0, charisma: 0 },
      aptitudePercent: { low: 0, ordinary: 65, high: 30, exceptional: 5 }, aptitudeReveal: "after-creation" },
  ],
};
