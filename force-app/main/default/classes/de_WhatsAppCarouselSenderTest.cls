@IsTest
private class de_WhatsAppCarouselSenderTest {

    private class MockHttpSuccess implements HttpCalloutMock {
        public HttpResponse respond(HttpRequest req) {
            HttpResponse res = new HttpResponse();
            res.setStatusCode(200);
            res.setBody('{"messages":[{"id":"wamid.abc123"}]}');
            return res;
        }
    }

    private class MockHttpFailure implements HttpCalloutMock {
        public HttpResponse respond(HttpRequest req) {
            HttpResponse res = new HttpResponse();
            res.setStatusCode(400);
            res.setBody('{"error":{"message":"Invalid template"}}');
            return res;
        }
    }

    private class MockTemplateSuccess implements HttpCalloutMock {
        public HttpResponse respond(HttpRequest req) {
            HttpResponse res = new HttpResponse();
            res.setStatusCode(200);
            res.setBody('{"id":"1234567890","status":"PENDING"}');
            return res;
        }
    }

    @IsTest
    static void testSendCarouselSuccess() {
        Test.setMock(HttpCalloutMock.class, new MockHttpSuccess());

        de_WhatsAppCarouselSender.CarouselRequest req = new de_WhatsAppCarouselSender.CarouselRequest();
        req.recipientPhone = '+15555550100';
        req.templateName = 'test_carousel';
        req.languageCode = 'en_US';
        req.bodyVariablesJson = '["John","ORD123"]';
        req.cardsJson = '[{"imageUrl":"https://example.com/img1.jpg","bodyText":"Card 1","buttons":[{"type":"quick_reply","payload":"BUY1"}]},{"imageUrl":"https://example.com/img2.jpg","bodyText":"Card 2","buttons":[{"type":"url","url":"https://example.com/product2"}]}]';

        Test.startTest();
        List<de_WhatsAppCarouselSender.CarouselResponse> results = de_WhatsAppCarouselSender.sendCarousel(new List<de_WhatsAppCarouselSender.CarouselRequest>{ req });
        Test.stopTest();

        System.assertEquals(true, results[0].success);
        System.assertEquals('wamid.abc123', results[0].messageId);
    }

    @IsTest
    static void testSendCarouselFailure() {
        Test.setMock(HttpCalloutMock.class, new MockHttpFailure());

        de_WhatsAppCarouselSender.CarouselRequest req = new de_WhatsAppCarouselSender.CarouselRequest();
        req.recipientPhone = '+15555550100';
        req.templateName = 'bad_template';
        req.cardsJson = '[{"imageUrl":"https://example.com/img.jpg","bodyText":"Test"}]';

        Test.startTest();
        List<de_WhatsAppCarouselSender.CarouselResponse> results = de_WhatsAppCarouselSender.sendCarousel(new List<de_WhatsAppCarouselSender.CarouselRequest>{ req });
        Test.stopTest();

        System.assertEquals(false, results[0].success);
        System.assert(results[0].errorMessage.contains('400'));
    }

    @IsTest
    static void testSendCarouselWithVideo() {
        Test.setMock(HttpCalloutMock.class, new MockHttpSuccess());

        de_WhatsAppCarouselSender.CarouselRequest req = new de_WhatsAppCarouselSender.CarouselRequest();
        req.recipientPhone = '15555550100';
        req.templateName = 'video_carousel';
        req.cardsJson = '[{"videoUrl":"https://example.com/vid1.mp4","bodyText":"Video Card","buttons":[{"type":"quick_reply","payload":"WATCH"}]}]';

        Test.startTest();
        List<de_WhatsAppCarouselSender.CarouselResponse> results = de_WhatsAppCarouselSender.sendCarousel(new List<de_WhatsAppCarouselSender.CarouselRequest>{ req });
        Test.stopTest();

        System.assertEquals(true, results[0].success);
    }

    @IsTest
    static void testCreateTemplateSuccess() {
        Test.setMock(HttpCalloutMock.class, new MockTemplateSuccess());

        de_WhatsAppCarouselTemplateCreator.TemplateRequest req = new de_WhatsAppCarouselTemplateCreator.TemplateRequest();
        req.templateName = 'promo_carousel';
        req.languageCode = 'en_US';
        req.category = 'MARKETING';
        req.bodyText = 'Hi {{1}}, check out our latest offers!';
        req.cardsJson = '[{"headerType":"IMAGE","headerExample":"handle123","bodyText":"Product {{1}}","buttons":[{"type":"QUICK_REPLY","text":"Buy Now"},{"type":"URL","text":"View","url":"https://example.com/{{1}}"}]}]';

        Test.startTest();
        List<de_WhatsAppCarouselTemplateCreator.TemplateResponse> results = de_WhatsAppCarouselTemplateCreator.createTemplate(new List<de_WhatsAppCarouselTemplateCreator.TemplateRequest>{ req });
        Test.stopTest();

        System.assertEquals(true, results[0].success);
        System.assertEquals('1234567890', results[0].templateId);
    }
}
