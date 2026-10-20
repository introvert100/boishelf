// Isolated test application only: synthetic Supabase responses, no real account,
// credentials, email delivery, database, or payment service is contacted.
import { createHmac } from "node:crypto";
import { fixtureUser, books } from "../../../../data";
let receivingNumber: string | null = null;

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
  if (url.pathname.endsWith("/rest/v1/orders")) return Response.json([]);
  if (url.pathname.endsWith("/rest/v1/payment_settings")) return Response.json({ receiving_number: receivingNumber });
  if (url.pathname.endsWith("/rest/v1/books")) return Response.json([{...books[0], book_formats: [{format: "pdf"}]}]);
  return Response.json({error: "Unknown fixture request"}, {status: 404});
}
export async function POST(request: Request) {
  const url = new URL(request.url);
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
    receivingNumber = (await request.json()).receiving_number;
    return Response.json({ receiving_number: receivingNumber });
  }
  return Response.json({error: "Unknown fixture request"}, {status: 404});
}
