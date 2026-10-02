import { timingSafeEqual } from "node:crypto";
import { serviceClient } from "@/lib/supabase";
import { hasSupabase } from "@/lib/config";
import { logEvent } from "@/lib/http";
export async function GET(request: Request) {
  const expected = process.env.MONITOR_TOKEN || "";
  const supplied =
    request.headers.get("authorization")?.replace(/^Bearer /, "") || "";
  if (
    !expected ||
    Buffer.byteLength(supplied) !== Buffer.byteLength(expected) ||
    !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))
  )
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    if (!hasSupabase()) throw new Error("Unconfigured");
    const db = serviceClient();
    const [{ error }, { data: buckets, error: s }] = await Promise.all([
      db.from("books").select("id").limit(1),
      db.storage.listBuckets(),
    ]);
    if (
      error ||
      s ||
      !["ebooks", "covers"].every((id) =>
        buckets?.some((b) => b.id === id && !b.public),
      )
    )
      throw new Error("Dependency failure");
    return Response.json(
      { status: "ready", database: true, storage: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    logEvent("readiness_failed");
    return Response.json({ status: "unavailable" }, { status: 503 });
  }
}
