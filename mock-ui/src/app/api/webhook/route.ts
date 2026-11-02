import { addMessage, setWebhookContext, markWebhookArrival } from "@/lib/messages";
import { ChatMessage, InteractiveContent } from "@/lib/types";

export async function POST(request: Request) {
  const url = new URL(request.url);
  const sessionId = url.searchParams.get("session") || "aster-demo-session";
  const body = await request.json();
  console.log(`[WEBHOOK] session=${sessionId} type=${body.type} interactiveType=${body?.interactive?.type} cards=${body?.interactive?.action?.cards?.length ?? 0}`);

  const msg: ChatMessage = {
    id: crypto.randomUUID(),
    direction: "incoming",
    timestamp: Date.now(),
    type: "text",
  };

  if (body.type === "interactive" && body.interactive) {
    msg.type = "interactive";
    msg.interactive = body.interactive as InteractiveContent;
    if (body.interactive.body?.text) {
      msg.text = body.interactive.body.text;
    }
    if (body.interactive.header) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (msg.interactive as any).header = body.interactive.header;
    }
  } else if (body.type === "template" && body.template) {
    msg.type = "interactive";
    msg.text = body.template.name;
    if (body.template.components) {
      const carousel = body.template.components.find(
        (c: { type: string }) => c.type === "CAROUSEL"
      );
      if (carousel && carousel.cards) {
        msg.interactive = {
          type: "carousel",
          body: { text: body.template.name },
          action: {
            cards: carousel.cards.map(
              (card: { card_index: number; components: Array<{ type: string; parameters?: Array<{ type: string; image?: { link: string }; text?: string }>; buttons?: Array<{ type: string; parameters: Array<{ type: string; url?: string; display_text?: string; payload?: string }> }> }> }, idx: number) => ({
                card_index: idx,
                header: {
                  type: "image" as const,
                  image: {
                    link:
                      card.components?.find((c: { type: string }) => c.type === "HEADER")
                        ?.parameters?.[0]?.image?.link ||
                      "https://picsum.photos/800/450",
                  },
                },
                body: {
                  text:
                    card.components
                      ?.find((c: { type: string }) => c.type === "BODY")
                      ?.parameters?.map((p: { text?: string }) => p.text)
                      .join(" ") || `Card ${idx + 1}`,
                },
                action: {
                  buttons:
                    card.components
                      ?.find((c: { type: string }) => c.type === "BUTTONS")
                      ?.buttons?.map((b: { type: string; parameters: Array<{ type: string; url?: string; display_text?: string; payload?: string }> }, i: number) => ({
                        type: "reply",
                        reply: {
                          id: `btn_${idx}_${i}`,
                          title:
                            b.parameters?.[0]?.url ||
                            b.parameters?.[0]?.payload ||
                            `Button ${i + 1}`,
                        },
                      })) || [],
                },
              })
            ),
          },
        };
      }
    }
  } else if (body.type === "text") {
    msg.type = "text";
    msg.text = body.text?.body || body.text?.preview_url || JSON.stringify(body.text);
  } else {
    msg.type = "text";
    msg.text = body.text?.body || "Message received";
  }

  // Store message content as context for the agent's next interaction
  if (msg.type === "interactive" && body.interactive?.body?.text) {
    setWebhookContext(sessionId, body.interactive.body.text);
  }

  markWebhookArrival(sessionId);
  addMessage(msg, sessionId);

  return Response.json({
    messaging_product: "whatsapp",
    contacts: [{ input: body.to, wa_id: body.to }],
    messages: [{ id: `wamid.${msg.id}` }],
  });
}
