/**
 * Aster WhatsApp demo card catalog — port of the Next.js app's `src/lib/catalog.ts`.
 * The Apex controller (de_AsterAgentController) returns a canonical cardKey; this module maps
 * that key to the WhatsApp interactive payload the chat component renders inline.
 *
 * Images are served from the existing public Vercel origin so the mock and this LWR surface
 * stay byte-identical. Swap APP_ORIGIN if you host the images elsewhere.
 */
const APP_ORIGIN = "https://replace-me-mock-ui.example.com";
const IMG = (file) => `${APP_ORIGIN}/${file}`;

const PRODUCT_URL = {
  facewash: "https://asteroak.example/products/ylang-ylang-slate-face-wash",
  bodywash: "https://asteroak.example/products/lemongrass-cinnamon-slate-body-wash",
  shampoo: "https://asteroak.example/products/pepper-mint-clove-slate-shampoo-peppermint",
  facescrub: "https://asteroak.example/products/slate-face-scrub",
};

const SLATE_CAROUSEL = {
  type: "carousel",
  body: {
    text: "Hey Alex! 👋 Upgrade your grooming game with our premium *Slate Range*. Deep cleanse, remove impurities, and get that natural glow. Check out our top picks for you below! 👇",
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

const DETAIL_FACEWASH = {
  type: "button",
  header: { type: "image", image: { link: IMG("slate-face-wash.png") } },
  body: {
    text: "Great choice! 🖤\n*Slate Face Wash (100ml)*\nInfused with Ylang-Ylang and Argan, this face wash goes deep into your pores to draw out dirt, pollution, and excess oil.\n\nPrice: ₹259",
  },
  action: {
    buttons: [
      { type: "reply", reply: { id: "buy_facewash", title: "Buy Now", payload: "Buy the Slate Face Wash" } },
      { type: "reply", reply: { id: "more_like_this", title: "Show More Like This", payload: "Show me more products like this" } },
    ],
  },
};

const DETAIL_BODYWASH = {
  type: "button",
  header: { type: "image", image: { link: IMG("slate-body-wash.png") } },
  body: {
    text: "Great pick! 🖤\n*Slate Body Wash (200ml)*\nActivated slate with Lemongrass & Cinnamon deep-cleans, detoxifies, and leaves your skin fresh all day — no dryness.\n\nPrice: ₹299",
  },
  action: {
    buttons: [
      { type: "reply", reply: { id: "buy_bodywash", title: "Buy Now", payload: "Buy the Slate Body Wash" } },
      { type: "reply", reply: { id: "more_like_this", title: "Show More Like This", payload: "Show me more products like this" } },
    ],
  },
};

const DETAIL_SHAMPOO = {
  type: "button",
  header: { type: "image", image: { link: IMG("slate-shampoo.png") } },
  body: {
    text: "Great pick! 🖤\n*Slate Shampoo (250ml)*\nPeppermint & Clove with activated slate clears buildup and dandruff, soothes the scalp, and adds a healthy shine.\n\nPrice: ₹299",
  },
  action: {
    buttons: [
      { type: "reply", reply: { id: "buy_shampoo", title: "Buy Now", payload: "Buy the Slate Shampoo" } },
      { type: "reply", reply: { id: "more_like_this", title: "Show More Like This", payload: "Show me more products like this" } },
    ],
  },
};

const DETAIL_FACESCRUB = {
  type: "button",
  header: { type: "image", image: { link: IMG("slate-face-scrub.png") } },
  body: {
    text: "*Slate Face Scrub (100g)*\nExfoliates dead skin, removes blackheads, and unplugs pores. Lemongrass and Eucalyptus leave you feeling instantly refreshed!\n\nPrice: ₹349",
  },
  action: {
    buttons: [
      { type: "cta_url", cta_url: { display_text: "View Product", url: PRODUCT_URL.facescrub } },
      { type: "reply", reply: { id: "buy_facescrub", title: "Buy Now", payload: "Buy the Slate Face Scrub" } },
    ],
  },
};

const SKIN_TYPE = {
  type: "button",
  body: { text: "To give you the best recommendation to pair with that, could you tell me your skin type? 🧴" },
  action: {
    buttons: [
      { type: "reply", reply: { id: "skin_oily", title: "Oily", payload: "My skin type is Oily" } },
      { type: "reply", reply: { id: "skin_dry", title: "Dry", payload: "My skin type is Dry" } },
      { type: "reply", reply: { id: "skin_normal", title: "Normal", payload: "My skin type is Normal" } },
    ],
  },
};

const RECOMMEND_FACESCRUB = {
  type: "button",
  header: { type: "image", image: { link: IMG("slate-face-scrub.png") } },
  body: {
    text: "Since you have oily skin, regular exfoliation is key to keeping your pores clear and controlling excess oil! 🖤\n\n*Slate Face Scrub (100g)*\nExfoliates dead skin, removes blackheads, and unplugs pores. Lemongrass & Eucalyptus leave you instantly refreshed.\n\nPrice: ₹349",
  },
  action: {
    buttons: [
      { type: "reply", reply: { id: "buy_facescrub", title: "Buy Now", payload: "Buy the Slate Face Scrub" } },
    ],
  },
};

const RECOMMENDATIONS_LIST = {
  type: "list",
  body: { text: "Here are some perfect additions to complete your Slate detox routine. Click below to view:" },
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

const ADDRESS_CONFIRM = {
  type: "button",
  body: {
    text: "Awesome! Adding 1x Slate Face Scrub to your cart. 🛒\n\nSince you're a returning gentleman, shall we deliver this to your saved address? 📍\nFlat 12B, Maple Residency, Lakeview Road, Springfield 000000",
  },
  action: {
    buttons: [
      { type: "reply", reply: { id: "addr_yes", title: "Yes, deliver here", payload: "Yes, deliver to my saved address" } },
      { type: "reply", reply: { id: "addr_new", title: "Add new address", payload: "I'd like to add a new address" } },
    ],
  },
};

const ORDER_LIST = {
  type: "list",
  body: { text: "Let's check your orders. Please select the order you wish to track from the list below:" },
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

const EXCHANGE_CARD = {
  type: "button",
  body: {
    text: "Thank you for sharing the photo. I apologize for the oversight. 🙏\n\nI can immediately process a *free replacement* for this item, and our delivery executive will collect the old one during drop-off.",
  },
  action: {
    buttons: [
      { type: "reply", reply: { id: "exchange_confirm", title: "Confirm Exchange", payload: "Confirm the free exchange" } },
      { type: "reply", reply: { id: "exchange_agent", title: "Speak to Agent", payload: "I'd like to speak to a human agent" } },
    ],
  },
};

export const CARD_BY_KEY = {
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

export const PAYMENT_LINK_RE = /checkout\/aster-8932/i;
