import { requireOwner } from "@/lib/auth";
import { apiError, checkOrigin, rateLimit } from "@/lib/http";
import { runStorageCleanup } from "@/lib/storage-cleanup";

export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const owner = await requireOwner();
    await rateLimit(`storage-cleanup:${owner.id}`, 5, 60);
    return Response.json(await runStorageCleanup());
  } catch (error) { return apiError(error, "storage_cleanup_failed"); }
}
