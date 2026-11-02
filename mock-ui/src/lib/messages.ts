import { ChatMessage } from "./types";

// Global message store - persists within the same serverless instance
const messageStore: (ChatMessage & { _session?: string })[] = [];

export function getMessages(sessionId?: string): ChatMessage[] {
  if (!sessionId) return [];
  return messageStore.filter((m) => m._session === sessionId);
}

export function addMessage(msg: ChatMessage, sessionId?: string): void {
  const stored = msg as ChatMessage & { _session?: string };
  stored._session = sessionId || "__default__";
  messageStore.push(stored);
  if (messageStore.length > 200) {
    messageStore.splice(0, messageStore.length - 200);
  }
}

export function getMessagesSince(sessionId: string, since: number): ChatMessage[] {
  return messageStore.filter(
    (m) => m._session === sessionId && m.timestamp > since
  );
}

export function clearSession(sessionId: string): void {
  for (let i = messageStore.length - 1; i >= 0; i--) {
    if (messageStore[i]._session === sessionId) {
      messageStore.splice(i, 1);
    }
  }
  webhookContext.delete(sessionId);
}

// Stores the last webhook message content so the agent can reference it in followups
const webhookContext = new Map<string, string>();

export function setWebhookContext(sessionId: string, context: string): void {
  const existing = webhookContext.get(sessionId) || "";
  webhookContext.set(sessionId, existing ? existing + "\n" + context : context);
}

export function consumeWebhookContext(sessionId: string): string | null {
  const ctx = webhookContext.get(sessionId) || null;
  if (ctx) webhookContext.delete(sessionId);
  return ctx;
}

// Tracks the last webhook arrival time per session
const lastWebhookTime = new Map<string, number>();

export function markWebhookArrival(sessionId: string): void {
  lastWebhookTime.set(sessionId, Date.now());
}

export function getLastWebhookTime(sessionId: string): number {
  return lastWebhookTime.get(sessionId) || 0;
}
