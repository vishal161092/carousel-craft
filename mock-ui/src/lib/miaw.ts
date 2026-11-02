// Messaging for In-App & Web (MIAW) custom-client helper — the "live human agent" bridge.
//
// Flow (all verified live against Custom_ASA_WA):
//   1. POST .../authorization/unauthenticated/access-token  -> { accessToken, lastEventId }
//   2. GET  .../eventrouter/v1/sse                            -> live event stream (bot/agent msgs, routing, owner changes)
//   3. POST .../conversation                                 -> create conversation (201)
//   4. POST .../conversation/{id}/message                    -> send a customer message (202)
//
// NOTE: the SSE `X-Org-Id` header MUST be the 15-char org id and match the token's orgId,
// or the stream 400s ("OrgId in the header and token must match").

export const MIAW_SCRT2_URL = process.env.MIAW_SCRT2_URL || "";
export const MIAW_ORG_ID = process.env.MIAW_ORG_ID || "";
export const MIAW_ES_DEVELOPER_NAME = process.env.MIAW_ES_DEVELOPER_NAME || "";

const API_BASE = () => `${MIAW_SCRT2_URL}/iamessage/api/v2`;

export interface MiawToken {
  accessToken: string;
  lastEventId: string;
}

export function miawConfigured(): boolean {
  return Boolean(MIAW_SCRT2_URL && MIAW_ORG_ID && MIAW_ES_DEVELOPER_NAME);
}

export async function getUnauthToken(): Promise<MiawToken> {
  const res = await fetch(`${API_BASE()}/authorization/unauthenticated/access-token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      orgId: MIAW_ORG_ID,
      esDeveloperName: MIAW_ES_DEVELOPER_NAME,
      capabilitiesVersion: "1",
      platform: "Web",
    }),
  });
  if (!res.ok) {
    throw new Error(`MIAW token failed (${res.status}): ${await res.text()}`);
  }
  const data = await res.json();
  return { accessToken: data.accessToken, lastEventId: String(data.lastEventId ?? "") };
}

export async function createConversation(token: string, conversationId: string): Promise<void> {
  // The MIAW conversation service returns a transient 503 ("Service Unavailable") for the
  // first few requests after a deployment is (re)provisioned, then starts serving 201. Retry
  // a few times with a short, flat backoff so a cold deployment doesn't surface as a failed
  // handoff — while staying well inside the serverless function timeout (avoids a 504).
  const MAX_ATTEMPTS = 4;
  const RETRY_DELAY_MS = 700;
  let lastStatus = 0;
  let lastBody = "";
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const res = await fetch(`${API_BASE()}/conversation`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId, esDeveloperName: MIAW_ES_DEVELOPER_NAME }),
    });
    // 201 created; 200/409 (already exists) are also fine to proceed.
    if (res.ok || res.status === 409) return;
    lastStatus = res.status;
    lastBody = await res.text();
    // Only retry the transient availability error; fail fast on anything else (auth, bad req).
    if (res.status !== 503 || attempt === MAX_ATTEMPTS) break;
    await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
  }
  throw new Error(`MIAW create conversation failed (${lastStatus}): ${lastBody}`);
}

export async function sendMessage(
  token: string,
  conversationId: string,
  text: string,
  messageId: string
): Promise<void> {
  const res = await fetch(`${API_BASE()}/conversation/${conversationId}/message`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      message: {
        id: messageId,
        messageType: "StaticContentMessage",
        staticContent: { formatType: "Text", text },
      },
      esDeveloperName: MIAW_ES_DEVELOPER_NAME,
    }),
  });
  if (!res.ok) {
    throw new Error(`MIAW send message failed (${res.status}): ${await res.text()}`);
  }
}

// Opens the upstream SSE stream. Caller is responsible for reading/piping the body.
export async function openEventStream(token: string, lastEventId: string): Promise<Response> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "X-Org-Id": MIAW_ORG_ID,
    Accept: "text/event-stream",
  };
  if (lastEventId) headers["Last-Event-Id"] = lastEventId;
  const res = await fetch(`${MIAW_SCRT2_URL}/eventrouter/v1/sse`, { headers });
  if (!res.ok || !res.body) {
    throw new Error(`MIAW SSE failed (${res.status}): ${await res.text().catch(() => "")}`);
  }
  return res;
}

// ---- Event parsing: distills raw MIAW SSE events into things the PWA can render. ----

export type MiawParsed =
  | { kind: "agentMessage"; text: string; senderName: string; entryId: string }
  | { kind: "status"; text: string; entryId: string }
  | { kind: "typing"; on: boolean }
  | { kind: "ignore" };

// Given a parsed SSE `event` name and its JSON `data`, return a renderable item.
// `ownEndUserSubject` lets us skip echoes of the customer's own messages.
export function parseMiawEvent(
  eventName: string,
  data: Record<string, unknown>,
  ownEndUserSubject?: string
): MiawParsed {
  const entry = (data?.conversationEntry ?? {}) as Record<string, unknown>;
  const entryId = String(entry.identifier ?? "");
  let payload: Record<string, unknown> = {};
  try {
    payload = typeof entry.entryPayload === "string" ? JSON.parse(entry.entryPayload) : {};
  } catch {
    payload = {};
  }
  const sender = (entry.sender ?? {}) as Record<string, unknown>;
  const senderRole = String(sender.role ?? "");
  const senderName = String(entry.senderDisplayName ?? "Aster Specialist");

  switch (eventName) {
    case "CONVERSATION_MESSAGE": {
      // Skip the customer's own message echo.
      if (senderRole === "EndUser" && sender.subject === ownEndUserSubject) {
        return { kind: "ignore" };
      }
      if (senderRole === "EndUser") return { kind: "ignore" };
      const am = (payload.abstractMessage ?? {}) as Record<string, unknown>;
      const sc = (am.staticContent ?? {}) as Record<string, unknown>;
      const text = String(sc.text ?? "");
      if (!text) return { kind: "ignore" };
      return { kind: "agentMessage", text, senderName, entryId };
    }
    case "CONVERSATION_ROUTING_RESULT": {
      const rc = (payload.routingConfigurationDetails ?? {}) as Record<string, unknown>;
      if (rc.routingConfigurationType) {
        return { kind: "status", text: "Connecting you to our corporate gifting manager…", entryId };
      }
      return { kind: "ignore" };
    }
    case "CONVERSATION_SESSION_OWNER_CHANGED": {
      const newOwner = String(payload.newOwnerType ?? "");
      if (newOwner === "Agent") {
        return { kind: "status", text: "A Aster specialist has joined the chat 🧑‍💼", entryId };
      }
      if (newOwner === "Queue") {
        return { kind: "status", text: "You're in the queue — a specialist will be with you shortly…", entryId };
      }
      return { kind: "ignore" };
    }
    case "CONVERSATION_TYPING_STARTED_INDICATOR":
      return { kind: "typing", on: true };
    case "CONVERSATION_TYPING_STOPPED_INDICATOR":
      return { kind: "typing", on: false };
    default:
      return { kind: "ignore" };
  }
}
