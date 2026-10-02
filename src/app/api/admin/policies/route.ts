import { requireOwner } from "@/lib/auth";
import { serviceClient } from "@/lib/supabase";
import { apiError, checkOrigin, jsonBody } from "@/lib/http";
import { policyInput } from "@/lib/admin-validation";
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    await requireOwner();
    const policy = policyInput.parse(await jsonBody(request, 120000));
    const { error } = await serviceClient()
      .from("policies")
      .upsert({ ...policy, updated_at: new Date().toISOString() });
    if (error) throw error;
    return Response.json({ ok: true });
  } catch (e) {
    return apiError(e, "policy_save_failed");
  }
}
