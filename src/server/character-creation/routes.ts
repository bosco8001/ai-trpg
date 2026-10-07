import type { FastifyInstance } from "fastify";
import { CREATION_MESSAGES } from "../../shared/character-creation.js";
import { CreationFailure } from "../../domain/character-creation.js";
import { createCharacterCreationService } from "./service.js";
import type { CreationRepository } from "./contracts.js";

export function registerCharacterCreationRoutes(app: FastifyInstance, repository: CreationRepository | undefined, storage: "memory" | "postgres") {
  const service = createCharacterCreationService(repository, storage);
  const handler = {
    bodyLimit: 4096,
    errorHandler(error: Error & { statusCode?: number }, _request: unknown, reply: import("fastify").FastifyReply) {
      const status = error.statusCode && error.statusCode >= 400 && error.statusCode < 500 ? error.statusCode : 503;
      const code = status < 500 ? "invalid-request" : "unavailable";
      reply.header("Cache-Control", "no-store").code(status).send({ code, message: CREATION_MESSAGES[code] });
    },
  };
  for (const method of ["GET", "POST"] as const) app.route({ method, url: "/api/character-creation", ...handler,
    async handler(request, reply) {
      reply.header("Cache-Control", "no-store");
      if (Object.keys(request.query as Record<string, unknown>).length !== 0 || (method === "GET" && request.body !== undefined))
        return reply.code(400).send({ code: "invalid-request", message: CREATION_MESSAGES["invalid-request"] });
      const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 10_000);
      try { return method === "GET" ? await service.read(controller.signal) : await service.create(request.body, controller.signal); }
      catch (error) {
        const code = error instanceof CreationFailure ? error.code : "unavailable";
        const status = ["unsupported-version", "already-created", "request-conflict"].includes(code) ? 409
          : ["invalid-request", "invalid-allocation", "unknown-content"].includes(code) ? 400 : 503;
        return reply.code(status).send({ code, message: CREATION_MESSAGES[code] });
      } finally { clearTimeout(timer); }
    },
  });
}
