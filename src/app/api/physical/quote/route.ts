import { requireUser } from "@/lib/auth";
import { quotePhysicalCart } from "@/lib/commerce";
import { AppError, apiError, checkOrigin, jsonBody, rateLimit } from "@/lib/http";
import { z } from "zod";

const input = z.object({ lines: z.unknown(), district: z.string() });
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const user = await requireUser();
    await rateLimit(`physical-quote:${user.id}`, 20, 60);
    const data = input.parse(await jsonBody(request));
    const quote = await quotePhysicalCart(data.lines, data.district);
    return Response.json(quote, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return apiError(error instanceof Error ? error : new AppError(400, "Could not price this cart."), "physical_quote_failed");
  }
}
