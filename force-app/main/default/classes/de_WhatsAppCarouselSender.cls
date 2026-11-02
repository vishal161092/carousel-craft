public with sharing class de_WhatsAppCarouselSender {

    public class CarouselRequest {
        @InvocableVariable(required=true label='Recipient Phone Number' description='E.164 format e.g. +15555550100')
        public String recipientPhone;

        @InvocableVariable(required=true label='Template Name' description='Approved carousel template name in Meta')
        public String templateName;

        @InvocableVariable(label='Language Code' description='Template language code e.g. en_US')
        public String languageCode;

        @InvocableVariable(label='Body Variables JSON' description='JSON array of body parameter values e.g. ["John","Order123"]')
        public String bodyVariablesJson;

        @InvocableVariable(required=true label='Cards JSON' description='JSON array of card objects with imageUrl/videoUrl, bodyText, and buttons')
        public String cardsJson;
    }

    public class CarouselResponse {
        @InvocableVariable
        public Boolean success;
        @InvocableVariable
        public String messageId;
        @InvocableVariable
        public String errorMessage;
    }

    public class CardData {
        public String imageUrl;
        public String videoUrl;
        public String bodyText;
        public List<ButtonData> buttons;
    }

    public class ButtonData {
        public String type;
        public String payload;
        public String url;
    }

    @InvocableMethod(label='Send WhatsApp Carousel' description='Sends a carousel template message via WhatsApp Cloud API' category='Messaging')
    public static List<CarouselResponse> sendCarousel(List<CarouselRequest> requests) {
        List<CarouselResponse> responses = new List<CarouselResponse>();
        for (CarouselRequest req : requests) {
            responses.add(sendSingleCarousel(req));
        }
        return responses;
    }

    @TestVisible
    private static de_WhatsApp_Config__mdt getConfig() {
        return de_WhatsApp_Config__mdt.getInstance('de_Default');
    }

    private static CarouselResponse sendSingleCarousel(CarouselRequest req) {
        CarouselResponse resp = new CarouselResponse();
        try {
            de_WhatsApp_Config__mdt config = getConfig();
            String phoneNumberId = config.de_Phone_Number_Id__c;
            String accessToken = config.de_Access_Token__c;

            String recipientPhone = req.recipientPhone.replaceAll('[^0-9]', '');
            String langCode = String.isNotBlank(req.languageCode) ? req.languageCode : 'en_US';

            List<CardData> cards = (List<CardData>) JSON.deserialize(req.cardsJson, List<CardData>.class);

            Map<String, Object> payload = buildCarouselPayload(recipientPhone, req.templateName, langCode, req.bodyVariablesJson, cards);

            String jsonBody = JSON.serialize(payload);

            HttpRequest httpReq = new HttpRequest();
            httpReq.setEndpoint('https://graph.facebook.com/v21.0/' + phoneNumberId + '/messages');
            httpReq.setMethod('POST');
            httpReq.setHeader('Content-Type', 'application/json');
            httpReq.setHeader('Authorization', 'Bearer ' + accessToken);
            httpReq.setBody(jsonBody);
            httpReq.setTimeout(30000);

            Http http = new Http();
            HttpResponse httpResp = http.send(httpReq);

            if (httpResp.getStatusCode() == 200 || httpResp.getStatusCode() == 201) {
                Map<String, Object> result = (Map<String, Object>) JSON.deserializeUntyped(httpResp.getBody());
                List<Object> messages = (List<Object>) result.get('messages');
                if (messages != null && !messages.isEmpty()) {
                    Map<String, Object> msg = (Map<String, Object>) messages[0];
                    resp.messageId = (String) msg.get('id');
                }
                resp.success = true;
            } else {
                resp.success = false;
                resp.errorMessage = 'HTTP ' + httpResp.getStatusCode() + ': ' + httpResp.getBody();
            }
        } catch (Exception e) {
            resp.success = false;
            resp.errorMessage = e.getMessage();
        }
        return resp;
    }

    private static Map<String, Object> buildCarouselPayload(String phone, String templateName, String langCode, String bodyVarsJson, List<CardData> cards) {
        Map<String, Object> payload = new Map<String, Object>();
        payload.put('messaging_product', 'whatsapp');
        payload.put('recipient_type', 'individual');
        payload.put('to', phone);
        payload.put('type', 'template');

        Map<String, Object> template = new Map<String, Object>();
        template.put('name', templateName);

        Map<String, Object> language = new Map<String, Object>();
        language.put('code', langCode);
        template.put('language', language);

        List<Object> components = new List<Object>();

        if (String.isNotBlank(bodyVarsJson)) {
            List<String> bodyVars = (List<String>) JSON.deserialize(bodyVarsJson, List<String>.class);
            if (!bodyVars.isEmpty()) {
                Map<String, Object> bodyComp = new Map<String, Object>();
                bodyComp.put('type', 'body');
                List<Object> bodyParams = new List<Object>();
                for (String val : bodyVars) {
                    Map<String, Object> param = new Map<String, Object>();
                    param.put('type', 'text');
                    param.put('text', val);
                    bodyParams.add(param);
                }
                bodyComp.put('parameters', bodyParams);
                components.add(bodyComp);
            }
        }

        for (Integer i = 0; i < cards.size(); i++) {
            CardData card = cards[i];
            Map<String, Object> cardComp = new Map<String, Object>();
            cardComp.put('type', 'CAROUSEL');
            cardComp.put('card_index', i);

            List<Object> cardComponents = new List<Object>();

            Map<String, Object> headerComp = new Map<String, Object>();
            headerComp.put('type', 'header');
            List<Object> headerParams = new List<Object>();
            Map<String, Object> headerParam = new Map<String, Object>();

            if (String.isNotBlank(card.imageUrl)) {
                headerParam.put('type', 'image');
                Map<String, Object> imageObj = new Map<String, Object>();
                imageObj.put('link', card.imageUrl);
                headerParam.put('image', imageObj);
            } else if (String.isNotBlank(card.videoUrl)) {
                headerParam.put('type', 'video');
                Map<String, Object> videoObj = new Map<String, Object>();
                videoObj.put('link', card.videoUrl);
                headerParam.put('video', videoObj);
            }
            headerParams.add(headerParam);
            headerComp.put('parameters', headerParams);
            cardComponents.add(headerComp);

            if (String.isNotBlank(card.bodyText)) {
                Map<String, Object> cardBody = new Map<String, Object>();
                cardBody.put('type', 'body');
                List<Object> cardBodyParams = new List<Object>();
                Map<String, Object> cardBodyParam = new Map<String, Object>();
                cardBodyParam.put('type', 'text');
                cardBodyParam.put('text', card.bodyText);
                cardBodyParams.add(cardBodyParam);
                cardBody.put('parameters', cardBodyParams);
                cardComponents.add(cardBody);
            }

            if (card.buttons != null) {
                for (Integer b = 0; b < card.buttons.size(); b++) {
                    ButtonData btn = card.buttons[b];
                    Map<String, Object> buttonComp = new Map<String, Object>();
                    buttonComp.put('type', 'button');
                    buttonComp.put('sub_type', btn.type);
                    buttonComp.put('index', b);
                    List<Object> buttonParams = new List<Object>();
                    Map<String, Object> buttonParam = new Map<String, Object>();
                    if (btn.type == 'quick_reply') {
                        buttonParam.put('type', 'payload');
                        buttonParam.put('payload', btn.payload);
                    } else if (btn.type == 'url') {
                        buttonParam.put('type', 'text');
                        buttonParam.put('text', btn.url);
                    }
                    buttonParams.add(buttonParam);
                    buttonComp.put('parameters', buttonParams);
                    cardComponents.add(buttonComp);
                }
            }

            cardComp.put('cards', cardComponents);
            components.add(cardComp);
        }

        template.put('components', components);
        payload.put('template', template);
        return payload;
    }
}
