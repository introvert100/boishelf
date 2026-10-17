import { requireOwner } from "@/lib/auth";
import { bundleInput } from "@/lib/commerce-validation";
import { serviceClient } from "@/lib/supabase";
import { AppError, apiError, checkOrigin, jsonBody, rateLimit } from "@/lib/http";

export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const owner = await requireOwner();
    await rateLimit(`bundle-save:${owner.id}`, 20, 60);
    const data = bundleInput.parse(await jsonBody(request));
    const { data: id, error } = await serviceClient().rpc("save_bundle_v2", {
      p_id: data.id || null, p_slug: data.slug, p_kind: data.kind,
      p_title_bn: data.title_bn, p_title_en: data.title_en,
      p_description_bn: data.description_bn, p_description_en: data.description_en,
      p_price: data.price_paisa, p_published: data.published, p_members: data.members,
    });
    if (error) {
      if (error.code === "23505") throw new AppError(409, "This bundle URL is already used.");
      if (/bundle_unavailable|book_unavailable/.test(error.message))
        throw new AppError(409, "Publish the included books and add their required files or printed editions first.");
      if (error.message.includes("invalid_bundle"))
        throw new AppError(400, "Choose two to ten different books. Mixed bundles need both an ebook and a printed edition.");
      throw error;
    }
    return Response.json({ id });
  } catch (error) { return apiError(error, "bundle_save_failed"); }
}
