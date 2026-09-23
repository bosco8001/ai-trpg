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
 * normal：12, 17, 8，依序給玩家、敵人 1、敵人 2。
 * tie：10, 11, 6 造成玩家與敵人 1 同為 12；7, 7 再平手；4, 15 才排定。
 */
export function createCombatFixtureRoller(mode: CombatRollFixtureMode): DiceRoller {
  return new SequenceD20Roller(mode === "tie"
    ? [10, 11, 6, 7, 7, 4, 15]
    : [12, 17, 8]);
}

/** 固定攻擊測試骰與先攻骰分開，避免兩種 fixture 共用或消耗彼此的序列。 */
export function createCombatActionFixtureRoller(mode: CombatActionRollFixtureMode): DiceRoller {
  const sequence: Readonly<Record<CombatActionRollFixtureMode, readonly number[]>> = {
    hit: [10, 8],
    miss: [3, 15],
    "raw-one-hit": [1, 1],
  };
  return new SequenceD20Roller(sequence[mode]);
}

export function createCombatEscapeFixtureRoller(mode: CombatEscapeRollFixtureMode): DiceRoller {
  const result = mode === "success" ? 8 : 3;
  return { d20: () => result };
}
