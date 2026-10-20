import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { paymentSettings } from "@/lib/payment-settings";
import { serviceClient } from "@/lib/supabase";
import { readiness } from "@/lib/readiness";
import { AppError, apiError, checkOrigin, jsonBody, rateLimit } from "@/lib/http";

const schema = z.object({ bookId: z.uuid(), accepted: z.literal(true) });

export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const user = await requireUser();
    await rateLimit(`checkout:${user.id}`, 5, 60);
    const input = schema.parse(await jsonBody(request));
    if (!(await readiness()).ready) throw new AppError(503, "bKash checkout is not available yet.");
    const { receivingNumber: number } = await paymentSettings();
    if (!number) throw new AppError(503, "bKash receiving number is not configured.");
    const { data: order, error } = await serviceClient().rpc("create_manual_order", {
      p_user: user.id, p_book: input.bookId, p_number: number,
    });
    if (error) {
      if (error.message.includes("already_owned"))
        throw new AppError(409, "You already own this book. Open My library to download it.");
      if (error.message.includes("book_unavailable"))
        throw new AppError(409, "This ebook is not available for purchase yet.");
      throw error;
    }
    return Response.json({ orderId: order.id }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return apiError(error, "checkout_failed");
  }
}
