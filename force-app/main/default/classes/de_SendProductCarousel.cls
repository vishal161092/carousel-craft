/**
 * STEP 1 — Outbound Slate Range carousel (3 product cards).
 * Returns the PWA routing tag; the PWA renders the full carousel from its catalog.
 */
public with sharing class de_SendProductCarousel {

    private static final String IMG = 'https://replace-me-mock-ui.example.com/';
    private static final String PROD = 'https://asteroak.example/products/';

    @InvocableMethod(label='Send Slate Carousel' description='Sends the outbound Slate Range product carousel (Face Wash, Body Wash, Shampoo) to the customer\'s WhatsApp. Call once at the start of the promotional journey.' category='Aster')
    public static List<String> send(List<Request> requests) {
        List<String> results = new List<String>();
        for (Integer i = 0; i < (requests == null || requests.isEmpty() ? 1 : requests.size()); i++) {
            results.add(doSend());
        }
        return results;
    }

    private static String doSend() {
        List<Object> cards = new List<Object>{
            de_AsterWhatsApp.card(0, IMG + 'slate-face-wash.png',
                'Slate Face Wash | Ylang-Ylang & Argan | ₹259',
                new List<Object>{
                    de_AsterWhatsApp.ctaButton('View Product', PROD + 'slate-face-wash'),
                    de_AsterWhatsApp.replyButton('know_facewash', 'Know More')
                }),
            de_AsterWhatsApp.card(1, IMG + 'slate-body-wash.png',
                'Slate Body Wash | Lemongrass & Cinnamon | ₹299',
                new List<Object>{
                    de_AsterWhatsApp.ctaButton('View Product', PROD + 'slate-body-wash'),
                    de_AsterWhatsApp.replyButton('know_bodywash', 'Know More')
                }),
            de_AsterWhatsApp.card(2, IMG + 'slate-shampoo.png',
                'Slate Shampoo | Pepper Mint & Clove | ₹299',
                new List<Object>{
                    de_AsterWhatsApp.ctaButton('View Product', PROD + 'slate-shampoo'),
                    de_AsterWhatsApp.replyButton('know_shampoo', 'Know More')
                })
        };

        de_AsterWhatsApp.deliverInteractive(new Map<String, Object>{
            'type' => 'carousel',
            'body' => new Map<String, Object>{
                'text' => 'Hey Alex! 👋 Upgrade your grooming game with our premium Slate Range. Check out our top picks below! 👇'
            },
            'action' => new Map<String, Object>{ 'cards' => cards }
        });

        return de_AsterWhatsApp.tag('carousel_slate');
    }

    public class Request {
        @InvocableVariable(label='(unused)' description='No inputs required' required=false)
        public String ignore;
    }
}
