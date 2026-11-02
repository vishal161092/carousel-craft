import { LightningElement, track } from "lwc";
import startSession from "@salesforce/apex/de_AsterAgentController.startSession";
import sendMessageApex from "@salesforce/apex/de_AsterAgentController.sendMessage";
import getHandoffToken from "@salesforce/apex/de_AsterAgentController.getHandoffToken";
import openHandoffConversation from "@salesforce/apex/de_AsterAgentController.openHandoffConversation";
import sendHandoffMessage from "@salesforce/apex/de_AsterAgentController.sendHandoffMessage";
import pollHandoff from "@salesforce/apex/de_AsterAgentController.pollHandoff";
import { CARD_BY_KEY } from "./catalog";
import { formatWhatsApp } from "./format";

/**
 * de_asterChat — Aster & Oak WhatsApp commerce experience, rebuilt as an LWC for the Aster-WA
 * LWR Experience site. Port of the Next.js mock-ui UI (page.tsx):
 *   - auto-kickoff ("Hi") so the Slate carousel arrives as a brand-initiated message
 *   - renders the same catalog cards (carousel / button / list) inline by cardKey
 *   - WhatsApp text formatting + payment link click-to-confirm
 *   - photo upload for the expiry/exchange step
 *   - human handoff launches the Embedded Messaging widget (injected in the site headMarkup)
 *
 * The server glue (OAuth, Agent API, tag-strip, card resolve, payment, handoff detection) lives
 * in de_AsterAgentController; this component calls startSession() then sendMessage() per turn.
 */
export default class De_asterChat extends LightningElement {
  @track messages = [];
  draft = "";
  agentSessionId = null;
  liveMode = false;

  _msgSeq = 0;
  _kickedOff = false;
  _paymentConfirmed = false;
  _lastSentText = "";
  _handoff = null; // { conversationId, token } once the live bridge is open
  _seenEntries = new Set();
  _liveStatusShown = new Set();
  _pollTimer = null;

  // Header reflects who the customer is talking to (bot vs live specialist).
  get headerTitle() {
    return this.liveMode ? "Aster Specialist" : "Aster & Oak";
  }
  get headerSub() {
    return this.liveMode ? "live agent • online" : "online";
  }

  // ---------- lifecycle ----------
  connectedCallback() {
    if (this._kickedOff) {
      return;
    }
    this._kickedOff = true;
    this.kickoff();
  }

  async kickoff() {
    try {
      const s = await startSession();
      this.agentSessionId = s.agentSessionId;
    } catch (e) {
      // startSession failing is non-fatal — sendMessage will mint a session on first turn.
      this.agentSessionId = null;
    }
    // Hidden opening "Hi" so the brand speaks first (carousel), no visible customer bubble.
    this.send("Hi", { hidden: true });
  }

  // ---------- sending ----------
  handleInput(event) {
    this.draft = event.target.value;
  }

  handleKeyUp(event) {
    if (event.key === "Enter") {
      this.handleSendClick();
    }
  }

  handleSendClick() {
    const text = (this.draft || "").trim();
    if (!text) {
      return;
    }
    this.draft = "";
    this.send(text, { hidden: false });
  }

  async send(text, opts) {
    const hidden = opts && opts.hidden;
    this._lastSentText = text;
    if (!hidden) {
      this.pushOutgoing(text);
    }

    // LIVE-AGENT MODE: once handed off, route messages to the human specialist via the MIAW
    // bridge instead of the Agentforce bot. Their replies arrive through pollHandoff().
    if (this.liveMode && this._handoff) {
      try {
        await sendHandoffMessage({
          conversationId: this._handoff.conversationId,
          token: this._handoff.token,
          text,
        });
      } catch (e) {
        // transient — subsequent messages will still reach the specialist
      }
      return;
    }

    try {
      const reply = await sendMessageApex({ agentSessionId: this.agentSessionId, userText: text });
      this.handleReply(reply);
    } catch (e) {
      this.pushIncomingText("Sorry, something went wrong on my end. Please try again.");
    }
  }

  handleReply(reply) {
    if (!reply) {
      return;
    }
    if (reply.agentSessionId) {
      this.agentSessionId = reply.agentSessionId;
    }

    const card = reply.cardKey ? CARD_BY_KEY[reply.cardKey] : null;
    if (card) {
      // Card body carries the copy — suppress surrounding narration, matching route.ts.
      this.pushCard(card);
    } else if (reply.text && reply.text.trim()) {
      this.pushIncomingText(reply.text);
    }

    if (reply.handoff) {
      this.startHandoff(this._lastSentText);
    }
  }

  // ---------- message builders ----------
  nextId() {
    this._msgSeq += 1;
    return "m" + this._msgSeq;
  }

  // WhatsApp-style clock, e.g. "12:58 PM".
  nowTime() {
    return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  pushOutgoing(text) {
    this.messages = [
      ...this.messages,
      { id: this.nextId(), outgoing: true, isText: true, bubbleClass: "aster-bubble aster-out", html: formatWhatsApp(text), raw: text, time: this.nowTime() },
    ];
    this.scrollSoon();
  }

  pushIncomingText(text) {
    this.messages = [
      ...this.messages,
      { id: this.nextId(), outgoing: false, isText: true, bubbleClass: "aster-bubble aster-in", html: formatWhatsApp(text), raw: text, time: this.nowTime() },
    ];
    this.scrollSoon();
  }

  pushImageBubble(imageUrl, caption) {
    this.messages = [
      ...this.messages,
      {
        id: this.nextId(),
        outgoing: true,
        isImage: true,
        bubbleClass: "aster-bubble aster-out",
        imageUrl,
        html: caption ? formatWhatsApp(caption) : null,
        time: this.nowTime(),
      },
    ];
    this.scrollSoon();
  }

  pushSystemNote(text) {
    this.messages = [
      ...this.messages,
      { id: this.nextId(), isSystem: true, html: formatWhatsApp(text) },
    ];
    this.scrollSoon();
  }

  pushCard(card) {
    const vm = this.normalizeCard(card);
    this.messages = [...this.messages, { id: this.nextId(), outgoing: false, isCard: true, card: vm }];
    this.scrollSoon();
  }

  // Normalise a WhatsApp interactive payload into a flat view-model the template renders,
  // matching the three native WhatsApp interactive layouts:
  //   - carousel: a lead-in text bubble + horizontally-scrolling product cards (buttons inside)
  //   - button:   a media/text bubble + reply/CTA buttons rendered as pills BELOW the bubble
  //   - list:     a text bubble + a menu button that expands into selectable rows
  normalizeCard(card) {
    const time = this.nowTime();
    if (card.type === "carousel") {
      return {
        isCarousel: true,
        time,
        bodyHtml: formatWhatsApp(card.body && card.body.text ? card.body.text : ""),
        hasBody: !!(card.body && card.body.text),
        cards: (card.action.cards || []).map((c, i) => {
          const parts = (c.body && c.body.text ? c.body.text : "").split("\n");
          const title = parts.shift() || "";
          const desc = parts.join(" ").trim();
          return {
            id: "c" + i,
            image: c.header && c.header.image ? c.header.image.link : null,
            titleHtml: formatWhatsApp(title),
            descHtml: desc ? formatWhatsApp(desc) : null,
            hasDesc: !!desc,
            buttons: this.mapButtons(c.action && c.action.buttons),
          };
        }),
      };
    }
    if (card.type === "list") {
      return {
        isList: true,
        time,
        headerText: card.header && card.header.text ? card.header.text : null,
        bodyHtml: formatWhatsApp(card.body && card.body.text ? card.body.text : ""),
        footerText: card.footer && card.footer.text ? card.footer.text : null,
        listButton: card.action.button,
        open: false,
        sections: (card.action.sections || []).map((sec, si) => ({
          id: "s" + si,
          title: sec.title,
          rows: (sec.rows || []).map((r) => ({ id: r.id, title: r.title, description: r.description, payload: r.payload })),
        })),
      };
    }
    // Default: button interactive message.
    return {
      isButton: true,
      time,
      image: card.header && card.header.image ? card.header.image.link : null,
      bodyHtml: formatWhatsApp(card.body && card.body.text ? card.body.text : ""),
      buttons: this.mapButtons(card.action && card.action.buttons),
    };
  }

  mapButtons(buttons) {
    return (buttons || []).map((b, i) => {
      if (b.type === "cta_url" && b.cta_url) {
        return { id: "b" + i, isCta: true, label: b.cta_url.display_text || "Open", url: b.cta_url.url };
      }
      const r = b.reply || {};
      return { id: (r.id || "b") + i, isReply: true, label: r.title, payload: r.payload || r.title };
    });
  }

  // ---------- interactions ----------
  handleButton(event) {
    const { reply, url } = event.currentTarget.dataset;
    if (url) {
      window.open(url, "_blank", "noopener");
      return;
    }
    if (reply) {
      this.send(reply, { hidden: false });
    }
  }

  handleRow(event) {
    const payload = event.currentTarget.dataset.payload;
    if (payload) {
      this.send(payload, { hidden: false });
    }
  }

  // Expand a list message's menu into its selectable rows (WhatsApp list behaviour).
  handleListToggle(event) {
    const msgId = event.currentTarget.dataset.msgid;
    this.messages = this.messages.map((m) =>
      m.id === msgId && m.card ? { ...m, card: { ...m.card, open: true } } : m
    );
  }

  // Links inside formatted text bubble a composed `linkclick` event up from de_asterText (the
  // anchor lives in that child's shadow). Payment link → fire the hidden "payment completed"
  // signal so the agent auto-confirms the order (the anchor still opens in its own new tab).
  handleLinkClick(event) {
    const href = (event.detail && event.detail.href) || "";
    if (/checkout\/aster-8932/i.test(href) && !this._paymentConfirmed) {
      this._paymentConfirmed = true;
      this.send("I have completed the payment", { hidden: true });
    }
  }

  // Paperclip opens the OS file picker (via the hidden <input type="file">).
  handlePhotoClick() {
    const input = this.template.querySelector(".aster-file");
    if (input) {
      input.click();
    }
  }

  // Show the real picked image in an outgoing bubble, then send the hidden exchange signal.
  handleFilePicked(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) {
      return;
    }
    const url = URL.createObjectURL(file);
    this.pushImageBubble(url, null);
    this.send("I have uploaded a photo of the product's expiry date", { hidden: true });
    // Reset so picking the same file again re-fires change.
    event.target.value = "";
  }

  // Human handoff — the custom MIAW bridge (same UX as the Vercel app): open a live-agent
  // conversation and stream the specialist's replies INLINE into this same WhatsApp thread.
  // Apex does the callouts; we poll for new entries (Apex can't proxy SSE to the browser).
  async startHandoff(triggerText) {
    if (this._handoff || this.liveMode) {
      return;
    }
    this.liveMode = true; // guard against re-entry + flip the header to "live agent"
    this.pushSystemNote("Connecting you to a live specialist…");
    try {
      const token = await getHandoffToken();
      const conversationId = this.uuid();

      // The conversation service returns a transient 503 for the first ~second after a cold
      // deployment — retry with a short backoff (Apex can't sleep, so the wait lives here).
      let ready = false;
      for (let i = 0; i < 6 && !ready; i++) {
        // eslint-disable-next-line no-await-in-loop
        ready = await openHandoffConversation({ token, conversationId });
        if (!ready) {
          // eslint-disable-next-line no-await-in-loop
          await this.delay(1200);
        }
      }
      if (!ready) {
        throw new Error("conversation not ready");
      }

      this._handoff = { conversationId, token };

      // Prime the specialist with the full journey so they land with context.
      const primer = this.buildHandoffSummary(triggerText);
      await sendHandoffMessage({ conversationId, token, text: primer });

      this.startHandoffPolling();
    } catch (e) {
      this.liveMode = false;
      this.pushSystemNote("Couldn't reach a live specialist right now. Please try again in a moment.");
    }
  }

  startHandoffPolling() {
    this.pollHandoffOnce();
    // eslint-disable-next-line @lwc/lwc/no-async-operation
    this._pollTimer = window.setInterval(() => this.pollHandoffOnce(), 2500);
  }

  async pollHandoffOnce() {
    if (!this._handoff) {
      return;
    }
    try {
      const entries = await pollHandoff({
        conversationId: this._handoff.conversationId,
        token: this._handoff.token,
      });
      for (const e of entries) {
        if (!e.entryId || this._seenEntries.has(e.entryId)) {
          continue;
        }
        this._seenEntries.add(e.entryId);
        if (e.kind === "agentMessage") {
          this.pushIncomingText(e.text);
        } else if (e.kind === "status") {
          if (this._liveStatusShown.has(e.text)) {
            continue; // don't repeat the same routing/join note
          }
          this._liveStatusShown.add(e.text);
          this.pushSystemNote(e.text);
        }
      }
    } catch (e) {
      // network hiccup — next tick retries
    }
  }

  // Concise briefing from the visible transcript (port of page.tsx buildHandoffSummary).
  buildHandoffSummary(triggerText) {
    const lines = [];
    for (const m of this.messages) {
      if (m.isSystem) {
        continue;
      }
      const who = m.outgoing ? "Customer" : "Bot";
      let content = "";
      if (m.isImage) {
        content = "[sent a photo]";
      } else if (m.isCard) {
        content = "[showed product options]";
      } else {
        content = (m.raw || "").trim();
      }
      content = content.replace(/\s+/g, " ").trim();
      if (!content) {
        continue;
      }
      if (content.length > 220) {
        content = content.slice(0, 217) + "…";
      }
      lines.push(`${who}: ${content}`);
    }
    const MAX = 30;
    const kept = lines.length > MAX ? ["…(earlier messages omitted)…", ...lines.slice(-MAX)] : lines;
    const header =
      "[Live handoff from Aster & Oak WhatsApp assistant. Conversation so far is below so you have full context.]";
    const ask = (triggerText || "").trim() ? `\n\nCustomer's latest request: "${triggerText.trim()}"` : "";
    return `${header}\n\n${kept.join("\n")}${ask}`;
  }

  uuid() {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  delay(ms) {
    // eslint-disable-next-line @lwc/lwc/no-async-operation
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  disconnectedCallback() {
    if (this._pollTimer) {
      window.clearInterval(this._pollTimer);
      this._pollTimer = null;
    }
  }

  // ---------- helpers ----------
  scrollSoon() {
    // eslint-disable-next-line @lwc/lwc/no-async-operation
    window.setTimeout(() => {
      const area = this.template.querySelector(".aster-messages");
      if (area) {
        area.scrollTop = area.scrollHeight;
      }
    }, 30);
  }
}
