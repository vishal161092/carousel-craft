import { ChatMessage, InteractiveContent } from "@/lib/types";
import { consumeWebhookContext, getLastWebhookTime, setWebhookContext } from "@/lib/messages";
import { CARD_BY_KEY, CARD_TAG_RE, PAYMENT_KEY, resolveCard } from "@/lib/catalog";

const SF_INSTANCE_URL = process.env.SF_INSTANCE_URL || "";
const SF_CLIENT_ID = process.env.SF_CLIENT_ID || "";
const SF_CLIENT_SECRET = process.env.SF_CLIENT_SECRET || "";
const SF_AGENT_ID = process.env.SF_AGENT_ID || "";

const AGENT_API_BASE = "https://api.salesforce.com/einstein/ai-agent/v1";

// The Agent API redacts URLs in returned text — the secure payment link comes back as the
// literal token "URL_Redacted". We substitute the real (demo) checkout link back in before
// posting the message to the PWA. (Product/designer URLs live inside the rich cards, which
// are rendered client-side from the catalog, so they are never affected.)
const PAYMENT_LINK = "https://pay.asteroak.example/checkout/ao-8932";
const REDACTED_URL_TOKEN = "URL_Redacted";

// The published agent emits a `..._Payment` routing tag at checkout, but payment is TEXT
// (the secure link), not a card. When resolveCard flags PAYMENT_KEY we render this fixed copy.
const PAYMENT_TEXT = `Perfect. Your total is ₹349 (Free Shipping applied!). Please complete your payment securely using the link below:\n🔗 ${PAYMENT_LINK}`;

// The agent is non-deterministic at checkout: sometimes it emits the full payment copy,
// sometimes just the bare link, sometimes the redacted token. Any reply that references the
// checkout URL is the payment step, so we normalize it to the canonical PAYMENT_TEXT above
// (full lead-in copy + clickable link).
const PAYMENT_LINK_RE = /checkout\/aster-8932/i;

// Detect when the conversation should hand off to a live human agent — the customer asks
// for a person, OR the bot announces/offers the transfer (Step 9 "Speak to Agent", Step 10
// corporate/bulk order). When true the client opens the MIAW bridge (SDO_Messaging_for_Web)
// to a real Omni-Channel specialist.
const USER_WANTS_HUMAN_NOUN =
  /\b(human|real person|live (agent|person|rep|representative|specialist)|customer (care|service)|a representative)\b/i;
const USER_WANTS_HUMAN_VERB =
  /\b(speak|talk|chat|connect|transfer|escalate|route|reach|get|put me through|hand(?:ed)?)\b[^.?!\n]{0,40}?\b(agent|human|person|someone|somebody|specialist|representative|rep|your team|manager|concierge|advisor|expert)\b/i;
const USER_WANTS_CORPORATE =
  /\b(corporate|bulk|wholesale|business)\b[^.?!\n]{0,30}?\b(order|gift|gifting|purchase|quantity|quote)\b|\b(corporate|bulk)\s+(order|gift|gifting)\b/i;
const BOT_OFFERS_HUMAN =
  /(transferring (you|chat)|connect(?:ing)? you (to|with)|hand you (over|off)|corporate gifting manager|our (specialized|human|corporate) (team|manager|specialist)|a (live|human) (agent|specialist|manager))/i;

function detectHandoff(userText: string, botText: string): boolean {
  return (
    USER_WANTS_HUMAN_NOUN.test(userText) ||
    USER_WANTS_HUMAN_VERB.test(userText) ||
    USER_WANTS_CORPORATE.test(userText) ||
    BOT_OFFERS_HUMAN.test(botText)
  );
}

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.value;
  }

  const response = await fetch(`${SF_INSTANCE_URL}/services/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: SF_CLIENT_ID,
      client_secret: SF_CLIENT_SECRET,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OAuth failed (${response.status}): ${err}`);
  }

  const data = await response.json();
  cachedToken = {
    value: data.access_token,
    expiresAt: Date.now() + 55 * 60 * 1000,
  };
  return data.access_token;
}

async function createAgentSession(token: string): Promise<string> {
  const response = await fetch(`${AGENT_API_BASE}/agents/${SF_AGENT_ID}/sessions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      externalSessionKey: crypto.randomUUID(),
      instanceConfig: { endpoint: SF_INSTANCE_URL },
      streamingCapabilities: { chunkTypes: ["Text"] },
      bypassUser: true,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Session creation failed (${response.status}): ${err}`);
  }

  const data = await response.json();
  return data.sessionId;
}

interface AgentMessage {
  type?: string;
  message?: string;
  text?: string;
}

interface AgentResponse {
  messages?: AgentMessage[];
}

interface AgentResult {
  text: string;
  invokedAction: boolean;
}

async function sendAgentMessage(token: string, sessionId: string, message: string): Promise<AgentResult> {
  const response = await fetch(`${AGENT_API_BASE}/sessions/${sessionId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: {
        sequenceId: Date.now(),
        type: "Text",
        text: message,
      },
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Agent message failed (${response.status}): ${err}`);
  }

  const data: AgentResponse = await response.json();
  console.log(`[CHAT] agent messages types=[${(data.messages || []).map((m) => m.type).join(", ")}]`);

  const invokedAction =
    data.messages?.some(
      (m) => m.type === "InvokeAction" || m.type === "ActionResult" || m.type === "Action"
    ) || false;

  const textMessages = data.messages
    ?.filter((m) => m.type === "Text" || m.type === "Inform")
    ?.map((m) => m.message || m.text)
    .filter(Boolean);

  return { text: textMessages?.join("\n") || "Message received.", invokedAction };
}

const sessionCache = new Map<string, string>();

// Per-session log of everything the customer has said. The agent's planner is a
// variable-gated state machine whose capture/setVariables action lags by a turn and can
// silently drop values — when a slot reads empty the planner can fall back and re-ask. As a
// client-side guard we replay the customer's own prior messages into each turn with a firm
// "do not re-ask" directive, so the model has the answers in front of it even if its
// variables are stale.
const userInputLog = new Map<string, string[]>();

function buildMemoryBlock(sid: string): string {
  const prior = userInputLog.get(sid);
  if (!prior || prior.length === 0) return "";
  return (
    "[CONVERSATION MEMORY — the customer has ALREADY told you the following earlier in this chat, in order. Do NOT ask for any detail already answered here; treat it as known, never restart the journey, and always move FORWARD:\n- " +
    prior.join("\n- ") +
    "\n]"
  );
}

async function callAgentforce(
  userMessage: string,
  clientSessionId: string,
  providedAgentSessionId?: string | null
): Promise<AgentResult & { agentSessionId?: string }> {
  if (!SF_INSTANCE_URL || !SF_CLIENT_ID || !SF_CLIENT_SECRET || !SF_AGENT_ID) {
    return { text: `[Agentforce not configured] You said: "${userMessage}". Set env vars.`, invokedAction: false };
  }

  let accessToken: string;
  try {
    accessToken = await getAccessToken();
  } catch (err) {
    return { text: `[OAuth error] ${err instanceof Error ? err.message : err}`, invokedAction: false };
  }

  // The BROWSER owns the Agent API session for the lifetime of its page load: it sends back
  // the agentSessionId we returned on the previous turn, so the conversation survives even
  // when a different, cold serverless instance handles this request. On page refresh the
  // client sends no id, so we mint a fresh session and the journey starts clean.
  let agentSessionId = providedAgentSessionId || sessionCache.get(clientSessionId);
  if (!agentSessionId) {
    try {
      agentSessionId = await createAgentSession(accessToken);
    } catch (err) {
      return { text: `[Session error] ${err instanceof Error ? err.message : err}`, invokedAction: false };
    }
  }
  sessionCache.set(clientSessionId, agentSessionId);

  try {
    const r = await sendAgentMessage(accessToken, agentSessionId, userMessage);
    return { ...r, agentSessionId };
  } catch (err) {
    if (err instanceof Error && err.message.includes("404")) {
      sessionCache.delete(clientSessionId);
      try {
        agentSessionId = await createAgentSession(accessToken);
        sessionCache.set(clientSessionId, agentSessionId);
        const r = await sendAgentMessage(accessToken, agentSessionId, userMessage);
        return { ...r, agentSessionId };
      } catch (retryErr) {
        return { text: `[Session expired, retry failed] ${retryErr instanceof Error ? retryErr.message : retryErr}`, invokedAction: false };
      }
    }
    return { text: `[Message error] ${err instanceof Error ? err.message : err}`, invokedAction: false };
  }
}

// Pull the first `[[ASTER_CARD:<key>]]` tag out of the agent/action output and resolve it to
// a catalog card. Returns the card plus the text with the tag stripped.
function extractCard(text: string): { card: InteractiveContent | null; key: string; cleaned: string; hadTag: boolean } {
  const m = text.match(CARD_TAG_RE);
  if (!m) return { card: null, key: "", cleaned: text, hadTag: false };
  const { key, card } = resolveCard(m[1]);
  const cleaned = text.replace(CARD_TAG_RE, "").trim();
  return { card, key, cleaned, hadTag: true };
}

function cardBodyText(card: InteractiveContent): string {
  return card.body?.text || "";
}

export async function POST(request: Request) {
  const body = await request.json();
  const { text, sessionId, agentSessionId: clientAgentSessionId } = body;
  const sid = sessionId || crypto.randomUUID();

  const userMsg: ChatMessage = {
    id: crypto.randomUUID(),
    direction: "outgoing",
    timestamp: Date.now(),
    type: "text",
    text,
  };

  // Anti-loop guard: replay prior customer messages as memory before recording this one.
  const memoryBlock = buildMemoryBlock(sid);
  if (typeof text === "string" && text.trim()) {
    const log = userInputLog.get(sid) || [];
    log.push(text.trim());
    userInputLog.set(sid, log);
  }

  // Inject any webhook/card message content as context for the agent's next interaction.
  const webhookCtx = consumeWebhookContext(sid);
  const contextParts = [
    memoryBlock,
    webhookCtx
      ? `[Context: The following message was just displayed to the user via WhatsApp:\n${webhookCtx}]`
      : "",
    `User says: ${text}`,
  ].filter(Boolean);
  const agentInput = memoryBlock || webhookCtx ? contextParts.join("\n\n") : text;

  const beforeCall = Date.now();
  const result = await callAgentforce(agentInput, sid, clientAgentSessionId);
  const agentSessionId = result.agentSessionId;

  // Restore the payment link the Agent API stripped out (surfaces as "URL_Redacted").
  if (result.text.includes(REDACTED_URL_TOKEN)) {
    result.text = result.text.split(REDACTED_URL_TOKEN).join(PAYMENT_LINK);
    console.log("[CHAT] restored redacted payment link");
  }

  // Normalize the checkout step: whatever the agent returned (bare link, partial copy, etc.),
  // render the full canonical payment message so the customer always sees the lead-in text +
  // the clickable secure link. Scoped to replies that reference the checkout URL.
  if (PAYMENT_LINK_RE.test(result.text)) {
    result.text = PAYMENT_TEXT;
    console.log("[CHAT] payment link detected -> rendering canonical payment text");
  }

  // RICH CARD: the agent invoked an action that returned a `[[ASTER_CARD:<key>]]` tag. Render
  // the matching catalog card INLINE (reliable, same-instance) and strip the tag. The card
  // body carries the journey copy, so we suppress the agent's surrounding narration.
  const { card, key, cleaned, hadTag } = extractCard(result.text);
  let renderCard = card;
  let renderKey = key;

  // Step-3 safety net: the published agent is non-deterministic and sometimes re-emits the
  // product-DETAIL tag when the customer explicitly asked to "show more products like this".
  // That request now opens the skin-type question, so if we got a detail card back for that
  // intent, override it to the skin_type card. Scoped to detail cards only, so it never
  // affects the buy/address/payment/confirmation/tracking turns.
  const WANTS_RECOMMENDATIONS =
    /\b(more products like this|more like this|show me more|similar products|other products|recommend)\b/i;
  if (hadTag && renderKey.startsWith("detail_") && WANTS_RECOMMENDATIONS.test(text || "")) {
    renderCard = CARD_BY_KEY["skin_type"];
    renderKey = "skin_type";
    console.log("[CHAT] show-more intent override: detail card -> skin_type question");
  }

  // Payment sentinel: the agent tagged the checkout step. Render the fixed payment text
  // (total + secure link) instead of a card or an empty bubble.
  if (!renderCard && renderKey === PAYMENT_KEY) {
    setWebhookContext(sid, PAYMENT_TEXT);
    const payMsg: ChatMessage = {
      id: crypto.randomUUID(),
      direction: "incoming",
      timestamp: Date.now(),
      type: "text",
      text: PAYMENT_TEXT,
    };
    console.log("[CHAT] payment tag detected -> rendering fixed payment text");
    return Response.json({ userMsg, replyMsg: payMsg, agentSessionId });
  }

  if (renderCard) {
    setWebhookContext(sid, cardBodyText(renderCard));
    const cardMsg: ChatMessage = {
      id: crypto.randomUUID(),
      direction: "incoming",
      timestamp: Date.now(),
      type: "interactive",
      text: cardBodyText(renderCard),
      interactive: renderCard,
    };
    console.log(`[CHAT] card tag detected key=${renderKey} -> delivering inline`);
    // A card can still coincide with a handoff cue (e.g. Step 9 exchange card where the
    // customer may next tap "Speak to Agent") — but we only trigger handoff on explicit
    // text, so a card turn never auto-escalates. Return the card.
    return Response.json({ userMsg, replyMsg: cardMsg, agentSessionId });
  }

  result.text = cleaned;

  // Guard: the agent emitted a routing tag we couldn't resolve to a card/payment and there is
  // no other text — suppress the bubble rather than show an empty one. (key is logged for
  // tuning the resolver.)
  if (hadTag && !renderCard && !cleaned.trim()) {
    console.log(`[CHAT] unresolved card tag key="${renderKey}" with empty text -> suppressing bubble`);
    return Response.json({ userMsg, replyMsg: null, agentSessionId });
  }

  // Suppress agent narration if a webhook message arrived during this agent call.
  const webhookArrivedDuringCall = getLastWebhookTime(sid) >= beforeCall;
  if (webhookArrivedDuringCall) {
    return Response.json({ userMsg, replyMsg: null, agentSessionId });
  }

  const replyMsg: ChatMessage = {
    id: crypto.randomUUID(),
    direction: "incoming",
    timestamp: Date.now(),
    type: "text",
    text: result.text,
  };

  const handoff = detectHandoff(text, result.text);
  if (handoff) {
    console.log("[CHAT] human handoff detected -> client will open MIAW bridge");
  }

  return Response.json({ userMsg, replyMsg, handoff, agentSessionId });
}
