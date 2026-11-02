/**
 * Tests for de_AsterAgentController — the Agent API bridge for the Aster-WA LWR chat LWC.
 * Uses a single endpoint-branching HttpCalloutMock to cover the OAuth -> session -> message
 * callout chain, plus direct coverage of resolveCard / detectHandoff / extractText.
 */
@IsTest
private class de_AsterAgentControllerTest {

    /** Branches on endpoint: token / session / message. Message body is configurable. */
    private class ApiMock implements HttpCalloutMock {
        String messageBody;
        ApiMock(String messageBody) {
            this.messageBody = messageBody;
        }
        public HttpResponse respond(HttpRequest req) {
            HttpResponse res = new HttpResponse();
            res.setHeader('Content-Type', 'application/json');
            String ep = req.getEndpoint();
            if (ep.contains('/services/oauth2/token')) {
                res.setStatusCode(200);
                res.setBody('{"access_token":"tok_123","token_type":"Bearer"}');
            } else if (ep.endsWith('/sessions')) {
                res.setStatusCode(200);
                res.setBody('{"sessionId":"sess_abc"}');
            } else if (ep.contains('/messages')) {
                res.setStatusCode(200);
                res.setBody(messageBody);
            } else {
                res.setStatusCode(404);
                res.setBody('{}');
            }
            return res;
        }
    }

    private static void seedConfig() {
        insert new de_Aster_Config__c(
            SetupOwnerId = UserInfo.getOrganizationId(),
            Client_Id__c = 'cid',
            Client_Secret__c = 'csecret',
            Agent_Id__c = '0XxTEST000000001',
            Instance_Url__c = 'https://example.my.salesforce.com',
            Api_Version__c = '68.0'
        );
    }

    private static String messagesWith(String text) {
        return '{"messages":[{"type":"Text","message":' + JSON.serialize(text) + '}]}';
    }

    @IsTest
    static void testStartSession() {
        seedConfig();
        Test.setMock(HttpCalloutMock.class, new ApiMock(messagesWith('x')));
        Test.startTest();
        de_AsterAgentController.ChatReply r = de_AsterAgentController.startSession();
        Test.stopTest();
        System.assertEquals('sess_abc', r.agentSessionId, 'session id from mock');
    }

    @IsTest
    static void testSendMessageCard() {
        seedConfig();
        Test.setMock(HttpCalloutMock.class, new ApiMock(messagesWith('[[ASTER_CARD:carousel_slate]]')));
        Test.startTest();
        de_AsterAgentController.ChatReply r = de_AsterAgentController.sendMessage(null, 'Hi');
        Test.stopTest();
        System.assertEquals('carousel_slate', r.cardKey, 'carousel card resolved');
        System.assertEquals('', r.text, 'tag stripped -> empty text');
        System.assertEquals(false, r.handoff, 'no handoff');
    }

    @IsTest
    static void testShowMoreOverride() {
        seedConfig();
        // Agent mistakenly emits a detail tag on a "show more like this" turn -> skin_type.
        Test.setMock(HttpCalloutMock.class, new ApiMock(messagesWith('[[ASTER_CARD:detail_facewash]]')));
        Test.startTest();
        de_AsterAgentController.ChatReply r = de_AsterAgentController.sendMessage('sess_x', 'Show me more products like this');
        Test.stopTest();
        System.assertEquals('skin_type', r.cardKey, 'detail card overridden to skin_type');
    }

    @IsTest
    static void testPaymentNormalization() {
        seedConfig();
        Test.setMock(HttpCalloutMock.class, new ApiMock(messagesWith('Pay here https://pay.asteroak.example/checkout/ao-8932')));
        Test.startTest();
        de_AsterAgentController.ChatReply r = de_AsterAgentController.sendMessage('sess_x', 'Yes, deliver here');
        Test.stopTest();
        System.assert(r.text.contains('checkout/aster-8932'), 'canonical payment text');
        System.assert(r.text.contains('Free Shipping'), 'canonical lead-in copy');
        System.assertEquals('', r.cardKey, 'no card on payment');
    }

    @IsTest
    static void testPaymentPromiseSafetyNet() {
        seedConfig();
        // Agent narrates the payment step with no checkout URL and no card tag.
        Test.setMock(HttpCalloutMock.class, new ApiMock(messagesWith(
            '🛒 Order Summary:\nSlate Face Scrub\nDelivery to: Flat 402…\n\nReady to proceed to secure payment? Just tap the button below!')));
        Test.startTest();
        de_AsterAgentController.ChatReply r = de_AsterAgentController.sendMessage('sess_x', 'Yes, deliver to my saved address');
        Test.stopTest();
        System.assert(r.text.contains('checkout/aster-8932'), 'payment promise -> canonical link injected');
        System.assert(r.text.contains('Free Shipping'), 'canonical lead-in copy');
        System.assertEquals('', r.cardKey, 'no card on payment');
    }

    @IsTest
    static void testRedactedUrlRestore() {
        seedConfig();
        Test.setMock(HttpCalloutMock.class, new ApiMock(messagesWith('Please pay: URL_Redacted')));
        Test.startTest();
        de_AsterAgentController.ChatReply r = de_AsterAgentController.sendMessage('sess_x', 'pay');
        Test.stopTest();
        System.assert(r.text.contains('checkout/aster-8932'), 'redacted token -> payment copy');
    }

    @IsTest
    static void testHandoffCorporate() {
        seedConfig();
        Test.setMock(HttpCalloutMock.class, new ApiMock(messagesWith('Sure, happy to help.')));
        Test.startTest();
        de_AsterAgentController.ChatReply r = de_AsterAgentController.sendMessage('sess_x', 'I want to place a corporate order for Diwali gifts');
        Test.stopTest();
        System.assertEquals(true, r.handoff, 'corporate order triggers handoff');
    }

    @IsTest
    static void testPlainText() {
        seedConfig();
        Test.setMock(HttpCalloutMock.class, new ApiMock(messagesWith('Hello Alex!')));
        Test.startTest();
        de_AsterAgentController.ChatReply r = de_AsterAgentController.sendMessage('sess_x', 'hello');
        Test.stopTest();
        System.assertEquals('Hello Alex!', r.text, 'plain text passthrough');
        System.assertEquals('', r.cardKey, 'no card');
    }

    @IsTest
    static void testConfigMissing() {
        // No seedConfig() -> org defaults blank -> should throw.
        Test.setMock(HttpCalloutMock.class, new ApiMock(messagesWith('x')));
        Boolean threw = false;
        Test.startTest();
        try {
            de_AsterAgentController.startSession();
        } catch (Exception e) {
            threw = true;
        }
        Test.stopTest();
        System.assertEquals(true, threw, 'missing config throws');
    }

    // ---------- Live handoff (MIAW) ----------

    /** Branches on MIAW endpoint: token / create-conversation / send / entries. */
    private class MiawMock implements HttpCalloutMock {
        Integer createStatus;
        String entriesBody;
        MiawMock(Integer createStatus, String entriesBody) {
            this.createStatus = createStatus;
            this.entriesBody = entriesBody;
        }
        public HttpResponse respond(HttpRequest req) {
            HttpResponse res = new HttpResponse();
            res.setHeader('Content-Type', 'application/json');
            String ep = req.getEndpoint();
            if (ep.contains('/access-token')) {
                res.setStatusCode(200);
                res.setBody('{"accessToken":"miaw_tok","lastEventId":"42"}');
            } else if (ep.endsWith('/conversation')) {
                res.setStatusCode(createStatus);
                res.setBody('{}');
            } else if (ep.contains('/message')) {
                res.setStatusCode(202);
                res.setBody('{}');
            } else if (ep.contains('/entries')) {
                res.setStatusCode(200);
                res.setBody(entriesBody);
            } else {
                res.setStatusCode(404);
                res.setBody('{}');
            }
            return res;
        }
    }

    @IsTest
    static void testGetHandoffToken() {
        Test.setMock(HttpCalloutMock.class, new MiawMock(201, '{}'));
        Test.startTest();
        String tok = de_AsterAgentController.getHandoffToken();
        Test.stopTest();
        System.assertEquals('miaw_tok', tok, 'token parsed from MIAW response');
    }

    @IsTest
    static void testOpenConversationReady() {
        Test.setMock(HttpCalloutMock.class, new MiawMock(201, '{}'));
        Test.startTest();
        Boolean ok = de_AsterAgentController.openHandoffConversation('miaw_tok', 'cid-1');
        Test.stopTest();
        System.assertEquals(true, ok, '201 -> ready');
    }

    @IsTest
    static void testOpenConversationTransient() {
        Test.setMock(HttpCalloutMock.class, new MiawMock(503, '{}'));
        Test.startTest();
        Boolean ok = de_AsterAgentController.openHandoffConversation('miaw_tok', 'cid-1');
        Test.stopTest();
        System.assertEquals(false, ok, '503 -> retry (false), no throw');
    }

    @IsTest
    static void testSendHandoffMessage() {
        Test.setMock(HttpCalloutMock.class, new MiawMock(201, '{}'));
        Test.startTest();
        de_AsterAgentController.sendHandoffMessage('cid-1', 'miaw_tok', 'hello specialist');
        Test.stopTest();
        // No exception == pass (202 accepted).
        System.assert(true);
    }

    @IsTest
    static void testPollHandoffParsing() {
        // newest-first: a specialist Message, a customer echo (skipped), a routing result,
        // an agent-join participant change.
        String entries =
            '{"conversationEntries":[' +
              '{"entryType":"Message","identifier":"e1","senderDisplayName":"Priya",' +
                '"sender":{"role":"Agent"},"entryPayload":{"abstractMessage":{"staticContent":{"text":"Hi, I can help with your bulk order."}}}},' +
              '{"entryType":"ParticipantChanged","identifier":"e2","sender":{"role":"System"},' +
                '"entryPayload":{"entries":[{"operation":"add","participant":{"role":"Agent"}}]}},' +
              '{"entryType":"RoutingResult","identifier":"e3","sender":{"role":"System"},' +
                '"entryPayload":{"routingConfigurationDetails":{"routingConfigurationType":"QueueRoutingType"}}},' +
              '{"entryType":"Message","identifier":"e4","sender":{"role":"EndUser"},' +
                '"entryPayload":{"abstractMessage":{"staticContent":{"text":"I want a corporate order"}}}}' +
            ']}';
        Test.setMock(HttpCalloutMock.class, new MiawMock(201, entries));
        Test.startTest();
        List<de_AsterAgentController.HandoffEntry> out = de_AsterAgentController.pollHandoff('cid-1', 'miaw_tok');
        Test.stopTest();

        // EndUser echo dropped -> 3 items, chronological (reverse of input).
        System.assertEquals(3, out.size(), 'EndUser echo skipped');
        System.assertEquals('status', out[0].kind, 'routing status first (oldest)');
        System.assertEquals('status', out[1].kind, 'agent-join status');
        System.assertEquals('agentMessage', out[2].kind, 'specialist message last (newest)');
        System.assertEquals('Priya', out[2].senderName, 'sender name carried');
        System.assert(out[2].text.contains('bulk order'), 'specialist text parsed');
    }

    @IsTest
    static void testPollHandoffEmpty() {
        Test.setMock(HttpCalloutMock.class, new MiawMock(201, '{}'));
        Test.startTest();
        List<de_AsterAgentController.HandoffEntry> out = de_AsterAgentController.pollHandoff('cid-1', 'miaw_tok');
        Test.stopTest();
        System.assertEquals(0, out.size(), 'no entries -> empty list');
    }

    @IsTest
    static void testResolveCardAndHelpers() {
        // Direct coverage of the resolver's keyword branches + handoff + extractText.
        System.assertEquals('skin_type', de_AsterAgentController.resolveCard('Slate_SkinType_Question'));
        System.assertEquals('recommend_facescrub', de_AsterAgentController.resolveCard('Oily_Recommendation'));
        System.assertEquals('recommendations', de_AsterAgentController.resolveCard('more_like_this_items'));
        System.assertEquals('exchange', de_AsterAgentController.resolveCard('Replacement_Card'));
        System.assertEquals('order_list', de_AsterAgentController.resolveCard('Track_Order'));
        System.assertEquals('address_confirm', de_AsterAgentController.resolveCard('Deliver_Address'));
        System.assertEquals('carousel_slate', de_AsterAgentController.resolveCard('Slate_Range_Carousel'));
        System.assertEquals('detail_bodywash', de_AsterAgentController.resolveCard('Slate_BodyWash_Detail'));
        System.assertEquals('detail_shampoo', de_AsterAgentController.resolveCard('Shampoo_Detail'));
        System.assertEquals('__payment__', de_AsterAgentController.resolveCard('Checkout_Payment'));
        System.assertEquals('carousel_slate', de_AsterAgentController.resolveCard('carousel_slate'));

        System.assertEquals(true, de_AsterAgentController.detectHandoff('I want a human agent', ''));
        System.assertEquals(true, de_AsterAgentController.detectHandoff('', 'Transferring you to our corporate gifting manager'));
        System.assertEquals(false, de_AsterAgentController.detectHandoff('show me the face wash', 'Here you go'));

        System.assertEquals('a\nb', de_AsterAgentController.extractText('{"messages":[{"type":"Text","message":"a"},{"type":"Inform","text":"b"},{"type":"EndOfTurn"}]}'));
        System.assertEquals('', de_AsterAgentController.extractText('{}'));
    }
}
