import type { FastifyInstance, FastifyReply } from "fastify";
import { createGameState } from "../../domain/game.js";
import { getCurrentCombatItemOptions } from "../../domain/combat.js";
import type { CombatItemUseResult, CombatTransitionResult, DefendResult, NormalAttackResult, RowMoveResult, RunResult } from "../../domain/combat.js";
import {
  isCombatItemOptionsResponse,
  isCombatItemUseResponse,
  isCombatDefendResponse,
  isCombatRunResponse,
  isCombatNormalAttackResponse,
  isCombatRowMoveResponse,
  isNormalAttackOptionsResponse,
  isRowMoveOptionsResponse,
  isPhysicalSkillOptionsResponse,
  isPhysicalSkillUseResponse,
  isCastingResponse,
  isDragonBreathOptionsResponse,
  isDragonBreathResponse,
  isCombatPartyOptionsResponse,
  isCompanionTacticPreferenceResponse,
} from "../../shared/game-state.js";
import { InvalidPersistedStateError, PersistenceUnavailableError } from "../postgres-game-state-repository.js";
import type { CombatService } from "./service.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isRequest(value: unknown): value is { expectedRevision: number } {
  return isRecord(value) && Object.keys(value).length === 1
    && Object.hasOwn(value, "expectedRevision") && typeof value.expectedRevision === "number"
    && Number.isSafeInteger(value.expectedRevision) && value.expectedRevision >= 0;
}

function status(result: Extract<CombatTransitionResult, { ok: false }>): number {
  return result.code === "invalid-command" || result.code === "invalid-combat-setup" ? 400 : 409;
}

function safeFailure(app: FastifyInstance, reply: FastifyReply, error: unknown) {
  app.log.error({ err: error }, "TEST 戰鬥操作失敗");
  if (error instanceof PersistenceUnavailableError) {
    return reply.code(503).send({ error: "state-unavailable", message: "戰鬥狀態暫時無法使用，請稍後再試。" });
  }
  if (error instanceof InvalidPersistedStateError) {
    return reply.code(500).send({ error: "state-invalid", message: "已保存的戰鬥狀態無法安全讀取。" });
  }
  return reply.code(500).send({ error: "combat-failed", message: "目前無法處理 TEST 戰鬥操作。" });
}

function validatedState(value: unknown) {
  return createGameState(value);
}

export function registerCombatSandbox(
  app: FastifyInstance,
  service: CombatService,
  storage: "memory" | "postgres",
) {
  app.get("/api/dev/combat", async (_request, reply) => {
    reply.header("Cache-Control", "no-store");
    try {
      return { sandbox: true, storage, state: validatedState(await service.getState()) };
    } catch (error) {
      return safeFailure(app, reply, error);
    }
  });

  const operation = (kind: "start" | "advance") => async (request: { body: unknown }, reply: FastifyReply) => {
    reply.header("Cache-Control", "no-store");
    if (!isRequest(request.body)) {
      return reply.code(400).send({ error: "invalid-request", message: "請送出有效的 TEST 戰鬥請求。" });
    }
    try {
      const result = kind === "start" ? await service.start(request.body) : await service.advance(request.body);
      if (!result.ok) return reply.code(status(result)).send(result);
      return { sandbox: true, storage, effect: result.effect, state: validatedState(result.state) };
    } catch (error) {
      return safeFailure(app, reply, error);
    }
  };

  const options = {
    bodyLimit: 1024,
    errorHandler: (_error: Error, _request: unknown, reply: FastifyReply) => {
      reply.header("Cache-Control", "no-store");
      return reply.code(400).send({ error: "invalid-request", message: "請送出有效的 TEST 戰鬥請求。" });
    },
  };
  app.post<{ Body: unknown }>("/api/dev/combat/start", options, operation("start"));
  app.post<{ Body: unknown }>("/api/dev/combat/advance", options, operation("advance"));
}

function actionStatus(result: Extract<NormalAttackResult, { ok: false }>): number {
  return result.code === "invalid-command" ? 400 : result.code === "invalid-roll" ? 500 : 409;
}

function safeActionFailure(app: FastifyInstance, reply: FastifyReply, error: unknown) {
  app.log.error({ err: error }, "普通攻擊操作失敗");
  if (error instanceof PersistenceUnavailableError) {
    return reply.code(503).send({ error: "state-unavailable", message: "戰鬥狀態暫時無法使用，請稍後再試。" });
  }
  if (error instanceof InvalidPersistedStateError) {
    return reply.code(500).send({ error: "state-invalid", message: "已保存的戰鬥狀態無法安全讀取。" });
  }
  return reply.code(500).send({ error: "combat-action-failed", message: "目前無法處理普通攻擊，請重新讀取戰鬥狀態。" });
}

function rowMoveStatus(result: Extract<RowMoveResult, { ok: false }>): number {
  return result.code === "invalid-command" ? 400 : 409;
}

function safeRowMoveFailure(app: FastifyInstance, reply: FastifyReply, error: unknown) {
  app.log.error({ err: error }, "戰鬥換排操作失敗");
  if (error instanceof PersistenceUnavailableError) {
    return reply.code(503).send({ error: "state-unavailable", message: "戰鬥狀態暫時無法使用，請稍後再試。" });
  }
  if (error instanceof InvalidPersistedStateError) {
    return reply.code(500).send({ error: "state-invalid", message: "已保存的戰鬥狀態無法安全讀取。" });
  }
  return reply.code(500).send({ error: "combat-row-move-failed", message: "目前無法處理移動，請重新讀取戰鬥狀態。" });
}

function itemUseStatus(result: Extract<CombatItemUseResult, { ok: false }>): number {
  return result.code === "invalid-command" ? 400 : 409;
}

function safeItemUseFailure(app: FastifyInstance, reply: FastifyReply, error: unknown) {
  app.log.error({ err: error }, "戰鬥物品使用失敗");
  if (error instanceof PersistenceUnavailableError) {
    return reply.code(503).send({ error: "state-unavailable", message: "戰鬥狀態暫時無法使用，請稍後再試。" });
  }
  if (error instanceof InvalidPersistedStateError) {
    return reply.code(500).send({ error: "state-invalid", message: "已保存的戰鬥狀態無法安全讀取。" });
  }
  return reply.code(500).send({ error: "combat-item-use-failed", message: "目前無法使用物品，請重新讀取戰鬥狀態。" });
}

function defendStatus(result: Extract<DefendResult, { ok: false }>): number {
  return result.code === "invalid-command" ? 400 : 409;
}

function safeDefendFailure(app: FastifyInstance, reply: FastifyReply, error: unknown) {
  app.log.error({ err: error }, "戰鬥防禦操作失敗");
  if (error instanceof PersistenceUnavailableError) {
    return reply.code(503).send({ error: "state-unavailable", message: "戰鬥狀態暫時無法使用，請稍後再試。" });
  }
  if (error instanceof InvalidPersistedStateError) {
    return reply.code(500).send({ error: "state-invalid", message: "已保存的戰鬥狀態無法安全讀取。" });
  }
  return reply.code(500).send({ error: "combat-defend-failed", message: "目前無法處理防禦，請重新讀取戰鬥狀態。" });
}

function safeRunFailure(app: FastifyInstance, reply: FastifyReply, error: unknown) {
  app.log.error({ err: error }, "戰鬥逃跑操作失敗");
  if (error instanceof PersistenceUnavailableError) {
    return reply.code(503).send({ error: "state-unavailable", message: "戰鬥狀態暫時無法使用，請稍後再試。" });
  }
  if (error instanceof InvalidPersistedStateError) {
    return reply.code(500).send({ error: "state-invalid", message: "已保存的戰鬥狀態無法安全讀取。" });
  }
  return reply.code(500).send({ error: "combat-run-failed", message: "目前無法處理逃跑，請重新讀取戰鬥狀態。" });
}

function safeCastingFailure(app: FastifyInstance, reply: FastifyReply, error: unknown) {
  app.log.error({ err: error }, "戰鬥詠唱操作失敗");
  if (error instanceof PersistenceUnavailableError) {
    return reply.code(503).send({ error: "state-unavailable", message: "戰鬥狀態暫時無法使用，請稍後再試。" });
  }
  if (error instanceof InvalidPersistedStateError) {
    return reply.code(500).send({ error: "state-invalid", message: "已保存的戰鬥狀態無法安全讀取。" });
  }
  return reply.code(500).send({ error: "casting-failed", message: "目前無法處理詠唱，請重新讀取戰鬥狀態。" });
}

function safeBreathFailure(app: FastifyInstance, reply: FastifyReply, error: unknown) {
  app.log.error({ err: error }, "戰鬥龍息操作失敗");
  if (error instanceof PersistenceUnavailableError) {
    return reply.code(503).send({ error: "state-unavailable", message: "戰鬥狀態暫時無法使用，請稍後再試。" });
  }
  if (error instanceof InvalidPersistedStateError) {
    return reply.code(500).send({ error: "state-invalid", message: "已保存的戰鬥狀態無法安全讀取。" });
  }
  return reply.code(500).send({ error: "dragon-breath-failed", message: "目前無法處理龍息，請重新讀取戰鬥狀態。" });
}

function safePartyFailure(app: FastifyInstance, reply: FastifyReply, error: unknown) {
  app.log.error({ err: error }, "隊伍資料操作失敗");
  if (error instanceof PersistenceUnavailableError) {
    return reply.code(503).send({ error: "state-unavailable", message: "隊伍資料暫時無法使用，請稍後再試。" });
  }
  if (error instanceof InvalidPersistedStateError) {
    return reply.code(500).send({ error: "state-invalid", message: "已保存的隊伍資料無法安全讀取。" });
  }
  return reply.code(500).send({ error: "party-failed", message: "目前無法處理隊伍資料，請重新讀取後再試。" });
}

/** Formal read/action boundary. Legal targets are derived; only the attack transition writes state. */
export function registerCombatActionRoutes(
  app: FastifyInstance,
  service: CombatService,
  storage: "memory" | "postgres",
  sandbox: boolean,
) {
  app.get("/api/combat/party", async (_request, reply) => {
    reply.header("Cache-Control", "no-store");
    try {
      const response = await service.partyOptions();
      if (!isCombatPartyOptionsResponse(response)) throw new Error("隊伍資料未通過 runtime validation。");
      return response;
    } catch (error) { return safePartyFailure(app, reply, error); }
  });

  app.post<{ Body: unknown }>("/api/combat/party/tactic", {
    bodyLimit: 1024,
    errorHandler: (_error: Error, _request: unknown, reply: FastifyReply) => {
      reply.header("Cache-Control", "no-store");
      return reply.code(400).send({ error: "invalid-request", message: "請送出有效的隊友偏好設定。" });
    },
  }, async (request, reply) => {
    reply.header("Cache-Control", "no-store");
    try {
      const result = await service.setCompanionTacticPreference(request.body);
      if (!result.ok) {
        const code = result.code === "invalid-command" ? 400
          : result.code === "companion-not-found" || result.code === "tactic-preference-not-found" ? 404 : 409;
        return reply.code(code).send({ error: result.code, message: result.message });
      }
      const response = { sandbox, storage, effect: result.effect, state: validatedState(result.state) };
      if (!isCompanionTacticPreferenceResponse(response)) throw new Error("隊友偏好回應未通過 runtime validation。");
      return response;
    } catch (error) { return safePartyFailure(app, reply, error); }
  });

  app.get("/api/combat/dragon-breath/options", async (_request, reply) => {
    reply.header("Cache-Control", "no-store");
    try {
      const result = await service.dragonBreathOptions();
      if (!result.ok) return reply.code(409).send({ error: result.code, message: result.message });
      const response = { revision: result.revision, ...result.options };
      if (!isDragonBreathOptionsResponse(response)) throw new Error("龍息選項未通過 runtime validation。");
      return response;
    } catch (error) { return safeBreathFailure(app, reply, error); }
  });
  app.post<{ Body: unknown }>("/api/combat/dragon-breath", {
    bodyLimit: 1024,
    errorHandler: (_error: Error, _request: unknown, reply: FastifyReply) => {
      reply.header("Cache-Control", "no-store");
      return reply.code(400).send({ error: "invalid-request", message: "請送出有效的龍息請求。" });
    },
  }, async (request, reply) => {
    reply.header("Cache-Control", "no-store");
    try {
      const result = await service.useDragonBreath(request.body);
      if (!result.ok) return reply.code(result.code === "invalid-command" ? 400
        : result.code === "invalid-roll" ? 500 : 409).send({ error: result.code, message: result.message });
      const response = { sandbox, storage, effect: result.effect, state: validatedState(result.state) };
      if (!isDragonBreathResponse(response)) throw new Error("龍息回應未通過 runtime validation。");
      return response;
    } catch (error) { return safeBreathFailure(app, reply, error); }
  });
  for (const kind of ["start", "continue", "cancel"] as const) {
    app.post<{ Body: unknown }>(`/api/combat/casting/${kind}`, {
      bodyLimit: 1024,
      errorHandler: (_error: Error, _request: unknown, reply: FastifyReply) => {
        reply.header("Cache-Control", "no-store");
        return reply.code(400).send({ error: "invalid-request", message: "請送出有效的詠唱請求。" });
      },
    }, async (request, reply) => {
      reply.header("Cache-Control", "no-store");
      try {
        const result = kind === "start" ? await service.startCasting(request.body)
          : kind === "continue" ? await service.continueCasting(request.body)
            : await service.cancelCasting(request.body);
        if (!result.ok) return reply.code(result.code === "invalid-command" ? 400 : 409)
          .send({ error: result.code, message: result.message });
        const response = { sandbox, storage, effect: result.effect, state: validatedState(result.state) };
        if (!isCastingResponse(response)) throw new Error("詠唱回應未通過 runtime validation。");
        return response;
      } catch (error) {
        return safeCastingFailure(app, reply, error);
      }
    });
  }
  app.get("/api/combat/physical-skills/options", async (_request, reply) => {
    reply.header("Cache-Control", "no-store");
    try {
      const result = await service.physicalSkillOptions();
      if (!result.ok) return reply.code(409).send({ error: result.code, message: result.message });
      const response = { revision: result.revision, ...result.options };
      if (!isPhysicalSkillOptionsResponse(response)) throw new Error("物理技能選項未通過 runtime validation。");
      return response;
    } catch (error) {
      return safeActionFailure(app, reply, error);
    }
  });

  app.post<{ Body: unknown }>("/api/combat/physical-skills/use", {
    bodyLimit: 1024,
    errorHandler: (_error: Error, _request: unknown, reply: FastifyReply) => {
      reply.header("Cache-Control", "no-store");
      return reply.code(400).send({ error: "invalid-request", message: "請送出有效的物理技能請求。" });
    },
  }, async (request, reply) => {
    reply.header("Cache-Control", "no-store");
    try {
      const result = await service.usePhysicalSkill(request.body);
      if (!result.ok) return reply.code(result.code === "invalid-command" ? 400
        : result.code === "invalid-roll" ? 500 : 409).send({ error: result.code, message: result.message });
      const response = { sandbox, storage, effect: result.effect, state: validatedState(result.state) };
      if (!isPhysicalSkillUseResponse(response)) throw new Error("物理技能回應未通過 runtime validation。");
      return response;
    } catch (error) {
      return safeActionFailure(app, reply, error);
    }
  });

  app.get("/api/combat/normal-attack/options", async (_request, reply) => {
    reply.header("Cache-Control", "no-store");
    try {
      const result = await service.normalAttackOptions();
      if (!result.ok) {
        return reply.code(409).send({ error: result.code, message: result.message });
      }
      const response = { revision: result.revision, ...result.options };
      if (!isNormalAttackOptionsResponse(response)) throw new Error("普通攻擊目標回應未通過 runtime validation。");
      return response;
    } catch (error) {
      return safeActionFailure(app, reply, error);
    }
  });

  app.post<{ Body: unknown }>("/api/combat/normal-attack", {
    bodyLimit: 1024,
    errorHandler: (_error: Error, _request: unknown, reply: FastifyReply) => {
      reply.header("Cache-Control", "no-store");
      return reply.code(400).send({ error: "invalid-request", message: "請送出有效的普通攻擊請求。" });
    },
  }, async (request, reply) => {
    reply.header("Cache-Control", "no-store");
    try {
      const result = await service.normalAttack(request.body);
      if (!result.ok) {
        return reply.code(actionStatus(result)).send({ error: result.code, message: result.message });
      }
      const response = {
        sandbox,
        storage,
        effect: result.effect,
        state: validatedState(result.state),
      };
      if (!isCombatNormalAttackResponse(response)) throw new Error("普通攻擊回應未通過 runtime validation。");
      return response;
    } catch (error) {
      return safeActionFailure(app, reply, error);
    }
  });

  app.get("/api/combat/row-move/options", async (_request, reply) => {
    reply.header("Cache-Control", "no-store");
    try {
      const result = await service.rowMoveOptions();
      if (!result.ok) return reply.code(409).send({ error: result.code, message: result.message });
      const response = { revision: result.revision, ...result.options };
      if (!isRowMoveOptionsResponse(response)) throw new Error("換排選項回應未通過 runtime validation。");
      return response;
    } catch (error) {
      return safeRowMoveFailure(app, reply, error);
    }
  });

  app.post<{ Body: unknown }>("/api/combat/row-move", {
    bodyLimit: 1024,
    errorHandler: (_error: Error, _request: unknown, reply: FastifyReply) => {
      reply.header("Cache-Control", "no-store");
      return reply.code(400).send({ error: "invalid-request", message: "請送出有效的移動請求。" });
    },
  }, async (request, reply) => {
    reply.header("Cache-Control", "no-store");
    try {
      const result = await service.moveRow(request.body);
      if (!result.ok) {
        return reply.code(rowMoveStatus(result)).send({ error: result.code, message: result.message });
      }
      const response = {
        sandbox,
        storage,
        effect: result.effect,
        state: validatedState(result.state),
      };
      if (!isCombatRowMoveResponse(response)) throw new Error("換排回應未通過 runtime validation。");
      return response;
    } catch (error) {
      return safeRowMoveFailure(app, reply, error);
    }
  });

  app.get("/api/combat/items/options", async (_request, reply) => {
    reply.header("Cache-Control", "no-store");
    try {
      const result = await service.combatItemOptions();
      if (!result.ok) return reply.code(409).send({ error: result.code, message: result.message });
      const response = { revision: result.revision, ...result.options };
      if (!isCombatItemOptionsResponse(response)) throw new Error("戰鬥物品選項未通過 runtime validation。");
      return response;
    } catch (error) {
      return safeItemUseFailure(app, reply, error);
    }
  });

  app.post<{ Body: unknown }>("/api/combat/items/use", {
    bodyLimit: 1024,
    errorHandler: (_error: Error, _request: unknown, reply: FastifyReply) => {
      reply.header("Cache-Control", "no-store");
      return reply.code(400).send({ error: "invalid-request", message: "請送出有效的物品使用請求。" });
    },
  }, async (request, reply) => {
    reply.header("Cache-Control", "no-store");
    try {
      const result = await service.useCombatItem(request.body);
      if (!result.ok) return reply.code(itemUseStatus(result)).send({ error: result.code, message: result.message });
      const derived = getCurrentCombatItemOptions(result.state);
      if (!derived.ok) throw new Error("已提交的戰鬥物品狀態無法建立 options。");
      const response = {
        sandbox,
        storage,
        effect: result.effect,
        state: validatedState(result.state),
        options: { revision: derived.revision, ...derived.options },
      };
      if (!isCombatItemUseResponse(response)) throw new Error("戰鬥物品回應未通過 runtime validation。");
      return response;
    } catch (error) {
      return safeItemUseFailure(app, reply, error);
    }
  });

  app.post<{ Body: unknown }>("/api/combat/defend", {
    bodyLimit: 1024,
    errorHandler: (_error: Error, _request: unknown, reply: FastifyReply) => {
      reply.header("Cache-Control", "no-store");
      return reply.code(400).send({ error: "invalid-request", message: "請送出有效的防禦請求。" });
    },
  }, async (request, reply) => {
    reply.header("Cache-Control", "no-store");
    try {
      const result = await service.defend(request.body);
      if (!result.ok) return reply.code(defendStatus(result)).send({ error: result.code, message: result.message });
      const response = {
        sandbox,
        storage,
        effect: result.effect,
        state: validatedState(result.state),
      };
      if (!isCombatDefendResponse(response)) throw new Error("防禦回應未通過 runtime validation。");
      return response;
    } catch (error) {
      return safeDefendFailure(app, reply, error);
    }
  });

  app.post<{ Body: unknown }>("/api/combat/run", {
    bodyLimit: 1024,
    errorHandler: (_error: Error, _request: unknown, reply: FastifyReply) => {
      reply.header("Cache-Control", "no-store");
      return reply.code(400).send({ error: "invalid-request", message: "請送出有效的逃跑請求。" });
    },
  }, async (request, reply) => {
    reply.header("Cache-Control", "no-store");
    try {
      const result: RunResult = await service.run(request.body);
      if (!result.ok) return reply.code(result.code === "invalid-command" ? 400 : result.code === "invalid-roll" ? 500 : 409)
        .send({ error: result.code, message: result.message });
      const response = { sandbox, storage, effect: result.effect, state: validatedState(result.state) };
      if (!isCombatRunResponse(response)) throw new Error("逃跑回應未通過 runtime validation。");
      return response;
    } catch (error) {
      return safeRunFailure(app, reply, error);
    }
  });
}
