import type { FastifyInstance } from "fastify";
import { isInterpretationResponse, type InterpretationResponse } from "../../shared/interpretation.js";
import { InterpretationFailure, type ActionInterpreter } from "./interpreter.js";

function isRequestBody(value: unknown): value is { text: string } {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    && Object.keys(value).length === 1 && Object.hasOwn(value, "text")
    && typeof (value as Record<string, unknown>).text === "string";
}

export function registerInterpretationRoute(app: FastifyInstance, interpreter: ActionInterpreter) {
  app.post<{ Body: unknown; Reply: InterpretationResponse | { error: string; message: string } }>(
    "/api/interpret", {
      bodyLimit: 4096,
      errorHandler: (_error, _request, reply) => {
        reply.header("Cache-Control", "no-store");
        return reply.code(400).send({ error: "invalid-input", message: "請送出有效的文字請求。" });
      },
    }, async (request, reply) => {
      reply.header("Cache-Control", "no-store");
      if (!isRequestBody(request.body)) {
        return reply.code(400).send({ error: "invalid-input", message: "請送出有效的文字請求。" });
      }
      try {
        const response: InterpretationResponse = {
          mode: "test-fixture", candidate: await interpreter.interpret(request.body.text),
        };
        if (!isInterpretationResponse(response)) throw new InterpretationFailure("malformed-response");
        return reply.send(response);
      } catch (error) {
        const failure = error instanceof InterpretationFailure
          ? error : new InterpretationFailure("interpretation-failed");
        const status = failure.code === "invalid-input" ? 400
          : failure.code === "malformed-response" ? 502
            : failure.code === "unavailable" ? 503
              : failure.code === "timeout" ? 504 : 500;
        return reply.code(status).send({ error: failure.code, message: failure.message });
      }
    },
  );
}
