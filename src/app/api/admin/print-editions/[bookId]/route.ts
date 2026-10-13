import { z } from "zod";
import { requireOwner } from "@/lib/auth";
import { serviceClient } from "@/lib/supabase";
import { AppError, apiError, checkOrigin, jsonBody, rateLimit } from "@/lib/http";

const input = z.object({ pricePaisa: z.number().int().min(1000).max(10000000),
  onHand: z.number().int().min(0).max(100000), reason: z.string().trim().min(3).max(300) });
export async function POST(request: Request, { params }: { params: Promise<{ bookId: string }> }) {
  try {
    checkOrigin(request);
    const owner = await requireOwner();
    await rateLimit(`print-edition:${owner.id}`, 30, 60);
    const bookId = z.uuid().parse((await params).bookId);
    const data = input.parse(await jsonBody(request));
    const { error } = await serviceClient().rpc("save_print_edition", {
      p_book: bookId, p_actor: owner.id, p_price: data.pricePaisa,
      p_on_hand: data.onHand, p_note: data.reason,
    });
    if (error) {
      if (error.message.includes("below_reserved"))
        throw new AppError(409, "Stock cannot be lower than copies reserved by existing orders.");
      if (error.message.includes("book_unavailable"))
        throw new AppError(404, "Save or restore the book before editing its printed edition.");
      throw error;
    }
    return Response.json({ ok: true });
  } catch (error) { return apiError(error, "print_edition_save_failed"); }
}
