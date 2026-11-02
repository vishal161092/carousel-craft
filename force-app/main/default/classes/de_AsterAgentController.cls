/**
 * Server-side bridge between the de_asterChat LWC (on the Aster-WA LWR site) and the Agentforce
 * Agent API. This is the Apex port of the Next.js `mock-ui/src/app/api/chat/route.ts`:
 *
 *   - client-credentials OAuth against the org token endpoint (creds from de_Aster_Config__c)
 *   - create an Agent API session / send a message (host: https://api.salesforce.com)
 *   - restore the redacted payment URL + normalize the checkout step to canonical copy
 *   - strip the hidden `[[ASTER_CARD:<key>]]` routing tag and resolve it to a catalog key
 *   - the "show more like this" safety net (stray detail card -> skin_type question)
 *   - human-handoff detection (corporate / "speak to agent")
 *
 * The LWC owns the card CATALOG (the carousel/button/list JSON) keyed by the cardKey this
 * controller returns, mirroring how route.ts returns a key and the browser renders the card.
 */
public with sharing class de_AsterAgentController {

    private static final String AGENT_API_BASE = 'https://api.salesforce.com/einstein/ai-agent/v1';
    private static final String PAYMENT_LINK = 'https://pay.asteroak.example/checkout/ao-8932';
    private static final String REDACTED_URL_TOKEN = 'URL_Redacted';
    private static final String PAYMENT_TEXT =
        'Perfect. Your total is ₹349 (Free Shipping applied!). Please complete your payment securely using the link below:\n🔗 ' + PAYMENT_LINK;

    // Canonical catalog keys the LWC can render. Keep in sync with de_catalog.js CARD_BY_KEY.
    private static final Set<String> KNOWN_KEYS = new Set<String>{
        'carousel_slate', 'detail_facewash', 'detail_bodywash', 'detail_shampoo',
        'detail_facescrub', 'skin_type', 'recommend_facescrub', 'recommendations',
        'address_confirm', 'order_list', 'exchange'
    };

    // Sentinel: the resolved "card" is actually the fixed payment TEXT, not a card.
    private static final String PAYMENT_KEY = '__payment__';

    private static final Pattern CARD_TAG = Pattern.compile('\\[\\[ASTER_CARD:([a-zA-Z_]+)\\]\\]');
    private static final Pattern WANTS_RECS = Pattern.compile('(?i)(more products like this|more like this|show me more|similar products|other products|recommend)');

    // The agent sometimes narrates the payment step ("…proceed to secure payment? Just tap the
    // button below") WITHOUT the checkout URL or a payment tag, so the customer sees a bubble
    // promising a button/link that was never generated. This catches that phrasing so we can
    // substitute the canonical payment copy (with the real link).
    private static final Pattern BOT_PROMISES_PAYMENT = Pattern.compile('(?i)(proceed to (secure )?payment|secure payment|complete your payment|tap the button below|payment (link|button))');

    // Handoff cues — ported from route.ts detectHandoff().
    private static final Pattern USER_HUMAN_NOUN = Pattern.compile('(?i)\\b(human|real person|live (agent|person|rep|representative|specialist)|customer (care|service)|a representative)\\b');
    private static final Pattern USER_HUMAN_VERB = Pattern.compile('(?i)\\b(speak|talk|chat|connect|transfer|escalate|route|reach|get|put me through|hand)\\b[^.?!\\n]{0,40}?\\b(agent|human|person|someone|somebody|specialist|representative|rep|your team|manager|concierge|advisor|expert)\\b');
    private static final Pattern USER_CORPORATE = Pattern.compile('(?i)\\b(corporate|bulk|wholesale|business)\\b[^.?!\\n]{0,30}?\\b(order|gift|gifting|purchase|quantity|quote)\\b|\\b(corporate|bulk)\\s+(order|gift|gifting)\\b');
    private static final Pattern BOT_OFFERS_HUMAN = Pattern.compile('(?i)(transferring (you|chat)|connect(ing)? you (to|with)|hand you (over|off)|corporate gifting manager|our (specialized|human|corporate) (team|manager|specialist)|a (live|human) (agent|specialist|manager))');

    /** Reply DTO returned to the LWC. */
    public class ChatReply {
        @AuraEnabled public String agentSessionId;
        @AuraEnabled public String text;      // plain text to show (empty when a card carries the copy)
        @AuraEnabled public String cardKey;   // catalog key for the LWC to render ('' = none)
        @AuraEnabled public Boolean handoff;  // client should launch embedded messaging
        public ChatReply() {
            this.text = '';
            this.cardKey = '';
            this.handoff = false;
        }
    }

    /** Create a fresh Agent API session; returns the session id (no message exchanged). */
    @AuraEnabled
    public static ChatReply startSession() {
        de_Aster_Config__c cfg = config();
        String token = getAccessToken(cfg);
        ChatReply r = new ChatReply();
        r.agentSessionId = createSession(cfg, token);
        return r;
    }

    /**
     * Send one customer message and return the processed reply (text + optional card + handoff).
     * If agentSessionId is blank a new session is minted first.
     */
    @AuraEnabled
    public static ChatReply sendMessage(String agentSessionId, String userText) {
        de_Aster_Config__c cfg = config();
        String token = getAccessToken(cfg);

        String sid = String.isBlank(agentSessionId) ? createSession(cfg, token) : agentSessionId;

        String botText;
        try {
            botText = postMessage(cfg, token, sid, userText);
        } catch (CalloutException ce) {
            // Session likely expired — mint a new one and retry once.
            sid = createSession(cfg, token);
            botText = postMessage(cfg, token, sid, userText);
        }

        ChatReply r = new ChatReply();
        r.agentSessionId = sid;

        if (botText == null) {
            botText = '';
        }

        // Restore the payment link the Agent API strips out ("URL_Redacted").
        if (botText.contains(REDACTED_URL_TOKEN)) {
            botText = botText.replace(REDACTED_URL_TOKEN, PAYMENT_LINK);
        }

        // Normalize the checkout step to the canonical payment copy.
        if (botText.containsIgnoreCase('checkout/aster-8932')) {
            r.text = PAYMENT_TEXT;
            r.handoff = detectHandoff(userText, botText);
            return r;
        }

        // Safety net: the bot promised payment but emitted no checkout URL and no card tag
        // (e.g. an "Order Summary … tap the button below" preamble). Substitute the canonical
        // payment copy so the secure link always appears at this step.
        if (BOT_PROMISES_PAYMENT.matcher(botText).find() && !CARD_TAG.matcher(botText).find()) {
            r.text = PAYMENT_TEXT;
            r.handoff = detectHandoff(userText, botText);
            return r;
        }

        // Extract + resolve the hidden card tag.
        Matcher m = CARD_TAG.matcher(botText);
        if (m.find()) {
            String rawKey = m.group(1);
            String resolved = resolveCard(rawKey);
            String cleaned = CARD_TAG.matcher(botText).replaceAll('').trim();

            // Safety net: "show more like this" must open the skin-type question, never a
            // product-detail card.
            if (resolved != null && resolved.startsWith('detail_') && WANTS_RECS.matcher(userText == null ? '' : userText).find()) {
                resolved = 'skin_type';
            }

            if (PAYMENT_KEY.equals(resolved)) {
                r.text = PAYMENT_TEXT;
            } else if (resolved != null && KNOWN_KEYS.contains(resolved)) {
                r.cardKey = resolved;
                r.text = cleaned; // usually empty; the card body carries the copy
            } else {
                // Unresolved tag with no text -> leave both empty (LWC suppresses the bubble).
                r.text = cleaned;
            }
        } else {
            r.text = botText;
        }

        r.handoff = detectHandoff(userText, botText);
        return r;
    }

    // ========== Live human handoff via MIAW (custom-client) ==========
    // Port of mock-ui/src/lib/miaw.ts + /api/handoff/*. The Next.js app proxied an SSE stream;
    // Apex can't stream SSE to the browser, so the LWC instead POLLS pollHandoff() every few
    // seconds. Uses the API-type (Custom Client) deployment Aster_WA_Custom_Client.

    private static final String MIAW_SCRT2 = 'https://REPLACE_ME.my.salesforce-scrt.com';
    private static final String MIAW_ORG_ID = 'REPLACE_ME';      // 15-char org id (must match token)
    private static final String MIAW_ESD = 'Aster_WA_Custom_Client';    // API-type (Custom Client) deployment
    private static final String MIAW_BASE = MIAW_SCRT2 + '/iamessage/api/v2';

    /** One renderable item distilled from a MIAW conversation entry. */
    public class HandoffEntry {
        @AuraEnabled public String kind;        // 'agentMessage' | 'status'
        @AuraEnabled public String text;
        @AuraEnabled public String senderName;
        @AuraEnabled public String entryId;
    }

    /** Mint an unauthenticated guest MIAW token (same thing a browser MIAW SDK would hold). */
    @AuraEnabled
    public static String getHandoffToken() {
        HttpRequest req = new HttpRequest();
        req.setEndpoint(MIAW_BASE + '/authorization/unauthenticated/access-token');
        req.setMethod('POST');
        req.setHeader('Content-Type', 'application/json');
        req.setBody(JSON.serialize(new Map<String, Object>{
            'orgId' => MIAW_ORG_ID,
            'esDeveloperName' => MIAW_ESD,
            'capabilitiesVersion' => '1',
            'platform' => 'Web'
        }));
        req.setTimeout(60000);
        HttpResponse res = new Http().send(req);
        if (res.getStatusCode() != 200) {
            throw new AuraHandledException('MIAW token failed (' + res.getStatusCode() + '): ' + res.getBody());
        }
        Map<String, Object> body = (Map<String, Object>) JSON.deserializeUntyped(res.getBody());
        return (String) body.get('accessToken');
    }

    /**
     * Create the MIAW conversation. Returns true when created (or already exists); false on the
     * transient cold-start 503 so the LWC can retry after a short delay (Apex can't sleep). Any
     * other status throws.
     */
    @AuraEnabled
    public static Boolean openHandoffConversation(String token, String conversationId) {
        HttpRequest req = new HttpRequest();
        req.setEndpoint(MIAW_BASE + '/conversation');
        req.setMethod('POST');
        req.setHeader('Authorization', 'Bearer ' + token);
        req.setHeader('Content-Type', 'application/json');
        req.setBody(JSON.serialize(new Map<String, Object>{
            'conversationId' => conversationId,
            'esDeveloperName' => MIAW_ESD
        }));
        req.setTimeout(60000);
        HttpResponse res = new Http().send(req);
        Integer sc = res.getStatusCode();
        if (sc == 200 || sc == 201 || sc == 409) {
            return true;
        }
        if (sc == 503) {
            return false; // transient — LWC retries with backoff
        }
        throw new AuraHandledException('MIAW create conversation failed (' + sc + '): ' + res.getBody());
    }

    /** Send one customer (or primer) message into the live conversation. */
    @AuraEnabled
    public static void sendHandoffMessage(String conversationId, String token, String text) {
        HttpRequest req = new HttpRequest();
        req.setEndpoint(MIAW_BASE + '/conversation/' + conversationId + '/message');
        req.setMethod('POST');
        req.setHeader('Authorization', 'Bearer ' + token);
        req.setHeader('Content-Type', 'application/json');
        req.setBody(JSON.serialize(new Map<String, Object>{
            'message' => new Map<String, Object>{
                'id' => generateUuid(),
                'messageType' => 'StaticContentMessage',
                'staticContent' => new Map<String, Object>{ 'formatType' => 'Text', 'text' => text }
            },
            'esDeveloperName' => MIAW_ESD
        }));
        req.setTimeout(60000);
        HttpResponse res = new Http().send(req);
        Integer sc = res.getStatusCode();
        if (sc != 200 && sc != 202) {
            throw new AuraHandledException('MIAW send failed (' + sc + '): ' + res.getBody());
        }
    }

    /**
     * Poll the conversation's entries and distill them into renderable items (specialist
     * messages + a couple of status notes), oldest-first. The LWC dedups by entryId.
     */
    @AuraEnabled
    public static List<HandoffEntry> pollHandoff(String conversationId, String token) {
        HttpRequest req = new HttpRequest();
        req.setEndpoint(MIAW_BASE + '/conversation/' + conversationId + '/entries?limit=30');
        req.setMethod('GET');
        req.setHeader('Authorization', 'Bearer ' + token);
        req.setHeader('X-Org-Id', MIAW_ORG_ID);
        req.setTimeout(60000);
        HttpResponse res = new Http().send(req);
        if (res.getStatusCode() != 200) {
            // Transient/expired — return nothing; the LWC keeps polling.
            return new List<HandoffEntry>();
        }
        return parseHandoffEntries(res.getBody());
    }

    @TestVisible
    private static List<HandoffEntry> parseHandoffEntries(String responseBody) {
        List<HandoffEntry> out = new List<HandoffEntry>();
        Map<String, Object> body = (Map<String, Object>) JSON.deserializeUntyped(responseBody);
        List<Object> entries = (List<Object>) body.get('conversationEntries');
        if (entries == null) {
            return out;
        }
        // The API returns newest-first — walk in reverse so the LWC appends chronologically.
        for (Integer i = entries.size() - 1; i >= 0; i--) {
            Map<String, Object> e = (Map<String, Object>) entries[i];
            String entryType = (String) e.get('entryType');
            String entryId = (String) e.get('identifier');
            Map<String, Object> sender = (Map<String, Object>) e.get('sender');
            String role = sender == null ? '' : (String) sender.get('role');
            Map<String, Object> payload = (Map<String, Object>) e.get('entryPayload');
            String senderName = (String) e.get('senderDisplayName');

            if (entryType == 'Message') {
                if (role == 'EndUser') {
                    continue; // the customer's own echo — the LWC already shows that bubble
                }
                String text = messageText(payload);
                if (String.isBlank(text)) {
                    continue;
                }
                HandoffEntry h = new HandoffEntry();
                h.kind = 'agentMessage';
                h.text = text;
                h.senderName = String.isBlank(senderName) ? 'Aster Specialist' : senderName;
                h.entryId = entryId;
                out.add(h);
            } else if (entryType == 'RoutingResult') {
                if (payload != null && payload.get('routingConfigurationDetails') != null) {
                    out.add(statusEntry('Connecting you to our corporate gifting manager…', entryId));
                }
            } else if (entryType == 'ParticipantChanged') {
                if (participantAgentJoined(payload)) {
                    out.add(statusEntry('A Aster specialist has joined the chat 🧑‍💼', entryId));
                }
            }
        }
        return out;
    }

    private static String messageText(Map<String, Object> payload) {
        if (payload == null) {
            return '';
        }
        Map<String, Object> am = (Map<String, Object>) payload.get('abstractMessage');
        if (am == null) {
            return '';
        }
        Map<String, Object> sc = (Map<String, Object>) am.get('staticContent');
        if (sc == null) {
            return '';
        }
        Object t = sc.get('text');
        return t == null ? '' : String.valueOf(t);
    }

    private static Boolean participantAgentJoined(Map<String, Object> payload) {
        if (payload == null) {
            return false;
        }
        List<Object> entries = (List<Object>) payload.get('entries');
        if (entries == null) {
            return false;
        }
        for (Object o : entries) {
            Map<String, Object> pe = (Map<String, Object>) o;
            String op = (String) pe.get('operation');
            Map<String, Object> participant = (Map<String, Object>) pe.get('participant');
            String prole = participant == null ? '' : (String) participant.get('role');
            if (op == 'add' && prole == 'Agent') {
                return true;
            }
        }
        return false;
    }

    private static HandoffEntry statusEntry(String text, String entryId) {
        HandoffEntry h = new HandoffEntry();
        h.kind = 'status';
        h.text = text;
        h.entryId = entryId;
        return h;
    }

    // ---------- Agent API plumbing ----------

    private static de_Aster_Config__c config() {
        de_Aster_Config__c cfg = de_Aster_Config__c.getOrgDefaults();
        if (cfg == null || String.isBlank(cfg.Client_Id__c) || String.isBlank(cfg.Agent_Id__c)) {
            throw new AuraHandledException('Aster agent config is missing. Populate de_Aster_Config__c org defaults.');
        }
        return cfg;
    }

    private static String getAccessToken(de_Aster_Config__c cfg) {
        HttpRequest req = new HttpRequest();
        req.setEndpoint(cfg.Instance_Url__c + '/services/oauth2/token');
        req.setMethod('POST');
        req.setHeader('Content-Type', 'application/x-www-form-urlencoded');
        req.setBody(
            'grant_type=client_credentials' +
            '&client_id=' + EncodingUtil.urlEncode(cfg.Client_Id__c, 'UTF-8') +
            '&client_secret=' + EncodingUtil.urlEncode(cfg.Client_Secret__c, 'UTF-8')
        );
        req.setTimeout(60000);
        HttpResponse res = new Http().send(req);
        if (res.getStatusCode() != 200) {
            throw new AuraHandledException('OAuth failed (' + res.getStatusCode() + '): ' + res.getBody());
        }
        Map<String, Object> body = (Map<String, Object>) JSON.deserializeUntyped(res.getBody());
        return (String) body.get('access_token');
    }

    private static String createSession(de_Aster_Config__c cfg, String token) {
        Map<String, Object> payload = new Map<String, Object>{
            'externalSessionKey' => generateUuid(),
            'instanceConfig' => new Map<String, Object>{ 'endpoint' => cfg.Instance_Url__c },
            'streamingCapabilities' => new Map<String, Object>{ 'chunkTypes' => new List<String>{ 'Text' } },
            'bypassUser' => true
        };
        HttpRequest req = new HttpRequest();
        req.setEndpoint(AGENT_API_BASE + '/agents/' + cfg.Agent_Id__c + '/sessions');
        req.setMethod('POST');
        req.setHeader('Authorization', 'Bearer ' + token);
        req.setHeader('Content-Type', 'application/json');
        req.setBody(JSON.serialize(payload));
        req.setTimeout(60000);
        HttpResponse res = new Http().send(req);
        if (res.getStatusCode() != 200 && res.getStatusCode() != 201) {
            throw new AuraHandledException('Session creation failed (' + res.getStatusCode() + '): ' + res.getBody());
        }
        Map<String, Object> body = (Map<String, Object>) JSON.deserializeUntyped(res.getBody());
        return (String) body.get('sessionId');
    }

    private static String postMessage(de_Aster_Config__c cfg, String token, String sessionId, String userText) {
        Map<String, Object> payload = new Map<String, Object>{
            'message' => new Map<String, Object>{
                'sequenceId' => System.currentTimeMillis(),
                'type' => 'Text',
                'text' => userText
            }
        };
        HttpRequest req = new HttpRequest();
        req.setEndpoint(AGENT_API_BASE + '/sessions/' + sessionId + '/messages');
        req.setMethod('POST');
        req.setHeader('Authorization', 'Bearer ' + token);
        req.setHeader('Content-Type', 'application/json');
        req.setBody(JSON.serialize(payload));
        req.setTimeout(120000);
        HttpResponse res = new Http().send(req);
        if (res.getStatusCode() == 404) {
            throw new CalloutException('Session not found (404)');
        }
        if (res.getStatusCode() != 200) {
            throw new AuraHandledException('Agent message failed (' + res.getStatusCode() + '): ' + res.getBody());
        }
        return extractText(res.getBody());
    }

    /** Join the Text/Inform messages from an Agent API response body. */
    @TestVisible
    private static String extractText(String responseBody) {
        Map<String, Object> body = (Map<String, Object>) JSON.deserializeUntyped(responseBody);
        List<Object> messages = (List<Object>) body.get('messages');
        if (messages == null) {
            return '';
        }
        List<String> parts = new List<String>();
        for (Object o : messages) {
            Map<String, Object> msg = (Map<String, Object>) o;
            String type = (String) msg.get('type');
            if (type == 'Text' || type == 'Inform') {
                Object t = msg.get('message') != null ? msg.get('message') : msg.get('text');
                if (t != null && String.isNotBlank((String) t)) {
                    parts.add((String) t);
                }
            }
        }
        return String.join(parts, '\n');
    }

    // ---------- Card resolution (port of catalog.ts resolveCard) ----------

    @TestVisible
    private static String resolveCard(String rawKey) {
        String raw = (rawKey == null ? '' : rawKey).toLowerCase().trim();
        if (KNOWN_KEYS.contains(raw)) {
            return raw;
        }
        String norm = ' ' + raw.replaceAll('[^a-z]+', ' ').trim() + ' ';

        // Priority 0 — payment (text, not a card).
        if (has(norm, new List<String>{ 'payment', 'checkout', 'pay now', 'secure link' })) {
            return PAYMENT_KEY;
        }
        // Priority 1 — intent cards (skin/oily before the generic recommend + scrub buckets).
        if (has(norm, new List<String>{ 'skin type', 'skin' })) return 'skin_type';
        if (has(norm, new List<String>{ 'oily' })) return 'recommend_facescrub';
        if (has(norm, new List<String>{ 'recommend', 'similar', 'more like', 'like this', 'show more', 'more product', 'more item', 'suggest', 'complement', 'pairing', 'pair with', 'add on', 'addition', 'routine', 'detox', 'regimen' })) return 'recommendations';
        if (has(norm, new List<String>{ 'exchange', 'replace', 'replacement' })) return 'exchange';
        if (has(norm, new List<String>{ 'order', 'track' })) return 'order_list';
        if (has(norm, new List<String>{ 'address', 'deliver' })) return 'address_confirm';
        if (has(norm, new List<String>{ 'carousel', 'range', 'catalog', 'catalogue', 'lineup', 'collection' })) return 'carousel_slate';
        // Priority 2 — product-detail cards (scrub before wash).
        if (has(norm, new List<String>{ 'face scrub', 'facescrub', 'scrub' })) return 'detail_facescrub';
        if (has(norm, new List<String>{ 'face wash', 'facewash' })) return 'detail_facewash';
        if (has(norm, new List<String>{ 'body wash', 'bodywash' })) return 'detail_bodywash';
        if (has(norm, new List<String>{ 'shampoo' })) return 'detail_shampoo';

        // Last-resort fuzzy contains against canonical keys.
        for (String ck : KNOWN_KEYS) {
            if (ck.contains(raw) || raw.contains(ck)) {
                return ck;
            }
        }
        return null;
    }

    private static Boolean has(String norm, List<String> terms) {
        for (String t : terms) {
            if (norm.contains(t)) {
                return true;
            }
        }
        return false;
    }

    // ---------- Handoff ----------

    @TestVisible
    private static Boolean detectHandoff(String userText, String botText) {
        String u = userText == null ? '' : userText;
        String b = botText == null ? '' : botText;
        return USER_HUMAN_NOUN.matcher(u).find()
            || USER_HUMAN_VERB.matcher(u).find()
            || USER_CORPORATE.matcher(u).find()
            || BOT_OFFERS_HUMAN.matcher(b).find();
    }

    private static String generateUuid() {
        Blob b = Crypto.generateAesKey(128);
        String h = EncodingUtil.convertToHex(b);
        return h.substring(0, 8) + '-' + h.substring(8, 12) + '-' + h.substring(12, 16) + '-' + h.substring(16, 20) + '-' + h.substring(20, 32);
    }
}
