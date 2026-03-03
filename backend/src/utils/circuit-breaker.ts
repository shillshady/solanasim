// Circuit breaker for external API calls
import type pino from "pino";

export class CircuitBreaker {
  private failureCount = 0;
  private lastFailureTime = 0;
  private state: "CLOSED" | "OPEN" | "HALF_OPEN" = "CLOSED";
  private readonly threshold = 5;
  private readonly timeout = 60000;
  private readonly name: string;
  private readonly logger?: pino.Logger;

  constructor(name: string = "unknown", logger?: pino.Logger) {
    this.name = name;
    this.logger = logger;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T | null> {
    if (this.state === "OPEN") {
      if (Date.now() - this.lastFailureTime > this.timeout) {
        this.state = "HALF_OPEN";
        this.logger?.info({ breaker: this.name }, "Circuit breaker entering HALF_OPEN state");
      } else {
        throw new Error("Circuit breaker is OPEN");
      }
    }

    try {
      const result = await fn();
      if (this.state === "HALF_OPEN") {
        this.state = "CLOSED";
        this.failureCount = 0;
        this.logger?.info({ breaker: this.name }, "Circuit breaker returned to CLOSED state");
      }
      return result;
    } catch (error: any) {
      const isExpectedFailure =
        error.message?.includes("404") ||
        error.message?.includes("204") ||
        error.message?.includes("No Content") ||
        error.message?.includes("Not Found") ||
        error.message?.includes("Token not found") ||
        error.message?.includes("aborted") ||
        error.message?.includes("fetch failed") ||
        error.name === "AbortError";

      if (isExpectedFailure) {
        this.logger?.debug(
          { breaker: this.name, error: error.message, type: error.name },
          "Expected failure - not counting toward circuit breaker"
        );
        throw error;
      }

      this.failureCount++;
      this.lastFailureTime = Date.now();

      if (this.failureCount >= this.threshold) {
        this.state = "OPEN";
        this.logger?.error(
          { breaker: this.name, error: error.message },
          "Circuit breaker opened after 5 unexpected failures"
        );
      }
      throw error;
    }
  }

  getState(): string {
    return this.state;
  }

  reset(): void {
    this.state = "CLOSED";
    this.failureCount = 0;
    this.lastFailureTime = 0;
    this.logger?.info({ breaker: this.name }, "Circuit breaker manually reset");
  }
}
