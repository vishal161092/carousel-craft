/**
 * Shared helper for Aster & Oak WhatsApp demo actions.
 *
 * Each invocable action builds a production-grade WhatsApp interactive payload (identical in
 * shape to what graph.facebook.com/v{v}/{phoneId}/messages expects) and best-effort POSTs it
 * to the demo PWA webhook. Regardless of the POST result, the action returns a hidden routing
 * tag `[[ASTER_CARD:<key>]]` — the agent is instructed to reproduce the action output verbatim,
 * and the PWA strips the tag and renders the matching rich card inline (reliable path).
 *
 * To switch this demo to real WhatsApp: change WEBHOOK_URL to the Graph API messages endpoint
 * and add an `Authorization: Bearer <META_TOKEN>` header. The payload shape is unchanged.
 */
public with sharing class de_AsterWhatsApp {

    // Aster & Oak mock PWA webhook (Vercel). Update the host if the project name differs.
    public static final String WEBHOOK_URL =
        'https://replace-me-mock-ui.example.com/api/webhook?session=aster-demo-session';

    // Demo recipient (a placeholder WhatsApp id for the "Alex" persona).
    public static final String RECIPIENT = '15555550100';

    /** Returns the hidden PWA routing tag for a given card key. */
    public static String tag(String cardKey) {
        return '[[ASTER_CARD:' + cardKey + ']]';
    }

    /** Best-effort delivery of an interactive payload to the mock PWA (never throws). */
    public static void deliverInteractive(Map<String, Object> interactive) {
        Map<String, Object> payload = new Map<String, Object>{
            'messaging_product' => 'whatsapp',
            'recipient_type' => 'individual',
            'to' => RECIPIENT,
            'type' => 'interactive',
            'interactive' => interactive
        };
        post(payload);
    }

    private static void post(Map<String, Object> payload) {
        try {
            HttpRequest req = new HttpRequest();
            req.setEndpoint(WEBHOOK_URL);
            req.setMethod('POST');
            req.setHeader('Content-Type', 'application/json');
            req.setBody(JSON.serialize(payload));
            req.setTimeout(30000);
            new Http().send(req);
        } catch (Exception e) {
            // Swallow — the returned tag is the deliverable; the webhook render is a bonus.
            System.debug('de_AsterWhatsApp delivery skipped: ' + e.getMessage());
        }
    }

    /** Builds one carousel card (image header + body + button list). */
    public static Map<String, Object> card(Integer idx, String imageUrl, String bodyText, List<Object> buttons) {
        return new Map<String, Object>{
            'card_index' => idx,
            'header' => new Map<String, Object>{
                'type' => 'image',
                'image' => new Map<String, Object>{ 'link' => imageUrl }
            },
            'body' => new Map<String, Object>{ 'text' => bodyText },
            'action' => new Map<String, Object>{ 'buttons' => buttons }
        };
    }

    public static Map<String, Object> replyButton(String id, String title) {
        return new Map<String, Object>{
            'type' => 'reply',
            'reply' => new Map<String, Object>{ 'id' => id, 'title' => title }
        };
    }

    public static Map<String, Object> ctaButton(String displayText, String url) {
        return new Map<String, Object>{
            'type' => 'cta_url',
            'cta_url' => new Map<String, Object>{ 'display_text' => displayText, 'url' => url }
        };
    }
}
