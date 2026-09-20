import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import type { HealthResponse } from "../shared/health.js";
import type { GameStateRepository } from "../domain/game-state-repository.js";
import { registerDomainSandbox } from "./domain-sandbox.js";

export async function buildApp(options: {
  webRoot?: string;
  logger?: boolean;
  domainSandbox?: boolean;
  domainRepository?: GameStateRepository;
} = {}) {
  const app = Fastify({ logger: options.logger ?? false });

  if (options.domainSandbox && process.env.NODE_ENV !== "production") {
    registerDomainSandbox(app, options.domainRepository);
  }

  app.get<{ Reply: HealthResponse }>("/api/health", {
    schema: {
      response: {
        200: {
          type: "object",
          additionalProperties: false,
          required: ["status", "service"],
          properties: {
            status: { type: "string", const: "ok" },
            service: { type: "string", const: "ai-trpg-api" },
          },
        },
      },
    },
  }, async (_request, reply) => {
    reply.header("Cache-Control", "no-store");
    return { status: "ok", service: "ai-trpg-api" };
  });

  if (options.webRoot) {
    await app.register(fastifyStatic, { root: options.webRoot });
  }
  return app;
}
