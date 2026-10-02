import { sessionClient } from "@/lib/supabase";
import { checkOrigin, apiError } from "@/lib/http";
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const client = await sessionClient();
    await client?.auth.signOut({ scope: "local" });
    return Response.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
