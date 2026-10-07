import "server-only";
import { logEvent } from "./http";
import { serviceClient } from "./supabase";

export async function queueStorageCleanup(bookId: string, objects: { bucket: "ebooks" | "covers"; path: string | null }[]) {
  try {
    const rows = objects.filter((item): item is { bucket: "ebooks" | "covers"; path: string } => !!item.path)
      .map((item) => ({ book_id: bookId, bucket: item.bucket, object_path: item.path }));
    if (!rows.length) return;
    const { error } = await serviceClient().from("storage_cleanup_jobs")
      .upsert(rows, { onConflict: "bucket,object_path", ignoreDuplicates: true });
    if (error) { logEvent("storage_cleanup_queue_failed", { bookId }); return; }
    await runStorageCleanup(bookId);
  } catch { logEvent("storage_cleanup_run_failed", { bookId }); }
}

export async function runStorageCleanup(bookId?: string) {
  const db = serviceClient();
  let query = db.from("storage_cleanup_jobs")
    .select("id,bucket,object_path").is("done_at", null).order("id").limit(100);
  if (bookId) query = query.eq("book_id", bookId);
  const { data: jobs, error } = await query;
  if (error) throw error;
  let failed = 0;
  for (const job of jobs) {
    const { error: removeError } = await db.storage.from(job.bucket).remove([job.object_path]);
    if (removeError) { failed++; logEvent("storage_cleanup_failed", { jobId: job.id }); continue; }
    const { error: updateError } = await db.from("storage_cleanup_jobs")
      .update({ done_at: new Date().toISOString() }).eq("id", job.id);
    if (updateError) { failed++; logEvent("storage_cleanup_mark_failed", { jobId: job.id }); }
  }
  let remainingQuery = db.from("storage_cleanup_jobs")
    .select("id", { count: "exact", head: true }).is("done_at", null);
  if (bookId) remainingQuery = remainingQuery.eq("book_id", bookId);
  const { count, error: countError } = await remainingQuery;
  if (countError) throw countError;
  return { processed: jobs.length, failed, remaining: count || 0 };
}
