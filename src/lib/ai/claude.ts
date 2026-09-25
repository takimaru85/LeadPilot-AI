import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";
import { env } from "@/lib/env";

export class AiError extends Error {
  constructor(
    message: string,
    readonly kind: "config" | "refusal" | "rate_limit" | "invalid_output" | "unavailable",
  ) {
    super(message);
    this.name = "AiError";
  }
}

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!env.anthropicApiKey) throw new AiError("ANTHROPIC_API_KEY is not configured.", "config");
  client ??= new Anthropic({ apiKey: env.anthropicApiKey, maxRetries: 2, timeout: 110_000 });
  return client;
}

/** Server-side refusal fallback is supported on the Opus 5 / Fable 5.1 families. */
function supportsFallbacks(model: string) {
  return process.env.ANTHROPIC_FALLBACKS !== "off" && /^claude-(opus-5|fable-5-1)/.test(model);
}

export interface StructuredResult<T> {
  data: T;
  model: string;
}

/**
 * One structured-output call. The response is validated against the Zod schema by the SDK;
 * anything that doesn't parse is surfaced as an AiError rather than silently accepted.
 */
export async function runStructured<S extends z.ZodType>(opts: {
  schema: S;
  system: string;
  user: string;
  effort?: "low" | "medium" | "high";
  maxTokens?: number;
}): Promise<StructuredResult<z.infer<S>>> {
  const model = env.anthropicModel;
  try {
    const res = await getClient().beta.messages.parse({
      model,
      max_tokens: opts.maxTokens ?? 16000,
      ...(supportsFallbacks(model) ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
      thinking: { type: "adaptive" },
      system: opts.system,
      messages: [{ role: "user", content: opts.user }],
      output_config: { effort: opts.effort ?? "medium", format: betaZodOutputFormat(opts.schema) },
    });

    if (res.stop_reason === "refusal") {
      throw new AiError("The AI declined this request. Review the lead data for anything unusual and try again.", "refusal");
    }
    if (res.stop_reason === "max_tokens") {
      throw new AiError("The AI response was cut off before it finished. Please retry.", "invalid_output");
    }
    if (!res.parsed_output) {
      throw new AiError("The AI returned a response that didn't match the expected format. Please retry.", "invalid_output");
    }
    return { data: res.parsed_output as z.infer<S>, model: res.model };
  } catch (e) {
    if (e instanceof AiError) throw e;
    if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) {
      throw new AiError("The Anthropic API key was rejected. Check ANTHROPIC_API_KEY.", "config");
    }
    if (e instanceof Anthropic.RateLimitError) {
      throw new AiError("AI rate limit reached. Wait a minute and try again.", "rate_limit");
    }
    if (e instanceof Anthropic.BadRequestError) {
      throw new AiError(`The AI request was invalid: ${e.message}`, "config");
    }
    if (e instanceof Anthropic.APIConnectionError) {
      throw new AiError("Couldn't reach the AI service. Check your connection and retry.", "unavailable");
    }
    if (e instanceof Anthropic.APIError) {
      throw new AiError(`AI service error (${e.status ?? "unknown"}). Please retry.`, "unavailable");
    }
    throw e;
  }
}

/** Wrap untrusted, externally-sourced text so the model treats it as data. */
export function asData(tag: string, value: unknown): string {
  return `<${tag}>\n${JSON.stringify(value, null, 2)}\n</${tag}>`;
}
