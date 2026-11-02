import { openEventStream, parseMiawEvent } from "@/lib/miaw";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// SSE proxy: opens the upstream MIAW event stream (server-side, with the required
// Authorization + X-Org-Id headers the browser's EventSource can't set), distills each
// raw event into a renderable item, and re-emits it to the browser as clean SSE.
//
// Token + lastEventId are passed as query params (EventSource can't set headers). The
// token is a guest-scoped MIAW JWT, so this is acceptable.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token") || "";
  const lastEventId = url.searchParams.get("lastEventId") || "";
  if (!token) {
    return new Response("token required", { status: 400 });
  }

  let upstream: Response;
  try {
    upstream = await openEventStream(token, lastEventId);
  } catch (err) {
    console.error("[HANDOFF] stream open failed:", err);
    return new Response("upstream error", { status: 502 });
  }

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const stream = new ReadableStream({
    async start(controller) {
      const reader = upstream.body!.getReader();
      let buffer = "";

      const emit = (obj: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      };

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          // SSE events are separated by a blank line.
          let sep;
          while ((sep = buffer.indexOf("\n\n")) !== -1) {
            const block = buffer.slice(0, sep);
            buffer = buffer.slice(sep + 2);

            let eventName = "message";
            const dataLines: string[] = [];
            for (const line of block.split("\n")) {
              if (line.startsWith("event:")) eventName = line.slice(6).trim();
              else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
            }
            const dataRaw = dataLines.join("\n");
            if (eventName === "ping" || !dataRaw) continue;

            let data: Record<string, unknown>;
            try {
              data = JSON.parse(dataRaw);
            } catch {
              continue;
            }

            const parsed = parseMiawEvent(eventName, data);
            if (parsed.kind === "ignore") continue;
            emit(parsed);
          }
        }
      } catch (err) {
        console.error("[HANDOFF] stream read error:", err);
      } finally {
        try {
          controller.close();
        } catch {
          /* already closed */
        }
        reader.releaseLock();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
