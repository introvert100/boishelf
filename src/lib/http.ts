import "server-only";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { appUrl } from "./config";
import { createHash } from "node:crypto";
import { serviceClient } from "./supabase";
export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function logEvent(
  event: string,
  details: Record<string, string | number | boolean> = {},
) {
  console.error(
    JSON.stringify({
      level: "error",
      event,
      time: new Date().toISOString(),
      ...details,
    }),
  );
}
export function apiError(error: unknown, event = "server_error") {
  const id = crypto.randomUUID();
  if (error instanceof AppError) {
    if (error.status >= 500 || event === "payment_callback_failed")
      logEvent(event, { requestId: id, status: error.status });
    return NextResponse.json(
      { error: error.message, requestId: id },
      { status: error.status },
    );
  }
  if (error instanceof ZodError)
    return NextResponse.json(
      {
        error: "Please check the fields and try again.",
        fields: error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  logEvent(event, { requestId: id });
  return NextResponse.json(
    { error: "Something went wrong. Please try again shortly.", requestId: id },
    { status: 503 },
  );
}
export function checkOrigin(request: Request) {
  if (request.headers.get("origin") !== appUrl())
    throw new AppError(
      403,
      "This request could not be verified. Please reload the page.",
    );
}
export async function jsonBody(request: Request, max = 30000) {
  const text = new TextDecoder().decode(await boundedBody(request, max));
  try {
    return JSON.parse(text);
  } catch {
    throw new AppError(400, "Invalid request.");
  }
}
export async function boundedBody(request: Request, max: number) {
  if (Number(request.headers.get("content-length")) > max)
    throw new AppError(413, "Request is too large.");
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > max) {
        await reader.cancel();
        throw new AppError(413, "Request is too large.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const result = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}
export async function rateLimit(key: string, limit: number, seconds = 60) {
  const hash = createHash("sha256").update(key).digest("hex");
  const { data, error } = await serviceClient().rpc("consume_rate_limit", {
    p_key: hash,
    p_limit: limit,
    p_window: seconds,
  });
  if (error) throw error;
  if (!data)
    throw new AppError(
      429,
      "Too many requests. Please wait a moment and try again.",
    );
}
