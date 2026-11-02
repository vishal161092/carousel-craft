import { ButtonMessage, CarouselMessage, InteractiveContent, ListMessage } from "./types";

// Aster & Oak WhatsApp demo catalog. Every rich card the journey shows lives
// here in one place so the visuals/copy stay in sync and the chat route can render them
// INLINE (reliable, same-instance) instead of depending on the cross-instance webhook/poll
// hop. The matching Apex actions still POST the exact same WhatsApp interactive JSON to
// /api/webhook — that payload is production-grade (swap the endpoint to graph.facebook.com
// and it delivers to a real phone). The inline render is the demo-reliable path.
//
// Each Apex action returns a hidden tag `[[ASTER_CARD:<key>]]` as the FIRST token of its
// output. The agent is told to reproduce the action output verbatim; the chat route strips
// the tag before anything reaches the user and renders the card keyed below.

// Deployed Vercel app origin — used only for the ABSOLUTE image URLs embedded in the Apex
// production payload. The browser renders the inline cards with these same links; relative
// would also work in-browser, but absolute keeps the mock and the real-WhatsApp payload
// byte-identical. Update if the Vercel project name differs.
// Public origin of this app. Used to build absolute image URLs that match what the Apex actions send.
// Leave empty to use relative URLs in the browser; set NEXT_PUBLIC_APP_ORIGIN for the production-style payload.
export const APP_ORIGIN = process.env.NEXT_PUBLIC_APP_ORIGIN || "";
const IMG = (file: string) => `${APP_ORIGIN}/${file}`;

const PRODUCT_URL = {
  facewash: "https://asteroak.example/products/ylang-ylang-slate-face-wash",
  bodywash: "https://asteroak.example/products/lemongrass-cinnamon-slate-body-wash",
  shampoo: "https://asteroak.example/products/pepper-mint-clove-slate-shampoo-peppermint",
  facescrub: "https://asteroak.example/products/slate-face-scrub",
};

// ---------- STEP 1: Outbound Slate Range carousel (3 cards) ----------
export const SLATE_CAROUSEL: CarouselMessage = {
  type: "carousel",
  body: {
    text:
      "Hey Alex! 👋 Upgrade your grooming game with our premium *Slate Range*. Deep cleanse, remove impurities, and get that natural glow. Check out our top picks for you below! 👇",
  },
  action: {
    cards: [
      {
        card_index: 0,
        header: { type: "image", image: { link: IMG("slate-face-wash.png") } },
        body: { text: "Slate Face Wash | Ylang-Ylang & Argan | ₹259" },
        action: {
          buttons: [
            { type: "cta_url", cta_url: { display_text: "View Product", url: PRODUCT_URL.facewash } },
            { type: "reply", reply: { id: "know_facewash", title: "Know More", payload: "Know more about the Slate Face Wash" } },
          ],
        },
      },
      {
        card_index: 1,
        header: { type: "image", image: { link: IMG("slate-body-wash.png") } },
        body: { text: "Slate Body Wash | Lemongrass & Cinnamon | ₹299" },
        action: {
          buttons: [
            { type: "cta_url", cta_url: { display_text: "View Product", url: PRODUCT_URL.bodywash } },
            { type: "reply", reply: { id: "know_bodywash", title: "Know More", payload: "Know more about the Slate Body Wash" } },
          ],
        },
      },
      {
        card_index: 2,
        header: { type: "image", image: { link: IMG("slate-shampoo.png") } },
        body: { text: "Slate Shampoo | Pepper Mint & Clove | ₹299" },
        action: {
          buttons: [
            { type: "cta_url", cta_url: { display_text: "View Product", url: PRODUCT_URL.shampoo } },
            { type: "reply", reply: { id: "know_shampoo", title: "Know More", payload: "Know more about the Slate Shampoo" } },
          ],
        },
      },
    ],
  },
};

// ---------- STEP 2 & 4: Single product-detail cards ----------
export const DETAIL_FACEWASH: ButtonMessage = {
  type: "button",
  header: { type: "image", image: { link: IMG("slate-face-wash.png") } },
  body: {
    text:
      "Great choice! 🖤\n*Slate Face Wash (100ml)*\nInfused with Ylang-Ylang and Argan, this face wash goes deep into your pores to draw out dirt, pollution, and excess oil.\n\nPrice: ₹259",
  },
  action: {
    buttons: [
      { type: "reply", reply: { id: "buy_facewash", title: "Buy Now", payload: "Buy the Slate Face Wash" } },
      { type: "reply", reply: { id: "more_like_this", title: "Show More Like This", payload: "Show me more products like this" } },
    ],
  },
};

export const DETAIL_BODYWASH: ButtonMessage = {
  type: "button",
  header: { type: "image", image: { link: IMG("slate-body-wash.png") } },
  body: {
    text:
      "Great pick! 🖤\n*Slate Body Wash (200ml)*\nActivated slate with Lemongrass & Cinnamon deep-cleans, detoxifies, and leaves your skin fresh all day — no dryness.\n\nPrice: ₹299",
  },
  action: {
    buttons: [
      { type: "reply", reply: { id: "buy_bodywash", title: "Buy Now", payload: "Buy the Slate Body Wash" } },
      { type: "reply", reply: { id: "more_like_this", title: "Show More Like This", payload: "Show me more products like this" } },
    ],
  },
};

export const DETAIL_SHAMPOO: ButtonMessage = {
  type: "button",
  header: { type: "image", image: { link: IMG("slate-shampoo.png") } },
  body: {
    text:
      "Great pick! 🖤\n*Slate Shampoo (250ml)*\nPeppermint & Clove with activated slate clears buildup and dandruff, soothes the scalp, and adds a healthy shine.\n\nPrice: ₹299",
  },
  action: {
    buttons: [
      { type: "reply", reply: { id: "buy_shampoo", title: "Buy Now", payload: "Buy the Slate Shampoo" } },
      { type: "reply", reply: { id: "more_like_this", title: "Show More Like This", payload: "Show me more products like this" } },
    ],
  },
};

export const DETAIL_FACESCRUB: ButtonMessage = {
  type: "button",
  header: { type: "image", image: { link: IMG("slate-face-scrub.png") } },
  body: {
    text:
      "*Slate Face Scrub (100g)*\nExfoliates dead skin, removes blackheads, and unplugs pores. Lemongrass and Eucalyptus leave you feeling instantly refreshed!\n\nPrice: ₹349",
  },
  action: {
    buttons: [
      { type: "cta_url", cta_url: { display_text: "View Product", url: PRODUCT_URL.facescrub } },
      { type: "reply", reply: { id: "buy_facescrub", title: "Buy Now", payload: "Buy the Slate Face Scrub" } },
    ],
  },
};

// ---------- STEP 3: Skin-type question (shown after "Show More Like This") ----------
// Replaces the old recommendations list in the main flow: instead of listing 3 add-ons we
// ask one qualifying question, then make a single targeted recommendation (RECOMMEND_FACESCRUB).
export const SKIN_TYPE: ButtonMessage = {
  type: "button",
  body: {
    text: "To give you the best recommendation to pair with that, could you tell me your skin type? 🧴",
  },
  action: {
    buttons: [
      { type: "reply", reply: { id: "skin_oily", title: "Oily", payload: "My skin type is Oily" } },
      { type: "reply", reply: { id: "skin_dry", title: "Dry", payload: "My skin type is Dry" } },
      { type: "reply", reply: { id: "skin_normal", title: "Normal", payload: "My skin type is Normal" } },
    ],
  },
};

// ---------- STEP 4: Targeted recommendation for oily skin -> Slate Face Scrub ----------
// Single-image product card with the oily-skin exfoliation note; Buy Now continues the same
// checkout journey (-> address_confirm) exactly like the other product cards.
export const RECOMMEND_FACESCRUB: ButtonMessage = {
  type: "button",
  header: { type: "image", image: { link: IMG("slate-face-scrub.png") } },
  body: {
    text:
      "Since you have oily skin, regular exfoliation is key to keeping your pores clear and controlling excess oil! 🖤\n\n*Slate Face Scrub (100g)*\nExfoliates dead skin, removes blackheads, and unplugs pores. Lemongrass & Eucalyptus leave you instantly refreshed.\n\nPrice: ₹349",
  },
  action: {
    buttons: [
      { type: "reply", reply: { id: "buy_facescrub", title: "Buy Now", payload: "Buy the Slate Face Scrub" } },
    ],
  },
};

// ---------- FALLBACK: old "Show more like this" recommendations list (kept, no longer in the
// main flow — the skin-type question above replaces it; retained in case we switch back). ----------
export const RECOMMENDATIONS_LIST: ListMessage = {
  type: "list",
  body: {
    text: "Here are some perfect additions to complete your Slate detox routine. Click below to view:",
  },
  action: {
    button: "📋 View Recommendations",
    sections: [
      {
        title: "Slate Detox Routine",
        rows: [
          { id: "rec_facescrub", title: "Slate Face Scrub", description: "₹349", payload: "I'd like the Slate Face Scrub (₹349)" },
          { id: "rec_mask", title: "Slate Peel-Off Mask", description: "₹349", payload: "I'd like the Slate Peel-Off Mask (₹349)" },
          { id: "rec_soap", title: "Slate Soap Bar", description: "₹199", payload: "I'd like the Slate Soap Bar (₹199)" },
        ],
      },
    ],
  },
};

// ---------- STEP 5: Saved-address confirmation ----------
export const ADDRESS_CONFIRM: ButtonMessage = {
  type: "button",
  body: {
    text:
      "Awesome! Adding 1x Slate Face Scrub to your cart. 🛒\n\nSince you're a returning gentleman, shall we deliver this to your saved address? 📍\nFlat 12B, Maple Residency, Lakeview Road, Springfield 000000",
  },
  action: {
    buttons: [
      { type: "reply", reply: { id: "addr_yes", title: "Yes, deliver here", payload: "Yes, deliver to my saved address" } },
      { type: "reply", reply: { id: "addr_new", title: "Add new address", payload: "I'd like to add a new address" } },
    ],
  },
};

// ---------- STEP 8: Order-tracking list ----------
export const ORDER_LIST: ListMessage = {
  type: "list",
  body: {
    text: "Let's check your orders. Please select the order you wish to track from the list below:",
  },
  action: {
    button: "📦 Select Order",
    sections: [
      {
        title: "Your Orders",
        rows: [
          { id: "ord_8932", title: "Order #AO-8932", description: "Processing · Today", payload: "Track order #AO-8932" },
          { id: "ord_7511", title: "Order #AO-7511", description: "Shipped · Oct 5", payload: "Track order #AO-7511" },
        ],
      },
    ],
  },
};

// ---------- STEP 9: Exchange / replacement confirmation ----------
export const EXCHANGE_CARD: ButtonMessage = {
  type: "button",
  body: {
    text:
      "Thank you for sharing the photo. I apologize for the oversight. 🙏\n\nI can immediately process a *free replacement* for this item, and our delivery executive will collect the old one during drop-off.",
  },
  action: {
    buttons: [
      { type: "reply", reply: { id: "exchange_confirm", title: "Confirm Exchange", payload: "Confirm the free exchange" } },
      { type: "reply", reply: { id: "exchange_agent", title: "Speak to Agent", payload: "I'd like to speak to a human agent" } },
    ],
  },
};

// Tag → card lookup. The Apex action emits `[[ASTER_CARD:<key>]]`; the chat route renders
// the matching card inline. Keep keys in sync with the Apex `cardKey` return values.
export const CARD_BY_KEY: Record<string, InteractiveContent> = {
  carousel_slate: SLATE_CAROUSEL,
  detail_facewash: DETAIL_FACEWASH,
  detail_bodywash: DETAIL_BODYWASH,
  detail_shampoo: DETAIL_SHAMPOO,
  detail_facescrub: DETAIL_FACESCRUB,
  skin_type: SKIN_TYPE,
  recommend_facescrub: RECOMMEND_FACESCRUB,
  recommendations: RECOMMENDATIONS_LIST,
  address_confirm: ADDRESS_CONFIRM,
  order_list: ORDER_LIST,
  exchange: EXCHANGE_CARD,
};

// Matches the hidden routing tag anywhere in the agent/action output.
export const CARD_TAG_RE = /\[\[ASTER_CARD:([a-z_]+)\]\]/i;

// Sentinel key: the resolved "card" is actually the fixed payment TEXT, not a card. The chat
// route renders PAYMENT_TEXT (total + secure checkout link) when resolveCard returns this.
export const PAYMENT_KEY = "__payment__";

// Resolve the tag key to a catalog card. The Apex actions emit the canonical keys
// (carousel_slate, detail_facewash, …), but the published agent emits its OWN descriptive,
// non-deterministic key each run (e.g. `Slate_Carousel`, `Slate_Facewash_Detail`,
// `Slate_Facewash_Recommendations`) rather than invoking the action and echoing it
// verbatim. So we resolve by INTENT/PRODUCT KEYWORDS rather than exact string. Intent cards
// (recommendations/exchange/order/address/carousel) are checked BEFORE product-detail cards,
// because a key like "slate_facewash_recommendations" contains a product name too and the
// list must win over the detail card.
export function resolveCard(rawKey: string): { key: string; card: InteractiveContent | null } {
  const raw = (rawKey || "").toLowerCase().trim();
  if (CARD_BY_KEY[raw]) return { key: raw, card: CARD_BY_KEY[raw] };

  // Normalise: collapse underscores/digits/punctuation to spaces for keyword tests.
  const norm = " " + raw.replace(/[^a-z]+/g, " ").trim() + " ";
  const has = (...terms: string[]) => terms.some((t) => norm.includes(t));

  // Priority 0 — the agent emits a `..._Payment` tag at the checkout step, but payment is
  // TEXT (the secure link), not a card. Catch it FIRST (the key often also contains a product
  // name, which would otherwise mis-match a detail card) and signal the route via PAYMENT_KEY.
  if (has("payment", "checkout", "pay now", "secure link")) {
    return { key: PAYMENT_KEY, card: null };
  }

  let key: string | null = null;
  // Priority 1 — intent cards.
  // Skin-type question + its oily-skin recommendation come first: "skin" wins over the generic
  // "recommend" bucket, and "oily" wins over the "scrub" detail bucket below.
  if (has("skin type", "skin")) key = "skin_type";
  else if (has("oily")) key = "recommend_facescrub";
  else if (has("recommend", "similar", "more like", "like this", "show more", "more product", "more item", "suggest", "complement", "pairing", "pair with", "add on", "addition", "routine", "detox", "regimen")) key = "recommendations";
  else if (has("exchange", "replace", "replacement")) key = "exchange";
  else if (has("order", "track")) key = "order_list";
  else if (has("address", "deliver")) key = "address_confirm";
  else if (has("carousel", "range", "catalog", "catalogue", "lineup", "collection")) key = "carousel_slate";
  // Priority 2 — product-detail cards (scrub before wash so "facescrub" never matches "wash").
  else if (has("face scrub", "facescrub", "scrub")) key = "detail_facescrub";
  else if (has("face wash", "facewash")) key = "detail_facewash";
  else if (has("body wash", "bodywash")) key = "detail_bodywash";
  else if (has("shampoo")) key = "detail_shampoo";

  if (key && CARD_BY_KEY[key]) return { key, card: CARD_BY_KEY[key] };

  // Last-resort fuzzy contains against canonical keys.
  for (const ck of Object.keys(CARD_BY_KEY)) {
    if (ck.includes(raw) || raw.includes(ck)) return { key: ck, card: CARD_BY_KEY[ck] };
  }
  return { key: raw, card: null };
}

// A short caption to show as the chat text accompanying a card (most cards are
// self-contained, so this is usually empty and the card body carries the copy).
export function cardCaption(key: string): string {
  void key;
  return "";
}
