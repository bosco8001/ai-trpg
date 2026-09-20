export interface HealthResponse {
  status: "ok";
  service: "ai-trpg-api";
}

export function isHealthResponse(value: unknown): value is HealthResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    "status" in value && value.status === "ok" &&
    "service" in value && value.service === "ai-trpg-api"
  );
}
