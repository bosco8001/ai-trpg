import { randomInt } from "node:crypto";
import type { DiceRoller } from "../../domain/combat.js";

export class RandomD20Roller implements DiceRoller {
  d20(): number {
    return randomInt(1, 21);
  }
}

export class SequenceD20Roller implements DiceRoller {
  private index = 0;

  constructor(private readonly sequence: readonly number[]) {}

  d20(): number {
    const result = this.sequence[this.index];
    if (result === undefined) throw new Error("TEST D20 sequence 已用完。");
    this.index += 1;
    return result;
  }
}

export type CombatRollFixtureMode = "normal" | "tie";
export type CombatActionRollFixtureMode = "hit" | "miss" | "raw-one-hit";
export type CombatEscapeRollFixtureMode = "success" | "failure";

/**
 * Legacy three-participant fixture retained for focused Phase 11–21 rule tests.
 */
export function createCombatFixtureRoller(mode: CombatRollFixtureMode): DiceRoller {
  return new SequenceD20Roller(mode === "tie"
    ? [10, 11, 6, 7, 7, 4, 15]
    : [12, 17, 8]);
}

/** Phase 22 four-participant TEST battle; companion receives its own opening D20. */
export function createPhase22CombatFixtureRoller(mode: CombatRollFixtureMode): DiceRoller {
  return new SequenceD20Roller(mode === "tie"
    ? [10, 11, 6, 3, 7, 7, 4, 15]
    : [12, 17, 8, 4]);
}

/** 固定攻擊測試骰與先攻骰分開，避免兩種 fixture 共用或消耗彼此的序列。 */
export function createCombatActionFixtureRoller(mode: CombatActionRollFixtureMode): DiceRoller {
  const sequence: Readonly<Record<CombatActionRollFixtureMode, readonly number[]>> = {
    hit: [10, 8],
    miss: [3, 15],
    "raw-one-hit": [1, 1],
  };
  const rolls = sequence[mode];
  let next = 0;
  return {
    d20() {
      const roll = rolls[next]!;
      next = (next + 1) % rolls.length;
      return roll;
    },
  };
}

export function createCombatEscapeFixtureRoller(mode: CombatEscapeRollFixtureMode): DiceRoller {
  const result = mode === "success" ? 8 : 3;
  return { d20: () => result };
}
