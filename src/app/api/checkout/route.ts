import { z } from "zod";
import { requireUser, isOwner } from "@/lib/auth";
import { serviceClient } from "@/lib/supabase";
import { readiness } from "@/lib/readiness";
import { paymentMode } from "@/lib/config";
import { initiatePayment } from "@/lib/payments";
import { isGatewayUrl } from "@/lib/security";
import {
  AppError,
  apiError,
  checkOrigin,
  jsonBody,
  rateLimit,
} from "@/lib/http";
const schema = z.object({
  bookId: z.uuid(),
  name: z.string().trim().min(2).max(80),
  phone: z.string().regex(/^(?:\+?88)?01[3-9]\d{8}$/),
  address: z.string().trim().min(3).max(160),
  city: z.string().trim().min(2).max(60),
  accepted: z.literal("on"),
});
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const user = await requireUser();
    await rateLimit(`checkout:${user.id}`, 5, 60);
    const input = schema.parse(await jsonBody(request));
    const state = await readiness(isOwner(user.email));
    if (!state.ready) throw new AppError(503, "Checkout is not available yet.");
    const db = serviceClient();
    const { data: book, error: be } = await db
      .from("books")
      .select("id,published,is_demo,archived_at,book_formats(id)")
      .eq("id", input.bookId)
      .maybeSingle();
    if (be) throw be;
    if (!book?.published || book.archived_at || !book.book_formats.length)
      throw new AppError(409, "This ebook is not available for purchase yet.");
    if (paymentMode() === "live" && book.is_demo)
      throw new AppError(
        409,
        "Sample books cannot be purchased with real money.",
      );
    const { data: order, error } = await db.rpc("create_order", {
      p_user: user.id,
      p_book: input.bookId,
      p_mode: paymentMode(),
    });
    if (error) {
      if (error.message.includes("already_owned"))
        throw new AppError(
          409,
          "You already own this book. Open My library to download it.",
        );
      throw error;
    }
    if (order.reused) {
      const { data: attempt, error: ae } = await db
        .from("payment_attempts")
        .select("gateway_url")
        .eq("order_id", order.id)
        .single();
      if (ae) throw ae;
      if (attempt.gateway_url && isGatewayUrl(attempt.gateway_url, order.mode))
        return Response.json({ url: attempt.gateway_url, orderId: order.id });
      throw new AppError(
        409,
        "A checkout is already being prepared. Check your order in My library before trying again.",
      );
    }
    try {
      const url = await initiatePayment(order, {
        ...input,
        email: user.email!,
      });
      return Response.json({ url, orderId: order.id });
    } catch (e) {
      /* Keep unknown gateway outcomes pending for reconciliation; do not charge twice. */ throw e;
    }
  } catch (e) {
    return apiError(e, "checkout_failed");
  }
}
