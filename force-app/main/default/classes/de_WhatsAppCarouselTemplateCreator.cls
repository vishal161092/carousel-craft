public with sharing class de_WhatsAppCarouselTemplateCreator {

    public class TemplateRequest {
        @InvocableVariable(required=true label='Template Name' description='Lowercase alphanumeric with underscores only')
        public String templateName;

        @InvocableVariable(label='Language Code' description='e.g. en_US')
        public String languageCode;

        @InvocableVariable(label='Category' description='MARKETING or UTILITY')
        public String category;

        @InvocableVariable(label='Body Text' description='Template body with {{1}} placeholders')
        public String bodyText;

        @InvocableVariable(required=true label='Cards JSON' description='JSON array of card definitions for the carousel')
        public String cardsJson;
    }

    public class TemplateResponse {
        @InvocableVariable
        public Boolean success;
        @InvocableVariable
        public String templateId;
        @InvocableVariable
        public String errorMessage;
    }

    public class TemplateCardDef {
        public String headerType;
        public String headerExample;
        public String bodyText;
        public List<TemplateButtonDef> buttons;
    }

    public class TemplateButtonDef {
        public String type;
        public String text;
        public String url;
        public String phoneNumber;
        public String payload;
    }

    @InvocableMethod(label='Create WhatsApp Carousel Template' description='Creates a carousel template via Meta Graph API for approval' category='Messaging')
    public static List<TemplateResponse> createTemplate(List<TemplateRequest> requests) {
        List<TemplateResponse> responses = new List<TemplateResponse>();
        for (TemplateRequest req : requests) {
            responses.add(createSingleTemplate(req));
        }
        return responses;
    }

    @TestVisible
    private static de_WhatsApp_Config__mdt getConfig() {
        return de_WhatsApp_Config__mdt.getInstance('de_Default');
    }

    private static TemplateResponse createSingleTemplate(TemplateRequest req) {
        TemplateResponse resp = new TemplateResponse();
        try {
            de_WhatsApp_Config__mdt config = getConfig();
            String wabaId = config.de_WABA_Id__c;
            String accessToken = config.de_Access_Token__c;

            String langCode = String.isNotBlank(req.languageCode) ? req.languageCode : 'en_US';
            String category = String.isNotBlank(req.category) ? req.category.toUpperCase() : 'MARKETING';

            List<TemplateCardDef> cards = (List<TemplateCardDef>) JSON.deserialize(req.cardsJson, List<TemplateCardDef>.class);

            Map<String, Object> payload = buildTemplatePayload(req.templateName, langCode, category, req.bodyText, cards);

            HttpRequest httpReq = new HttpRequest();
            httpReq.setEndpoint('https://graph.facebook.com/v21.0/' + wabaId + '/message_templates');
            httpReq.setMethod('POST');
            httpReq.setHeader('Content-Type', 'application/json');
            httpReq.setHeader('Authorization', 'Bearer ' + accessToken);
            httpReq.setBody(JSON.serialize(payload));
            httpReq.setTimeout(30000);

            Http http = new Http();
            HttpResponse httpResp = http.send(httpReq);

            if (httpResp.getStatusCode() == 200 || httpResp.getStatusCode() == 201) {
                Map<String, Object> result = (Map<String, Object>) JSON.deserializeUntyped(httpResp.getBody());
                resp.templateId = (String) result.get('id');
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

    private static Map<String, Object> buildTemplatePayload(String name, String langCode, String category, String bodyText, List<TemplateCardDef> cards) {
        Map<String, Object> payload = new Map<String, Object>();
        payload.put('name', name);
        payload.put('language', langCode);
        payload.put('category', category);

        List<Object> components = new List<Object>();

        if (String.isNotBlank(bodyText)) {
            Map<String, Object> bodyComp = new Map<String, Object>();
            bodyComp.put('type', 'BODY');
            bodyComp.put('text', bodyText);
            components.add(bodyComp);
        }

        Map<String, Object> carouselComp = new Map<String, Object>();
        carouselComp.put('type', 'CAROUSEL');
        List<Object> carouselCards = new List<Object>();

        for (TemplateCardDef card : cards) {
            List<Object> cardComponents = new List<Object>();

            Map<String, Object> headerComp = new Map<String, Object>();
            headerComp.put('type', 'HEADER');
            String headerFormat = String.isNotBlank(card.headerType) ? card.headerType.toUpperCase() : 'IMAGE';
            headerComp.put('format', headerFormat);
            if (String.isNotBlank(card.headerExample)) {
                Map<String, Object> example = new Map<String, Object>();
                example.put('header_handle', new List<String>{ card.headerExample });
                headerComp.put('example', example);
            }
            cardComponents.add(headerComp);

            Map<String, Object> cardBody = new Map<String, Object>();
            cardBody.put('type', 'BODY');
            cardBody.put('text', String.isNotBlank(card.bodyText) ? card.bodyText : 'Card details');
            cardComponents.add(cardBody);

            if (card.buttons != null && !card.buttons.isEmpty()) {
                List<Object> buttonsList = new List<Object>();
                for (TemplateButtonDef btn : card.buttons) {
                    Map<String, Object> buttonObj = new Map<String, Object>();
                    buttonObj.put('type', btn.type.toUpperCase());
                    buttonObj.put('text', btn.text);
                    if (btn.type.equalsIgnoreCase('URL') && String.isNotBlank(btn.url)) {
                        buttonObj.put('url', btn.url);
                    } else if (btn.type.equalsIgnoreCase('PHONE_NUMBER') && String.isNotBlank(btn.phoneNumber)) {
                        buttonObj.put('phone_number', btn.phoneNumber);
                    }
                    buttonsList.add(buttonObj);
                }
                Map<String, Object> buttonsComp = new Map<String, Object>();
                buttonsComp.put('type', 'BUTTONS');
                buttonsComp.put('buttons', buttonsList);
                cardComponents.add(buttonsComp);
            }

            carouselCards.add(new Map<String, Object>{ 'components' => cardComponents });
        }

        carouselComp.put('cards', carouselCards);
        components.add(carouselComp);

        payload.put('components', components);
        return payload;
    }
}
