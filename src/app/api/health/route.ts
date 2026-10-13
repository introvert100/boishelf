export async function GET() {
  return Response.json(
    { status: "ok", service: "read-and-rich" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
