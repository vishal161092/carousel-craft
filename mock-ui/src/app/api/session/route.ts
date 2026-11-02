import { clearSession } from "@/lib/messages";

export const dynamic = "force-dynamic";

export async function DELETE(request: Request) {
  const url = new URL(request.url);
  const id = url.searchParams.get("id") || "wa-demo-session";
  clearSession(id);
  return Response.json({ ok: true });
}

export async function POST() {
  return Response.json({ ok: true });
}
