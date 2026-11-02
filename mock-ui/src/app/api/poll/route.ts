import { getMessagesSince } from "@/lib/messages";
import { ChatMessage } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const sessionId = url.searchParams.get("session") || "";
  const since = parseInt(url.searchParams.get("since") || "0", 10);

  if (!sessionId) {
    return Response.json([]);
  }

  const messages = getMessagesSince(sessionId, since);
  console.log(`[POLL] session=${sessionId} since=${since} -> returned=${messages.length} types=${messages.map((m) => m.type).join(",")}`);
  // Strip internal _session field before sending to client
  const clean = messages.map((m) => {
    const { _session, ...rest } = m as ChatMessage & { _session?: string };
    void _session;
    return rest;
  });
  return Response.json(clean);
}
