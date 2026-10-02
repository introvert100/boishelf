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
    if (values.published) {
      if (!id)
        throw new AppError(
          400,
          "Save a draft and upload files before publishing.",
        );
      const { data: files, error } = await db
        .from("book_formats")
        .select("id")
        .eq("book_id", id);
      if (error) throw error;
      if (!files.length)
        throw new AppError(400, "Upload a PDF or EPUB before publishing.");
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
          );
      }
    }
    const query = id
      ? db.from("books").update(values).eq("id", id)
      : db.from("books").insert(values);
    const { data, error } = await query.select("id").single();
    if (error) {
      if (error.code === "23505")
        throw new AppError(409, "This book URL is already in use.");
      throw error;
    }
    return Response.json(data);
  } catch (e) {
    return apiError(e, "admin_book_save_failed");
  }
}
