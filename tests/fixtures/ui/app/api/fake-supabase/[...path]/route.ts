// Isolated test application only: synthetic Supabase responses, no real account,
// credentials, email delivery, database, or payment service is contacted.
import { createHmac } from "node:crypto";
import { fixtureUser, books } from "../../../../data";
let receivingNumber: string | null = null;
let checkout = {bkash_enabled:false,cod_enabled:false,business_confirmed:false,courier_confirmed:false};
let delivery = [{district:"Dhaka",fee_paisa:5000}];

export async function GET(request: Request) {
  const url = new URL(request.url);
  if (url.pathname.endsWith("/auth/v1/user")) {
    const payload = request.headers.get("authorization")?.split(".")[1];
    const email = payload ? JSON.parse(Buffer.from(payload, "base64url").toString()).email : fixtureUser.email;
    return Response.json({ ...fixtureUser, email });
  }
  if (url.pathname.endsWith("/rest/v1/entitlements")) {
    if (url.searchParams.has("order_kind")) return Response.json({ code: "42703", message: "column entitlements.order_kind does not exist" }, {status: 400});
    return Response.json([{book_id: books[0].id}]);
  }
  if (url.pathname.endsWith("/rest/v1/delivery_districts")) return Response.json(delivery);
  if (url.pathname.endsWith("/rest/v1/policies")) return Response.json(["privacy","terms","refund","copyright","shipping"].map((slug)=>({slug,body_bn:"নীতিমালা",body_en:"Published policy"})));
  if (url.pathname.endsWith("/rest/v1/print_editions")) return Response.json([{book_id:books[1].id,on_hand:3,reserved:0,books:{published:true,is_demo:false,archived_at:null}}]);
  if (url.pathname.endsWith("/rest/v1/orders")) return Response.json([]);
  if (url.pathname.endsWith("/rest/v1/payment_settings")) return Response.json({ receiving_number: receivingNumber, ...checkout });
  if (url.pathname.endsWith("/rest/v1/books")) return Response.json([{...books[0], book_formats: [{format: "pdf"}]}]);
  return Response.json({error: "Unknown fixture request"}, {status: 404});
}
export async function POST(request: Request) {
  const url = new URL(request.url);
  if (url.pathname.endsWith("/rest/v1/rpc/save_delivery_districts")) {
    delivery=(await request.json()).p_districts; return Response.json(null);
  }
  if (url.pathname.endsWith("/rest/v1/rpc/consume_rate_limit")) return Response.json(true);
  if (url.pathname.endsWith("/auth/v1/otp")) return Response.json({});
  if (url.pathname.endsWith("/auth/v1/verify")) {
    const body = await request.json();
    if (body.token !== "12345678" || body.type !== "email") return Response.json({msg: "Invalid fixture code"}, {status: 403});
    const user = { ...fixtureUser, email: body.email };
    const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
    const unsigned = encode({alg: "HS256", typ: "JWT"}) + "." + encode({
      sub: user.id, email: user.email, role: "authenticated", aud: "authenticated",
      amr: [{method: "otp"}], iat: Math.floor(Date.now()/1000), exp: Math.floor(Date.now()/1000)+3600,
    });
    const token = unsigned + "." + createHmac("sha256", "isolated-fixture-only").update(unsigned).digest("base64url");
    return Response.json({access_token: token, refresh_token: "fixture-refresh", expires_in: 3600, token_type: "bearer", user});
  }
  return Response.json({error: "Unknown fixture request"}, {status: 404});
}

export async function PATCH(request: Request) {
  if (new URL(request.url).pathname.endsWith("/rest/v1/payment_settings")) {
    const body=await request.json();
    if ("receiving_number" in body) receivingNumber=body.receiving_number;
    if ("bkash_enabled" in body) checkout={bkash_enabled:body.bkash_enabled,cod_enabled:body.cod_enabled,
      business_confirmed:body.business_confirmed,courier_confirmed:body.courier_confirmed};
    return Response.json({ receiving_number: receivingNumber, ...checkout });
  }
  return Response.json({error: "Unknown fixture request"}, {status: 404});
}
