import { NextResponse } from "next/server";
import { processNotification } from "@/lib/payments";
import { appUrl } from "@/lib/config";
import { boundedBody, logEvent } from "@/lib/http";
import { serviceClient } from "@/lib/supabase";
async function handle(request: Request) {
  let values: Record<string, string> = {};
  try {
    values =
      request.method === "POST"
        ? Object.fromEntries(
            new URLSearchParams(
              new TextDecoder().decode(await boundedBody(request, 20000)),
            ),
          )
        : Object.fromEntries(new URL(request.url).searchParams);
    const id = await processNotification(values);
    return NextResponse.redirect(new URL(`/orders/${id}`, appUrl()), 303);
  } catch {
    logEvent("payment_return_unconfirmed");
    if (values.tran_id && values.tran_id.length <= 40) {
      try {
        const { data } = await serviceClient()
          .from("orders")
          .select("id")
          .eq("tran_id", values.tran_id)
          .maybeSingle();
        if (data)
          return NextResponse.redirect(
            new URL(`/orders/${data.id}`, appUrl()),
            303,
          );
      } catch {
        /* The library offers authenticated reconciliation. */
      }
    }
    return NextResponse.redirect(new URL("/library", appUrl()), 303);
  }
}
export const POST = handle;
export const GET = handle;
