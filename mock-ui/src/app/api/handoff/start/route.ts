import { createConversation, getUnauthToken, miawConfigured } from "@/lib/miaw";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// Headroom for the MIAW token + create-conversation calls (incl. the transient-503 retries),
// so a slow cold start resolves instead of hitting the gateway timeout (504).
export const maxDuration = 30;

// Starts a live-agent (MIAW) conversation and hands the guest token back to the client.
// The token is an unauthenticated guest JWT scoped to this one conversation — the same
// thing a browser MIAW SDK would hold — so it's safe to return and pass back through our
// proxy on subsequent /send and /stream calls (keeps us stateless across serverless instances).
export async function POST() {
  if (!miawConfigured()) {
    return Response.json({ error: "MIAW not configured" }, { status: 500 });
  }
  try {
    const { accessToken, lastEventId } = await getUnauthToken();
    const conversationId = crypto.randomUUID();
    await createConversation(accessToken, conversationId);
    console.log(`[HANDOFF] started conversation=${conversationId} lastEventId=${lastEventId}`);
    return Response.json({ conversationId, token: accessToken, lastEventId });
  } catch (err) {
    console.error("[HANDOFF] start failed:", err);
    return Response.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 502 }
    );
  }
}
