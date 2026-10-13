import { bookInput } from "@/lib/admin-validation";
import { requireOwner } from "@/lib/auth";
import { serviceClient } from "@/lib/supabase";
import { apiError, checkOrigin, jsonBody, AppError } from "@/lib/http";
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    await requireOwner();
    const { id, ...values } = bookInput.parse(await jsonBody(request));
    const db = serviceClient();
    if (id) {
      const { data: existing, error: lookup } = await db.from("books")
        .select("archived_at").eq("id", id).maybeSingle();
      if (lookup) throw lookup;
      if (!existing) throw new AppError(404, "Book not found. Refresh the admin page.");
      if (existing.archived_at) throw new AppError(409, "Restore this archived book before editing or publishing it.");
    }
    if (values.published) {
      if (!id)
        throw new AppError(
          400,
          "Save a draft and upload files before publishing.",
          { published: ["Save a draft and upload files before publishing."] },
        );
      const { data: files, error } = await db
        .from("book_formats")
        .select("id")
        .eq("book_id", id)
        .in("format", ["pdf", "epub"]);
      if (error) throw error;
      const { data: print, error: printError } = await db.from("print_editions")
        .select("book_id").eq("book_id", id).maybeSingle();
      if (printError) throw printError;
      if (!files.length && !print)
        throw new AppError(400, "Upload an ebook or add a printed edition before publishing.",
          { published: ["Upload an ebook or add a printed edition before publishing."] });
      if (files.length && values.price_paisa < 1000)
        throw new AppError(400, "Set an ebook price of at least 10 BDT before publishing.",
          { price_paisa: ["Set an ebook price of at least 10 BDT before publishing."] });
      if (!values.is_demo) {
        const { data } = await db
          .from("books")
          .select("cover_path")
          .eq("id", id)
          .single();
        if (!data?.cover_path)
          throw new AppError(
            400,
            "Upload a cover before publishing a real book.",
            { published: ["Upload a cover before publishing a real book."] },
          );
      }
    }
    const query = id
      ? db.from("books").update(values).eq("id", id)
      : db.from("books").insert(values);
    const { data, error } = await query.select("id").single();
    if (error) {
      if (error.code === "23505")
        throw new AppError(409, "This book URL is already in use.", { slug: ["This book URL is already in use."] });
      throw error;
    }
    return Response.json(data);
  } catch (e) {
    return apiError(e, "admin_book_save_failed");
  }
}
