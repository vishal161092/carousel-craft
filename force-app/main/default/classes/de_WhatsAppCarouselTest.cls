public with sharing class de_WhatsAppCarouselTest {

    public static void sendCarousel(String recipientPhone) {
        de_WhatsApp_Config__mdt config = de_WhatsApp_Config__mdt.getInstance('de_Default');
        String phoneNumberId = config.de_Phone_Number_Id__c;
        String accessToken = config.de_Access_Token__c;

        String phone = recipientPhone.replaceAll('[^0-9]', '');

        Map<String, Object> payload = new Map<String, Object>{
            'messaging_product' => 'whatsapp',
            'recipient_type' => 'individual',
            'to' => phone,
            'type' => 'interactive',
            'interactive' => new Map<String, Object>{
                'type' => 'carousel',
                'body' => new Map<String, Object>{
                    'text' => 'Check out our latest products!'
                },
                'action' => new Map<String, Object>{
                    'cards' => new List<Object>{
                        new Map<String, Object>{
                            'card_index' => 0,
                            'type' => 'cta_url',
                            'header' => new Map<String, Object>{
                                'type' => 'image',
                                'image' => new Map<String, Object>{
                                    'link' => 'https://picsum.photos/800/450?1'
                                }
                            },
                            'body' => new Map<String, Object>{
                                'text' => 'Premium Cat Toy'
                            },
                            'action' => new Map<String, Object>{
                                'name' => 'cta_url',
                                'parameters' => new Map<String, Object>{
                                    'display_text' => 'Buy Now',
                                    'url' => 'https://example.com/product1'
                                }
                            }
                        },
                        new Map<String, Object>{
                            'card_index' => 1,
                            'type' => 'cta_url',
                            'header' => new Map<String, Object>{
                                'type' => 'image',
                                'image' => new Map<String, Object>{
                                    'link' => 'https://picsum.photos/800/450?2'
                                }
                            },
                            'body' => new Map<String, Object>{
                                'text' => 'Luxury Cat Bed'
                            },
                            'action' => new Map<String, Object>{
                                'name' => 'cta_url',
                                'parameters' => new Map<String, Object>{
                                    'display_text' => 'Buy Now',
                                    'url' => 'https://example.com/product2'
                                }
                            }
                        }
                    }
                }
            }
        };

        HttpRequest req = new HttpRequest();
        req.setEndpoint('https://graph.facebook.com/v25.0/' + phoneNumberId + '/messages');
        req.setMethod('POST');
        req.setHeader('Content-Type', 'application/json');
        req.setHeader('Authorization', 'Bearer ' + accessToken);
        req.setBody(JSON.serialize(payload));
        req.setTimeout(30000);

        Http http = new Http();
        HttpResponse res = http.send(req);

        System.debug('Status: ' + res.getStatusCode());
        System.debug('Body: ' + res.getBody());
    }
}
