public with sharing class de_WhatsAppCarouselBuilderCtrl {

    public class CardInput {
        @AuraEnabled public String contentVersionId;
        @AuraEnabled public String bodyText;
        @AuraEnabled public List<ButtonInput> buttons;
    }

    public class ButtonInput {
        @AuraEnabled public String type;
        @AuraEnabled public String text;
        @AuraEnabled public String url;
        @AuraEnabled public String payload;
    }

    public class TemplateResult {
        @AuraEnabled public Boolean success;
        @AuraEnabled public String templateId;
        @AuraEnabled public String templateStatus;
        @AuraEnabled public String errorMessage;
    }

    @AuraEnabled
    public static TemplateResult submitCarouselTemplate(String templateName, String language, String category, String headerText, String bodyText, String footerText, String cardsJson) {
        TemplateResult result = new TemplateResult();

        try {
            List<CardInput> cards = (List<CardInput>) JSON.deserialize(cardsJson, List<CardInput>.class);

            if (cards.isEmpty() || cards.size() < 2) {
                result.success = false;
                result.errorMessage = 'Carousel requires at least 2 cards.';
                return result;
            }
            if (cards.size() > 10) {
                result.success = false;
                result.errorMessage = 'Carousel supports a maximum of 10 cards.';
                return result;
            }

            // Carousel templates don't support separate HEADER/FOOTER components
            // Merge header (as bold) and footer into the body text
            String composedBody = '';
            if (String.isNotBlank(headerText)) {
                composedBody += '*' + headerText + '*\n\n';
            }
            composedBody += String.isNotBlank(bodyText) ? bodyText : '';
            if (String.isNotBlank(footerText)) {
                composedBody += '\n\n_' + footerText + '_';
            }

            List<String> handles = new List<String>();
            for (CardInput card : cards) {
                String handle = de_WhatsAppMediaUploader.uploadFileToMeta(card.contentVersionId);
                handles.add(handle);
            }

            de_WhatsApp_Config__mdt config = de_WhatsApp_Config__mdt.getInstance('de_Default');
            String wabaId = config.de_WABA_Id__c;
            String accessToken = config.de_Access_Token__c;

            Map<String, Object> payload = buildPayload(templateName, language, category, composedBody, cards, handles);

            HttpRequest req = new HttpRequest();
            req.setEndpoint('https://graph.facebook.com/v21.0/' + wabaId + '/message_templates');
            req.setMethod('POST');
            req.setHeader('Content-Type', 'application/json');
            req.setHeader('Authorization', 'Bearer ' + accessToken);
            req.setBody(JSON.serialize(payload));
            req.setTimeout(60000);

            Http http = new Http();
            HttpResponse resp = http.send(req);

            Map<String, Object> respBody = (Map<String, Object>) JSON.deserializeUntyped(resp.getBody());

            if (resp.getStatusCode() == 200 || resp.getStatusCode() == 201) {
                result.success = true;
                result.templateId = (String) respBody.get('id');
                result.templateStatus = (String) respBody.get('status');
            } else {
                result.success = false;
                Map<String, Object> err = (Map<String, Object>) respBody.get('error');
                if (err != null) {
                    result.errorMessage = (String) err.get('message');
                    String userMsg = (String) err.get('error_user_msg');
                    if (String.isNotBlank(userMsg)) {
                        result.errorMessage += ' — ' + userMsg;
                    }
                } else {
                    result.errorMessage = resp.getBody();
                }
            }
        } catch (Exception e) {
            result.success = false;
            result.errorMessage = e.getMessage();
        }

        return result;
    }

    private static List<String> extractVariableNames(String text) {
        List<String> vars = new List<String>();
        if (String.isBlank(text)) return vars;
        Pattern p = Pattern.compile('\\{\\{([^}]+)\\}\\}');
        Matcher m = p.matcher(text);
        while (m.find()) {
            vars.add(m.group(1).trim());
        }
        return vars;
    }

    private static Boolean hasNamedParams(String text) {
        if (String.isBlank(text)) return false;
        Pattern p = Pattern.compile('\\{\\{([^}]+)\\}\\}');
        Matcher m = p.matcher(text);
        if (m.find()) {
            String firstVar = m.group(1).trim();
            return !firstVar.isNumeric();
        }
        return false;
    }

    private static Map<String, Object> buildPayload(String name, String language, String category, String bodyText, List<CardInput> cards, List<String> handles) {
        Map<String, Object> payload = new Map<String, Object>();
        payload.put('name', name);
        payload.put('language', language);
        payload.put('category', category);

        // Detect if named parameters are used anywhere
        Boolean useNamedFormat = hasNamedParams(bodyText);
        if (!useNamedFormat) {
            for (CardInput card : cards) {
                if (hasNamedParams(card.bodyText)) {
                    useNamedFormat = true;
                    break;
                }
            }
        }

        if (useNamedFormat) {
            payload.put('parameter_format', 'NAMED');
        }

        List<Object> components = new List<Object>();

        if (String.isNotBlank(bodyText)) {
            Map<String, Object> bodyComp = new Map<String, Object>();
            bodyComp.put('type', 'BODY');
            bodyComp.put('text', bodyText);

            List<String> varNames = extractVariableNames(bodyText);
            if (!varNames.isEmpty()) {
                Map<String, Object> example = new Map<String, Object>();
                if (useNamedFormat) {
                    List<Object> namedParamsList = new List<Object>();
                    for (String varName : varNames) {
                        Map<String, String> paramObj = new Map<String, String>();
                        paramObj.put('param_name', varName);
                        paramObj.put('example', 'sample_' + varName);
                        namedParamsList.add(paramObj);
                    }
                    example.put('body_text_named_params', namedParamsList);
                } else {
                    List<String> positionalExamples = new List<String>();
                    for (Integer i = 1; i <= varNames.size(); i++) {
                        positionalExamples.add('sample' + i);
                    }
                    example.put('body_text', new List<Object>{ positionalExamples });
                }
                bodyComp.put('example', example);
            }

            components.add(bodyComp);
        }

        Map<String, Object> carouselComp = new Map<String, Object>();
        carouselComp.put('type', 'CAROUSEL');
        List<Object> carouselCards = new List<Object>();

        for (Integer i = 0; i < cards.size(); i++) {
            CardInput card = cards[i];
            List<Object> cardComponents = new List<Object>();

            Map<String, Object> headerComp = new Map<String, Object>();
            headerComp.put('type', 'HEADER');
            headerComp.put('format', 'IMAGE');
            Map<String, Object> headerExample = new Map<String, Object>();
            headerExample.put('header_handle', new List<String>{ handles[i] });
            headerComp.put('example', headerExample);
            cardComponents.add(headerComp);

            Map<String, Object> cardBody = new Map<String, Object>();
            cardBody.put('type', 'BODY');
            String cardText = String.isNotBlank(card.bodyText) ? card.bodyText : 'Card ' + (i + 1);

            // Card bodies only support positional {{1}} format
            // Convert any named params to positional
            List<String> cardVarNames = extractVariableNames(cardText);
            List<String> cardExampleValues = new List<String>();
            if (!cardVarNames.isEmpty()) {
                Integer pos = 1;
                for (String varName : cardVarNames) {
                    if (!varName.isNumeric()) {
                        cardText = cardText.replace('{{' + varName + '}}', '{{' + pos + '}}');
                    }
                    cardExampleValues.add('sample_' + varName);
                    pos++;
                }
            }
            cardBody.put('text', cardText);

            if (!cardExampleValues.isEmpty()) {
                Map<String, Object> cardBodyExample = new Map<String, Object>();
                cardBodyExample.put('body_text', new List<Object>{ cardExampleValues });
                cardBody.put('example', cardBodyExample);
            }

            cardComponents.add(cardBody);

            if (card.buttons != null && !card.buttons.isEmpty()) {
                List<Object> buttonsList = new List<Object>();
                for (ButtonInput btn : card.buttons) {
                    Map<String, Object> buttonObj = new Map<String, Object>();
                    buttonObj.put('type', btn.type.toUpperCase());
                    buttonObj.put('text', btn.text);
                    if (btn.type.equalsIgnoreCase('URL') && String.isNotBlank(btn.url)) {
                        buttonObj.put('url', btn.url);
                        if (btn.url.contains('{{')) {
                            buttonObj.put('example', new List<String>{ 'https://example.com/sample' });
                        }
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
