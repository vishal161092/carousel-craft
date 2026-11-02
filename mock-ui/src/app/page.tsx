"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { ChatMessage, CarouselCard, ListMessage } from "@/lib/types";

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Inline WhatsApp markers: *bold*, _italic_, ~strikethrough~ (marker must hug non-space text).
function formatInline(text: string, keyPrefix: string): React.ReactNode[] {
  const re = /(\*|_|~)(?=\S)(.+?)(?<=\S)\1/g;
  const nodes: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const [, marker, inner] = m;
    if (marker === "*") nodes.push(<strong key={`${keyPrefix}b${k++}`}>{inner}</strong>);
    else if (marker === "_") nodes.push(<em key={`${keyPrefix}i${k++}`}>{inner}</em>);
    else nodes.push(<s key={`${keyPrefix}s${k++}`}>{inner}</s>);
    last = re.lastIndex;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

// Render WhatsApp-style text: clickable http(s) links (open in a new tab) plus inline
// *bold*/_italic_/~strike~ formatting. The agent/catalog copy uses WhatsApp markers and raw
// URLs; without this the asterisks show literally and the link isn't tappable. Newlines are
// preserved by the surrounding `whitespace-pre-wrap`.
function formatWhatsApp(text: string, onLinkClick?: (url: string) => void): React.ReactNode {
  if (!text) return text;
  const urlRe = /(https?:\/\/[^\s]+)/g;
  const out: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = urlRe.exec(text)) !== null) {
    if (m.index > last) out.push(...formatInline(text.slice(last, m.index), `seg${k}-`));
    const url = m[1];
    out.push(
      <a
        key={`url${k++}`}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => onLinkClick?.(url)}
        className="text-[#027eb5] underline break-all"
      >
        {url}
      </a>
    );
    last = urlRe.lastIndex;
  }
  if (last < text.length) out.push(...formatInline(text.slice(last), `seg${k}-`));
  return out.length ? out : text;
}

// onReply(displayText, agentText?) — displayText is what shows as the customer's outgoing
// bubble (the WhatsApp button title); agentText is the richer instruction sent to the agent
// (the button's `payload`). Falls back to displayText when no payload is set.
type ReplyFn = (displayText: string, agentText?: string) => void;

function CarouselCardView({ card, onReply }: { card: CarouselCard; onReply: ReplyFn }) {
  return (
    <div className="min-w-[260px] max-w-[260px] rounded-lg overflow-hidden bg-white shadow-sm border border-gray-200 snap-center flex-shrink-0">
      {card.header?.image?.link && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={card.header.image.link} alt="" className="w-full h-[160px] object-cover" />
      )}
      <div className="p-3">
        {(() => {
          const [title, ...rest] = (card.body?.text || "").split("\n");
          const desc = rest.join(" ").trim();
          return (
            <>
              <p className="text-sm text-gray-900 font-semibold">{formatWhatsApp(title)}</p>
              {desc && <p className="text-xs text-gray-600 mt-1">{formatWhatsApp(desc)}</p>}
            </>
          );
        })()}
      </div>
      {card.action?.buttons?.map((btn, i) => {
        if (btn.type === "cta_url" && btn.cta_url) {
          return (
            <div key={i} className="border-t border-gray-200 p-2">
              <a
                href={btn.cta_url.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-center text-sm text-[#027eb5] font-medium py-1"
              >
                🔗 {btn.cta_url.display_text || "Open"}
              </a>
            </div>
          );
        }
        if (btn.type === "reply" && btn.reply) {
          return (
            <div key={i} className="border-t border-gray-200 p-2">
              <button
                onClick={() => onReply(btn.reply!.title, btn.reply!.payload)}
                className="w-full text-center text-sm text-[#027eb5] font-medium py-1"
              >
                {btn.reply.title}
              </button>
            </div>
          );
        }
        return null;
      })}
    </div>
  );
}

function ListView({ list, onReply }: { list: ListMessage; onReply: ReplyFn }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col gap-1 max-w-[85%] mr-auto mb-2">
      <div className="bg-white rounded-lg px-3 py-2 shadow-sm">
        {list.header?.text && <p className="text-sm font-bold text-gray-900">{formatWhatsApp(list.header.text)}</p>}
        <p className="text-sm text-gray-800 whitespace-pre-wrap">{formatWhatsApp(list.body?.text || "")}</p>
        {list.footer && <p className="text-xs text-[#667781] mt-1">{list.footer.text}</p>}
      </div>
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="border border-[#027eb5] text-[#027eb5] rounded-lg px-4 py-2 text-sm font-medium w-full bg-white hover:bg-[#027eb5]/5 transition-colors"
        >
          {list.action.button}
        </button>
      ) : (
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          {list.action.sections.map((section, si) => (
            <div key={si}>
              <p className="px-3 pt-2 pb-1 text-xs font-semibold text-[#667781] uppercase tracking-wide">
                {section.title}
              </p>
              {section.rows.map((row) => (
                <button
                  key={row.id}
                  onClick={() => {
                    setOpen(false);
                    onReply(row.title, row.payload);
                  }}
                  className="w-full text-left px-3 py-2.5 border-t border-gray-100 hover:bg-gray-50 transition-colors flex justify-between items-center gap-2"
                >
                  <span className="text-sm text-gray-900">{row.title}</span>
                  {row.description && <span className="text-xs text-[#667781]">{row.description}</span>}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MessageBubble({
  msg,
  onReply,
  onLinkClick,
}: {
  msg: ChatMessage;
  onReply: ReplyFn;
  onLinkClick?: (url: string) => void;
}) {
  const isOutgoing = msg.direction === "outgoing";
  const bubbleClass = isOutgoing ? "bg-[#d9fdd3] ml-auto" : "bg-white mr-auto";

  // System status chip (routing / "specialist joined" / handoff notices) — centered.
  if (msg.type === "system") {
    return (
      <div className="flex justify-center my-2">
        <span className="bg-[#ffeecd] text-[#7a5b1e] text-xs rounded-full px-3 py-1 shadow-sm text-center max-w-[85%]">
          {msg.text}
        </span>
      </div>
    );
  }

  // Uploaded photo (Step 9 — customer sends a picture of the product expiry date).
  if (msg.type === "image" && msg.imageUrl) {
    return (
      <div className={`rounded-lg p-1 shadow-sm max-w-[70%] mb-2 ${bubbleClass}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={msg.imageUrl} alt="uploaded" className="rounded-md w-full object-cover max-h-[260px]" />
        {msg.text && <p className="text-xs text-gray-700 px-1 pt-1">{msg.text}</p>}
        <span className="text-[10px] text-[#667781] float-right mt-0.5 pr-1">{formatTime(msg.timestamp)}</span>
      </div>
    );
  }

  if (msg.type === "interactive" && msg.interactive?.type === "carousel") {
    return (
      <div className="flex flex-col gap-1 max-w-[95%] mr-auto mb-2">
        {msg.interactive.body?.text && (
          <div className="bg-white rounded-lg px-3 py-2 shadow-sm max-w-[85%]">
            <p className="text-sm text-gray-800 whitespace-pre-wrap">{formatWhatsApp(msg.interactive.body.text)}</p>
            <span className="text-[10px] text-[#667781] float-right mt-1">{formatTime(msg.timestamp)}</span>
          </div>
        )}
        <div className="flex gap-2 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-hide pl-1">
          {msg.interactive.action.cards.map((card) => (
            <CarouselCardView key={card.card_index} card={card} onReply={onReply} />
          ))}
        </div>
      </div>
    );
  }

  if (msg.type === "interactive" && msg.interactive?.type === "button") {
    const header = "header" in msg.interactive ? msg.interactive.header : undefined;
    return (
      <div className="flex flex-col gap-1 max-w-[80%] mr-auto mb-2">
        <div className="bg-white rounded-lg overflow-hidden shadow-sm">
          {header?.type === "image" && header.image?.link && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={header.image.link} alt="Product" className="w-full h-[200px] object-cover" />
          )}
          <div className="px-3 py-2">
            <p className="text-sm text-gray-800 whitespace-pre-wrap">{formatWhatsApp(msg.interactive.body?.text || "")}</p>
            <span className="text-[10px] text-[#667781] float-right mt-1">{formatTime(msg.timestamp)}</span>
          </div>
        </div>
        <div className="flex gap-1 flex-wrap">
          {msg.interactive.action.buttons.map((btn, i) => {
            if (btn.type === "cta_url" && btn.cta_url) {
              return (
                <a
                  key={`cta-${i}`}
                  href={btn.cta_url.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="border border-[#027eb5] text-[#027eb5] rounded-full px-4 py-1.5 text-sm font-medium hover:bg-[#027eb5]/10 transition-colors"
                >
                  🔗 {btn.cta_url.display_text || "Open"}
                </a>
              );
            }
            if (btn.reply) {
              return (
                <button
                  key={btn.reply.id}
                  onClick={() => onReply(btn.reply!.title, btn.reply!.payload)}
                  className="border border-[#027eb5] text-[#027eb5] rounded-full px-4 py-1.5 text-sm font-medium hover:bg-[#027eb5]/10 transition-colors"
                >
                  {btn.reply.title}
                </button>
              );
            }
            return null;
          })}
        </div>
      </div>
    );
  }

  if (msg.type === "interactive" && msg.interactive?.type === "list") {
    return <ListView list={msg.interactive} onReply={onReply} />;
  }

  return (
    <div className={`rounded-lg px-3 py-2 shadow-sm max-w-[80%] mb-2 ${bubbleClass}`}>
      {msg.senderName && !isOutgoing && (
        <p className="text-xs font-semibold text-[#027eb5] mb-0.5">{msg.senderName}</p>
      )}
      <p className="text-sm text-gray-800 whitespace-pre-wrap">{formatWhatsApp(msg.text || "", onLinkClick)}</p>
      <span className="text-[10px] text-[#667781] float-right mt-1">{formatTime(msg.timestamp)}</span>
    </div>
  );
}

function getSessionId(): string {
  // Fresh session on every page load — refreshing starts a brand-new Agentforce
  // conversation (no memory of prior turns) and an empty message partition.
  return crypto.randomUUID();
}

// Build a concise handoff briefing from the visible transcript so the human specialist
// lands with full context (the grooming journey, the order, the issue). Sourced from the
// rendered chat — the ground truth of what the customer actually saw.
function buildHandoffSummary(msgs: ChatMessage[], triggerText: string): string {
  const lines: string[] = [];
  for (const m of msgs) {
    if (m.type === "system") continue;
    const who = m.direction === "outgoing" ? "Customer" : "Bot";
    let content = (m.text || "").trim();
    if (m.type === "image") content = "[sent a photo]";
    if (m.type === "interactive" && m.interactive) {
      const it = m.interactive;
      if (it.type === "carousel") {
        const names = it.action.cards.map((c) => c.body.text.split("\n")[0].trim()).filter(Boolean);
        content = `[showed products: ${names.join(" | ")}]`;
      } else if (it.type === "button") {
        content = `${(it.body?.text || "").trim()} [card]`.trim();
      } else if (it.type === "list") {
        const names = it.action.sections.flatMap((s) => s.rows.map((r) => r.title));
        content = `${(it.body?.text || "").trim()} [list: ${names.join(" | ")}]`.trim();
      }
    }
    content = content.replace(/\s+/g, " ").trim();
    if (!content) continue;
    if (content.length > 220) content = content.slice(0, 217) + "…";
    lines.push(`${who}: ${content}`);
  }
  const MAX = 30;
  const kept = lines.length > MAX ? ["…(earlier messages omitted)…", ...lines.slice(-MAX)] : lines;
  const header =
    "[Live handoff from Aster & Oak WhatsApp assistant. Conversation so far is below so you have full context.]";
  const ask = triggerText.trim() ? `\n\nCustomer's latest request: "${triggerText.trim()}"` : "";
  return `${header}\n\n${kept.join("\n")}${ask}`;
}

export default function Chat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [sessionId, setSessionId] = useState("");
  const [liveMode, setLiveMode] = useState(false);
  const [agentTyping, setAgentTyping] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const lastPollRef = useRef<number>(0);
  const handoffRef = useRef<{ conversationId: string; token: string } | null>(null);
  const esRef = useRef<EventSource | null>(null);
  const seenEntriesRef = useRef<Set<string>>(new Set());
  const messagesRef = useRef<ChatMessage[]>([]);
  const agentSessionRef = useRef<string | null>(null);
  const didKickoffRef = useRef(false);
  const didConfirmPaymentRef = useRef(false);

  useEffect(() => {
    const sid = getSessionId();
    console.log("[Aster] session initialized:", sid);
    setSessionId(sid);
    fetch(`/api/session?id=${sid}`, { method: "DELETE" }).catch(() => {});
  }, []);

  const pollForMessages = useCallback(async () => {
    if (!sessionId) return;
    try {
      const res = await fetch(`/api/poll?session=${sessionId}&since=${lastPollRef.current}`);
      if (!res.ok) return;
      const raw: ChatMessage[] = await res.json();
      // Rich cards are delivered inline via the /api/chat reply (reliable, same-instance),
      // so ignore any interactive messages that also arrive via the webhook/poll hop.
      const newMsgs = raw.filter((m) => m.type !== "interactive");
      if (newMsgs.length > 0) {
        setMessages((prev) => {
          const ids = new Set(prev.map((m) => m.id));
          const unique = newMsgs.filter((m) => !ids.has(m.id));
          if (unique.length === 0) return prev;
          return [...prev, ...unique];
        });
        const maxTs = Math.max(...newMsgs.map((m) => m.timestamp));
        if (maxTs > lastPollRef.current) lastPollRef.current = maxTs;
      }
    } catch {
      /* network error, retry next cycle */
    }
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) return;
    const interval = setInterval(pollForMessages, 2000);
    pollForMessages();
    return () => clearInterval(interval);
  }, [sessionId, pollForMessages]);

  // Auto-kickoff: once the session exists, silently send an opening message to the agent so
  // it emits the Slate carousel on its own. The customer never sees this "hi" bubble — the
  // carousel just appears first, exactly like a business-initiated (outbound) WhatsApp message.
  useEffect(() => {
    if (!sessionId || didKickoffRef.current) return;
    didKickoffRef.current = true;
    setAgentTyping(true);
    sendMessage("Hi", "Hi 👋", { hidden: true }).finally(() => setAgentTyping(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    return () => {
      esRef.current?.close();
    };
  }, []);

  const pushMessage = useCallback((msg: ChatMessage) => {
    setMessages((prev) => (prev.find((m) => m.id === msg.id) ? prev : [...prev, msg]));
  }, []);

  // Open the live-agent (MIAW) bridge: start a conversation, stream its events into the
  // chat, and prime the human specialist with the customer's full journey.
  const startHandoff = useCallback(
    async (primerText: string) => {
      if (handoffRef.current) return;
      try {
        const res = await fetch("/api/handoff/start", { method: "POST" });
        if (!res.ok) throw new Error(`start ${res.status}`);
        const { conversationId, token, lastEventId } = await res.json();
        handoffRef.current = { conversationId, token };
        setLiveMode(true);
        console.log("[Aster] handoff started:", conversationId);

        const params = new URLSearchParams({ token, lastEventId: lastEventId || "" });
        const es = new EventSource(`/api/handoff/stream?${params.toString()}`);
        esRef.current = es;
        es.onmessage = (evt) => {
          let p: { kind: string; text?: string; senderName?: string; entryId?: string; on?: boolean };
          try {
            p = JSON.parse(evt.data);
          } catch {
            return;
          }
          if (p.entryId && seenEntriesRef.current.has(p.entryId)) return;
          if (p.entryId) seenEntriesRef.current.add(p.entryId);
          if (p.kind === "agentMessage") {
            setAgentTyping(false);
            pushMessage({
              id: p.entryId || crypto.randomUUID(),
              direction: "incoming",
              timestamp: Date.now(),
              type: "text",
              text: p.text,
              senderName: p.senderName || "Aster Specialist",
            });
          } else if (p.kind === "status") {
            pushMessage({
              id: p.entryId || crypto.randomUUID(),
              direction: "incoming",
              timestamp: Date.now(),
              type: "system",
              text: p.text,
            });
          } else if (p.kind === "typing") {
            setAgentTyping(Boolean(p.on));
          }
        };
        es.onerror = () => console.warn("[Aster] handoff SSE error (will auto-retry)");

        const primer = buildHandoffSummary(messagesRef.current, primerText);
        await fetch("/api/handoff/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ conversationId, token, text: primer }),
        });
      } catch (err) {
        console.error("[Aster] handoff failed:", err);
        pushMessage({
          id: crypto.randomUUID(),
          direction: "incoming",
          timestamp: Date.now(),
          type: "system",
          text: "Couldn't reach a live specialist right now. Please try again in a moment.",
        });
      }
    },
    [pushMessage]
  );

  // text = what shows as the customer's bubble; agentText = what the agent receives.
  // opts.hidden = send to the agent WITHOUT rendering an outgoing customer bubble — used for
  // the auto-kickoff so the first card looks like a brand-initiated outbound WhatsApp message.
  async function sendMessage(text: string, agentText?: string, opts?: { hidden?: boolean }) {
    const hidden = opts?.hidden === true;
    if (!text.trim() || sending) return;
    setSending(true);
    if (!hidden) setInput("");
    const toAgent = (agentText ?? text).trim();

    if (!hidden) {
      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        direction: "outgoing",
        timestamp: Date.now(),
        type: "text",
        text: text.trim(),
      };
      setMessages((prev) => [...prev, userMsg]);
    }

    // LIVE-AGENT MODE: route the message to the human specialist via the MIAW bridge.
    if (liveMode && handoffRef.current) {
      try {
        const { conversationId, token } = handoffRef.current;
        await fetch("/api/handoff/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ conversationId, token, text: toAgent }),
        });
      } catch (err) {
        console.error("[Aster] live send failed:", err);
      } finally {
        setSending(false);
      }
      return;
    }

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: toAgent, sessionId, agentSessionId: agentSessionRef.current }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.agentSessionId) agentSessionRef.current = data.agentSessionId;
        await pollForMessages();
        for (let i = 0; i < 3; i++) {
          await new Promise((r) => setTimeout(r, 800));
          await pollForMessages();
        }
        if (data.replyMsg) {
          setMessages((prev) => {
            if (prev.find((m) => m.id === data.replyMsg.id)) return prev;
            return [...prev, data.replyMsg];
          });
        }
        if (data.handoff && !handoffRef.current) {
          await startHandoff(toAgent);
        }
      }
    } catch (err) {
      console.error("Send failed:", err);
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          direction: "incoming",
          timestamp: Date.now(),
          type: "text",
          text: "[Network error] Could not reach server.",
        },
      ]);
    } finally {
      setSending(false);
    }
  }

  // Step 9: the customer uploads a photo of the product's printed expiry date. We render it
  // locally as an outgoing image bubble and send the agent a text signal so it can proceed
  // with the exchange flow (the mock doesn't run OCR — the photo is the demo gesture).
  function handleImagePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    pushMessage({
      id: crypto.randomUUID(),
      direction: "outgoing",
      timestamp: Date.now(),
      type: "image",
      imageUrl: url,
    });
    e.target.value = "";
    // Signal the agent that a photo of the expiry date was shared — sent HIDDEN so only the
    // image bubble shows (no extra "📷 Photo" text bubble).
    sendMessage(
      "📷 Photo",
      "[Customer uploaded a photo showing the product's printed expiry date on the packaging.]",
      { hidden: true }
    );
  }

  // When the customer taps the secure payment link, the browser opens the checkout in a new
  // tab AND we auto-advance the journey: fire a hidden "payment completed" signal so the agent
  // sends the order-confirmation on its own — no need for the customer to type "payment done".
  // Guarded to fire exactly once, and only for the real checkout link.
  function handleLinkClick(url: string) {
    if (didConfirmPaymentRef.current) return;
    if (!url.includes("checkout/aster-8932")) return;
    didConfirmPaymentRef.current = true;
    sendMessage(
      "Payment completed",
      "[The customer clicked the secure payment link and completed the payment successfully on the checkout page.]",
      { hidden: true }
    );
  }

  return (
    <div className="h-full flex flex-col bg-[#efeae2]">
      {/* Header */}
      <header className="bg-[#075e54] text-white px-4 py-3 flex items-center gap-3 flex-shrink-0 shadow-md z-10">
        <div className="w-10 h-10 rounded-full bg-black flex items-center justify-center text-white font-bold text-sm border border-white/20">
          {liveMode ? "🧑‍💼" : "Aster"}
        </div>
        <div className="flex-1">
          <h1 className="text-base font-medium">{liveMode ? "Aster Specialist" : "Aster & Oak"}</h1>
          <p className="text-xs text-green-200">
            {agentTyping ? "typing…" : liveMode ? "live agent • online" : "online"}
          </p>
        </div>
        <div className="flex gap-4">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M15.9 14.3H15l-.3-.3c1-1.1 1.6-2.7 1.6-4.3 0-3.7-3-6.7-6.7-6.7S3 6 3 9.7s3 6.7 6.7 6.7c1.6 0 3.2-.6 4.3-1.6l.3.3v.8l5.1 5.1 1.5-1.5-5-5.2zm-6.2 0c-2.6 0-4.6-2.1-4.6-4.6s2.1-4.6 4.6-4.6 4.6 2.1 4.6 4.6-2 4.6-4.6 4.6z" />
          </svg>
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 7a2 2 0 1 0-.001-4.001A2 2 0 0 0 12 7zm0 2a2 2 0 1 0-.001 3.999A2 2 0 0 0 12 9zm0 6a2 2 0 1 0-.001 3.999A2 2 0 0 0 12 15z" />
          </svg>
        </div>
      </header>

      {/* Chat area */}
      <main className="flex-1 overflow-y-auto px-3 py-4 flex flex-col">
        {messages.length === 0 && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-[#667781] bg-white/80 rounded-lg px-6 py-4 shadow-sm">
              <p className="text-sm">Waiting for messages...</p>
              <p className="text-xs mt-1 font-mono break-all">Session: {sessionId.slice(0, 8)}</p>
            </div>
          </div>
        )}
        {messages.map((msg) => (
          <MessageBubble key={msg.id} msg={msg} onReply={sendMessage} onLinkClick={handleLinkClick} />
        ))}
        <div ref={bottomRef} />
      </main>

      {/* Input bar */}
      <footer className="bg-[#f0f2f5] px-3 py-2 flex items-center gap-2 flex-shrink-0">
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImagePicked} />
        <button
          className="text-[#54656f] p-2 disabled:opacity-40"
          onClick={() => fileRef.current?.click()}
          disabled={sending || liveMode}
          title="Attach a photo"
        >
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
            <path d="M1.816 15.556v.002c0 1.502.584 2.912 1.646 3.972s2.472 1.647 3.974 1.647a5.58 5.58 0 0 0 3.972-1.645l9.547-9.548c.769-.768 1.147-1.767 1.058-2.817-.079-.968-.548-1.927-1.319-2.698-1.594-1.592-4.068-1.717-5.517-.273L7.07 11.896l-.014.013c-.24.24-.364.57-.345.912.02.312.179.642.4.835.235.188.577.26.834.26.329 0 .62-.139.828-.347l6.86-6.861c.244-.244.64-.244.883 0 .244.244.244.64 0 .883l-6.86 6.862c-.33.33-.814.516-1.308.516-.471 0-.937-.179-1.288-.473-.359-.306-.59-.72-.63-1.191a1.914 1.914 0 0 1 .556-1.46l9.705-9.707c1.016-1.015 2.715-.882 3.788.19.555.556.908 1.26.996 1.983.088.728-.102 1.395-.558 1.85l-9.547 9.548c-.794.794-1.846 1.233-2.966 1.233-1.121 0-2.172-.439-2.967-1.234-.794-.794-1.233-1.846-1.233-2.966 0-1.12.439-2.172 1.234-2.967L9.747 7.46c.244-.244.64-.244.884 0 .243.244.243.64 0 .883l-6.49 6.49a1.916 1.916 0 0 0-.325 1.722z" />
          </svg>
        </button>
        <div className="flex-1 relative">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") sendMessage(input);
            }}
            placeholder="Type a message"
            className="w-full rounded-full bg-white border-none px-4 py-2.5 text-sm text-gray-800 outline-none placeholder:text-[#667781]"
            disabled={sending}
          />
        </div>
        <button
          onClick={() => sendMessage(input)}
          disabled={!input.trim() || sending}
          className="text-[#54656f] p-2 disabled:opacity-40"
        >
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
            <path d="M1.101 21.757 23.8 12.028 1.101 2.3l.011 7.912 13.623 1.816-13.623 1.817-.011 7.912z" />
          </svg>
        </button>
      </footer>
    </div>
  );
}
