@isTest
private class de_AsterWhatsAppTest {

    private class MockOk implements HttpCalloutMock {
        public HttpResponse respond(HttpRequest req) {
            HttpResponse res = new HttpResponse();
            res.setStatusCode(200);
            res.setBody('{"messages":[{"id":"wamid.test"}]}');
            return res;
        }
    }

    private class MockError implements HttpCalloutMock {
        public HttpResponse respond(HttpRequest req) {
            HttpResponse r = new HttpResponse();
            r.setStatusCode(500);
            r.setBody('error');
            return r;
        }
    }

    @isTest
    static void allActionsReturnTags() {
        Test.setMock(HttpCalloutMock.class, new MockOk());
        Test.startTest();

        System.assertEquals('[[ASTER_CARD:carousel_slate]]',
            de_SendProductCarousel.send(null)[0], 'carousel tag');

        System.assertEquals('[[ASTER_CARD:recommendations]]',
            de_SendRecommendations.send(null)[0], 'recommendations tag');

        System.assertEquals('[[ASTER_CARD:address_confirm]]',
            de_SendAddressConfirm.send(null)[0], 'address tag');

        System.assertEquals('[[ASTER_CARD:order_list]]',
            de_SendOrderList.send(null)[0], 'order list tag');

        System.assertEquals('[[ASTER_CARD:exchange]]',
            de_SendExchangeCard.send(null)[0], 'exchange tag');

        Test.stopTest();
    }

    @isTest
    static void productDetailRoutesByKey() {
        Test.setMock(HttpCalloutMock.class, new MockOk());

        de_SendProductDetail.Request fw = new de_SendProductDetail.Request();
        fw.productKey = 'facewash';
        de_SendProductDetail.Request fs = new de_SendProductDetail.Request();
        fs.productKey = 'facescrub';
        de_SendProductDetail.Request bw = new de_SendProductDetail.Request();
        bw.productKey = 'bodywash';
        de_SendProductDetail.Request sh = new de_SendProductDetail.Request();
        sh.productKey = 'shampoo';
        de_SendProductDetail.Request blank = new de_SendProductDetail.Request();

        Test.startTest();
        System.assertEquals('[[ASTER_CARD:detail_facewash]]', de_SendProductDetail.send(new List<de_SendProductDetail.Request>{ fw })[0]);
        System.assertEquals('[[ASTER_CARD:detail_facescrub]]', de_SendProductDetail.send(new List<de_SendProductDetail.Request>{ fs })[0]);
        System.assertEquals('[[ASTER_CARD:detail_bodywash]]', de_SendProductDetail.send(new List<de_SendProductDetail.Request>{ bw })[0]);
        System.assertEquals('[[ASTER_CARD:detail_shampoo]]', de_SendProductDetail.send(new List<de_SendProductDetail.Request>{ sh })[0]);
        System.assertEquals('[[ASTER_CARD:detail_facewash]]', de_SendProductDetail.send(new List<de_SendProductDetail.Request>{ blank })[0], 'defaults to facewash');
        Test.stopTest();
    }

    @isTest
    static void helperBuildsButtonsAndTolerates500() {
        // A non-200 response must not throw (delivery is best-effort).
        Test.setMock(HttpCalloutMock.class, new MockError());
        Test.startTest();
        Map<String, Object> reply = de_AsterWhatsApp.replyButton('x', 'X');
        System.assertEquals('reply', reply.get('type'));
        Map<String, Object> cta = de_AsterWhatsApp.ctaButton('Open', 'https://example.com');
        System.assertEquals('cta_url', cta.get('type'));
        System.assertEquals('[[ASTER_CARD:carousel_slate]]', de_SendProductCarousel.send(null)[0]);
        Test.stopTest();
    }
}
