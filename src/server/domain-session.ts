import { applyCommand, createGameState, replaceGameStateContents } from "../domain/game.js";
import type { GameState } from "../domain/game.js";
import type { GameStateRepository } from "../domain/game-state-repository.js";
import {
  getCombatPartyOptions,
  setCompanionTacticPreference as setCompanionTacticPreferenceTransition,
} from "../domain/party.js";
import {
  advanceCombatTurn,
  defendCombatTurn,
  getCurrentCombatItemOptions,
  getCurrentRowMoveOptions,
  getCurrentNormalAttackOptions,
  getCurrentPhysicalSkillOptions,
  moveCombatRow,
  resolveNormalAttack,
  usePhysicalSkill,
  startCasting,
  continueCasting,
  cancelCasting,
  getCurrentDragonBreathOptions,
  useDragonBreath,
  runFromCombat,
  resolveCompanionTurn,
  useCombatItem as useCombatItemTransition,
  applyCombatDamage, processDyingTurn, rescueCombatant,
  startCombat as startCombatTransition,
  type CombatParticipantSeed,
  type DiceRoller,
  type CombatItemOptionsResult,
  type CombatItemUseResult,
} from "../domain/combat.js";

import { settleCombat, phase26, newIdentity } from "../domain/settlement.js";
import { reserve, append, type NarrativeReservation } from "./history.js";
import { createTestGameState } from "./test-game-state.js";
export interface GameStateSession {
  settleCombat(input: unknown): Promise<import("../domain/settlement.js").SettlementTransition & {reservation?: import("./history.js").NarrativeReservation}>;
  resetTest(input: unknown): Promise<import("../domain/game.js").StateReplacementResult>;
  reserveNarrative(type: "system" | "tutorial" | "meta"): Promise<import("./history.js").NarrativeReservation | undefined>;
  appendNarrative(reservation: import("./history.js").NarrativeReservation, text: string, source: "model" | "fallback"): Promise<import("./history.js").AppendOutcome>;
  getState(): GameState | Promise<GameState>;
  partyOptions(): ReturnType<typeof getCombatPartyOptions> | Promise<ReturnType<typeof getCombatPartyOptions>>;
  setCompanionTacticPreference(input: unknown): ReturnType<typeof setCompanionTacticPreferenceTransition>
    | Promise<ReturnType<typeof setCompanionTacticPreferenceTransition>>;
  actCompanion(input: unknown, roller: DiceRoller): ReturnType<typeof resolveCompanionTurn>
    | Promise<ReturnType<typeof resolveCompanionTurn>>;
  applyCombatDamage(input: unknown): ReturnType<typeof applyCombatDamage> | Promise<ReturnType<typeof applyCombatDamage>>;
  processDyingTurn(input: unknown): ReturnType<typeof processDyingTurn> | Promise<ReturnType<typeof processDyingTurn>>;
  rescueCombatant(input: unknown): ReturnType<typeof rescueCombatant> | Promise<ReturnType<typeof rescueCombatant>>;
  execute(input: unknown): (ReturnType<typeof applyCommand> & {reservation?: import("./history.js").NarrativeReservation}) | Promise<ReturnType<typeof applyCommand> & {reservation?: import("./history.js").NarrativeReservation}>;
  replaceContents(expectedRevision: unknown, contents: unknown): ReturnType<typeof replaceGameStateContents>
    | Promise<ReturnType<typeof replaceGameStateContents>>;
  startCombat(input: unknown, participants: readonly CombatParticipantSeed[], roller: DiceRoller, context?: import("../domain/combat.js").CombatStartContext):
    ReturnType<typeof startCombatTransition> | Promise<ReturnType<typeof startCombatTransition>>;
  advanceCombat(input: unknown): ReturnType<typeof advanceCombatTurn>
    | Promise<ReturnType<typeof advanceCombatTurn>>;
  normalAttackOptions(): ReturnType<typeof getCurrentNormalAttackOptions>
    | Promise<ReturnType<typeof getCurrentNormalAttackOptions>>;
  normalAttack(input: unknown, roller: DiceRoller): ReturnType<typeof resolveNormalAttack>
    | Promise<ReturnType<typeof resolveNormalAttack>>;
  rowMoveOptions(): ReturnType<typeof getCurrentRowMoveOptions>
    | Promise<ReturnType<typeof getCurrentRowMoveOptions>>;
  moveRow(input: unknown): ReturnType<typeof moveCombatRow>
    | Promise<ReturnType<typeof moveCombatRow>>;
  combatItemOptions(): CombatItemOptionsResult | Promise<CombatItemOptionsResult>;
  useCombatItem(input: unknown): CombatItemUseResult | Promise<CombatItemUseResult>;
  defend(input: unknown): ReturnType<typeof defendCombatTurn> | Promise<ReturnType<typeof defendCombatTurn>>;
  run(input: unknown, roller: DiceRoller): ReturnType<typeof runFromCombat> | Promise<ReturnType<typeof runFromCombat>>;
  physicalSkillOptions(): ReturnType<typeof getCurrentPhysicalSkillOptions> | Promise<ReturnType<typeof getCurrentPhysicalSkillOptions>>;
  usePhysicalSkill(input: unknown, roller: DiceRoller): ReturnType<typeof usePhysicalSkill> | Promise<ReturnType<typeof usePhysicalSkill>>;
  startCasting(input: unknown): ReturnType<typeof startCasting> | Promise<ReturnType<typeof startCasting>>;
  continueCasting(input: unknown): ReturnType<typeof continueCasting> | Promise<ReturnType<typeof continueCasting>>;
  cancelCasting(input: unknown): ReturnType<typeof cancelCasting> | Promise<ReturnType<typeof cancelCasting>>;
  dragonBreathOptions(): ReturnType<typeof getCurrentDragonBreathOptions> | Promise<ReturnType<typeof getCurrentDragonBreathOptions>>;
  useDragonBreath(input: unknown, roller: DiceRoller): ReturnType<typeof useDragonBreath> | Promise<ReturnType<typeof useDragonBreath>>;
}


type Boundary = <T>(transition:(state:GameState)=>{result:T;nextState?:GameState})=>Promise<T>;
function methods(read:()=>GameState | Promise<GameState>, boundary:Boundary): GameStateSession {
  async function mutate<T extends {ok:boolean;state?:GameState}>(transition:(state:GameState)=>T):Promise<T> {
    return boundary(state => {const result=transition(state);return {result,...(result.ok && result.state && result.state !== state ? {nextState:result.state} : {})};});
  }
  return {
    getState:read,
    async execute(input) {
      return boundary<Awaited<ReturnType<GameStateSession["execute"]>>>(state => {
        const result=applyCommand(state,input);
        if (!result.ok) return {result};
        if (result.effect.type === 'equipped-skills-updated' || !result.state.phase26) return {result,nextState:result.state};
        const reserved=reserve(result.state,'exploration');
        return {result:{...result,state:reserved.state,reservation:reserved.reservation},nextState:reserved.state};
      });
    },
    replaceContents:(revision,contents)=>mutate(state=>replaceGameStateContents(state,revision,contents)),
    startCombat:(input,participants,roller,context)=>mutate(state=>startCombatTransition(state,input,participants,roller,context)),
    async settleCombat(input) {
      return boundary<Awaited<ReturnType<GameStateSession["settleCombat"]>>>(state=>{
        const result=settleCombat(state,input);
        if (!result.ok) return {result};
        const reserved=reserve(result.state,'post-combat',result.settlementResult.combatId);
        return {result:{...result,state:reserved.state,reservation:reserved.reservation},nextState:reserved.state};
      });
    },
    async resetTest(input) {
      return mutate(state=>{
        const reject = () => ({ok:false as const,code:'invalid-state' as const,message:'目前世界不屬於可重建的 TEST fixture。'});
        if (!input || typeof input !== 'object' || Object.keys(input).length !== 1 || !('expectedRevision' in input)) return reject();
        if (input.expectedRevision !== state.revision) return {ok:false as const,code:'stale-revision' as const,message:'狀態已更新，請重新讀取。'};
        if (state.revision === Number.MAX_SAFE_INTEGER) return {ok:false as const,code:'revision-limit' as const,message:'狀態版本已達上限。'};
        const p=phase26(state);
        if (state.character.id !== 'TEST-character' || p.runId !== 'TEST-run-v1' || p.worldId !== 'TEST-world-v1' || p.fixtureId !== 'phase26-test-v1'
          || state.combat && state.combat.lifecycle?.fixtureId !== p.fixtureId) return reject();
        const seed=createTestGameState(), fresh=phase26(seed);
        return {ok:true as const,state:createGameState({...seed,revision:state.revision+1,phase26:{...fresh,runId:p.runId,runtimeGeneration:newIdentity(),sequenceHighWater:p.sequenceHighWater,narrativeLedger:p.narrativeLedger}})};
      });
    },
    async reserveNarrative(type) {return boundary(state=>{const r=reserve(state,type);return {result:r.reservation,nextState:r.state};});},
    async appendNarrative(r,text,source) {return boundary(state=>append(state,r,text,source));},
    partyOptions:async()=>getCombatPartyOptions(await read()),
    setCompanionTacticPreference:input=>mutate(state=>setCompanionTacticPreferenceTransition(state,input)),
    actCompanion:(input,roller)=>mutate(state=>resolveCompanionTurn(state,input,roller)),
    applyCombatDamage:input=>mutate(state=>applyCombatDamage(state,input)),
    processDyingTurn:input=>mutate(state=>processDyingTurn(state,input)),
    rescueCombatant:input=>mutate(state=>rescueCombatant(state,input)),
    advanceCombat:input=>mutate(state=>advanceCombatTurn(state,input)),
    normalAttackOptions:async()=>getCurrentNormalAttackOptions(await read()),
    normalAttack:(input,roller)=>mutate(state=>resolveNormalAttack(state,input,roller)),
    rowMoveOptions:async()=>getCurrentRowMoveOptions(await read()),
    moveRow:input=>mutate(state=>moveCombatRow(state,input)),
    combatItemOptions:async()=>getCurrentCombatItemOptions(await read()),
    useCombatItem:input=>mutate(state=>useCombatItemTransition(state,input)),
    defend:input=>mutate(state=>defendCombatTurn(state,input)),
    run:(input,roller)=>mutate(state=>runFromCombat(state,input,roller)),
    physicalSkillOptions:async()=>getCurrentPhysicalSkillOptions(await read()),
    usePhysicalSkill:(input,roller)=>mutate(state=>usePhysicalSkill(state,input,roller)),
    startCasting:input=>mutate(state=>startCasting(state,input)),
    continueCasting:input=>mutate(state=>continueCasting(state,input)),
    cancelCasting:input=>mutate(state=>cancelCasting(state,input)),
    dragonBreathOptions:async()=>getCurrentDragonBreathOptions(await read()),
    useDragonBreath:(input,roller)=>mutate(state=>useDragonBreath(state,input,roller)),
  };
}
export function createDomainSession(initialState: GameState) {
  let state = createGameState(initialState);
  return {
    ...methods(()=>state,async transition=>{const {result,nextState}=transition(state);if(nextState) state=createGameState(nextState);return result;}),
    getState: () => state,
    applyCombatDamage(input: unknown) { const result = applyCombatDamage(state, input); if (result.ok) state = result.state; return result; },
    processDyingTurn(input: unknown) { const result = processDyingTurn(state, input); if (result.ok) state = result.state; return result; },
    rescueCombatant(input: unknown) { const result = rescueCombatant(state, input); if (result.ok) state = result.state; return result; },
    partyOptions: () => getCombatPartyOptions(state),
    setCompanionTacticPreference(input: unknown) {
      const result = setCompanionTacticPreferenceTransition(state, input);
      if (result.ok && result.state.revision !== state.revision) state = result.state;
      return result;
    },
    actCompanion(input: unknown, roller: DiceRoller) {
      const result = resolveCompanionTurn(state, input, roller);
      if (result.ok) state = result.state;
      return result;
    },
    execute(input: unknown) {
      const result = applyCommand(state, input);
      if (!result.ok) return result;
      const reserved = result.effect.type !== 'equipped-skills-updated' && result.state.phase26 ? reserve(result.state,'exploration') : {state:result.state,reservation:undefined};
      state=reserved.state;
      return {...result,state:reserved.state,reservation:reserved.reservation};
    },
    replaceContents(expectedRevision: unknown, contents: unknown) {
      const result = replaceGameStateContents(state, expectedRevision, contents);
      if (result.ok) state = result.state;
      return result;
    },
    startCombat(input: unknown, participants: readonly CombatParticipantSeed[], roller: DiceRoller, context?: import("../domain/combat.js").CombatStartContext) {
      const result = startCombatTransition(state, input, participants, roller,context);
      if (result.ok) state = result.state;
      return result;
    },
    advanceCombat(input: unknown) {
      const result = advanceCombatTurn(state, input);
      if (result.ok) state = result.state;
      return result;
    },
    normalAttackOptions: () => getCurrentNormalAttackOptions(state),
    normalAttack(input: unknown, roller: DiceRoller) {
      const result = resolveNormalAttack(state, input, roller);
      if (result.ok) state = result.state;
      return result;
    },
    physicalSkillOptions: () => getCurrentPhysicalSkillOptions(state),
    usePhysicalSkill(input: unknown, roller: DiceRoller) {
      const result = usePhysicalSkill(state, input, roller);
      if (result.ok) state = result.state;
      return result;
    },
    startCasting(input: unknown) {
      const result = startCasting(state, input);
      if (result.ok) state = result.state;
      return result;
    },
    continueCasting(input: unknown) {
      const result = continueCasting(state, input);
      if (result.ok) state = result.state;
      return result;
    },
    cancelCasting(input: unknown) {
      const result = cancelCasting(state, input);
      if (result.ok) state = result.state;
      return result;
    },
    dragonBreathOptions: () => getCurrentDragonBreathOptions(state),
    useDragonBreath(input: unknown, roller: DiceRoller) {
      const result = useDragonBreath(state, input, roller);
      if (result.ok) state = result.state;
      return result;
    },
    rowMoveOptions: () => getCurrentRowMoveOptions(state),
    moveRow(input: unknown) {
      const result = moveCombatRow(state, input);
      if (result.ok) state = result.state;
      return result;
    },
    combatItemOptions: () => getCurrentCombatItemOptions(state),
    useCombatItem(input: unknown) {
      const result = useCombatItemTransition(state, input);
      if (result.ok) state = result.state;
      return result;
    },
    defend(input: unknown) {
      const result = defendCombatTurn(state, input);
      if (result.ok) state = result.state;
      return result;
    },
    run(input: unknown, roller: DiceRoller) {
      const result = runFromCombat(state, input, roller);
      if (result.ok) state = result.state;
      return result;
    },
  };
}

export function createPersistedDomainSession(repository:GameStateRepository,initialState:GameState):GameStateSession {
  const seed=createGameState(initialState);
  const boundary:Boundary=async transition=>{
    if(repository.withStateLocked) return repository.withStateLocked(seed,transition);
    const state=await repository.createIfAbsent(seed),{result,nextState}=transition(state);
    if(nextState && nextState.revision === state.revision) throw new Error("此 repository 不支援原子敘事寫入。");
    if(nextState && !await repository.saveIfRevision(state.revision,nextState)) return {ok:false,code:'stale-revision',message:'狀態已更新，請重新讀取。'} as typeof result;
    return result;
  };
  return methods(()=>repository.createIfAbsent(seed),boundary);
}
