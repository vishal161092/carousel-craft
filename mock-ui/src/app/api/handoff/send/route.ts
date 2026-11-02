import { sendMessage } from "@/lib/miaw";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Sends a customer message into the live-agent (MIAW) conversation.
export async function POST(request: Request) {
  try {
    const { conversationId, token, text } = await request.json();
    if (!conversationId || !token || !text) {
      return Response.json({ error: "conversationId, token and text are required" }, { status: 400 });
    }
    await sendMessage(token, conversationId, text, crypto.randomUUID());
    return Response.json({ ok: true });
  } catch (err) {
    console.error("[HANDOFF] send failed:", err);
    return Response.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 502 }
    );
  }
}
