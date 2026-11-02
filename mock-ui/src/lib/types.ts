export interface ReplyButton {
  type: string;
  reply?: {
    id: string;
    title: string;
    // Optional richer text sent to the agent when the button is tapped. Lets a short,
    // WhatsApp-faithful label ("Know More", "Buy Now") trigger an unambiguous agent
    // instruction ("Know more about the Slate Face Wash"). Falls back to `title`.
    payload?: string;
  };
  cta_url?: { display_text: string; url: string };
}

export interface CarouselCard {
  card_index: number;
  header: {
    type: "image" | "video";
    image?: { link: string };
    video?: { link: string };
  };
  body: { text: string };
  action: {
    name?: string;
    parameters?: { display_text: string; url: string };
    buttons?: ReplyButton[];
  };
}

export interface CarouselMessage {
  type: "carousel";
  body: { text: string };
  action: { cards: CarouselCard[] };
}

export interface ButtonMessage {
  type: "button";
  header?: { type: string; image?: { link: string }; text?: string };
  body: { text: string };
  action: {
    buttons: ReplyButton[];
  };
}

export interface ListRow {
  id: string;
  title: string;
  description?: string;
  // Optional richer text sent to the agent when the row is tapped (see ReplyButton.payload).
  payload?: string;
}

export interface ListMessage {
  type: "list";
  header?: { type: string; text: string };
  body: { text: string };
  footer?: { text: string };
  action: {
    button: string;
    sections: Array<{
      title: string;
      rows: ListRow[];
    }>;
  };
}

export type InteractiveContent = CarouselMessage | ButtonMessage | ListMessage;

export interface ChatMessage {
  id: string;
  direction: "incoming" | "outgoing";
  timestamp: number;
  type: "text" | "interactive" | "template" | "system" | "image";
  text?: string;
  interactive?: InteractiveContent;
  // For `type: "image"` (e.g. the customer uploading a photo of the product expiry date).
  imageUrl?: string;
  // For live-agent (MIAW) messages: the display name of the human agent.
  senderName?: string;
}
