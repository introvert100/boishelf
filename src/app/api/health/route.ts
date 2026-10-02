export async function GET() {
  return Response.json(
    { status: "ok", service: "boishelf" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
