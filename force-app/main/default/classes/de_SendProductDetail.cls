/**
 * STEP 2 & 4 — Single product-detail card.
 * Input `productKey`: facewash | facescrub | bodywash | shampoo.
 * Returns the PWA routing tag for the matching detail card.
 */
public with sharing class de_SendProductDetail {

    private static final String IMG = 'https://replace-me-mock-ui.example.com/';
    private static final String PROD = 'https://asteroak.example/products/';

    @InvocableMethod(label='Send Product Detail' description='Sends a single product-detail card (image + description + Buy Now) to the customer\'s WhatsApp. Pass productKey = facewash or facescrub (also bodywash, shampoo).' category='Aster')
    public static List<String> send(List<Request> requests) {
        List<String> results = new List<String>();
        for (Request req : requests) {
            results.add(doSend(req == null ? null : req.productKey));
        }
        return results;
    }

    private static String doSend(String keyRaw) {
        String key = String.isBlank(keyRaw) ? 'facewash' : keyRaw.toLowerCase().trim();

        String img, bodyText, prodUrl, cardKey;
        List<Object> buttons;

        if (key.contains('scrub')) {
            cardKey = 'detail_facescrub';
            img = IMG + 'slate-face-scrub.png';
            prodUrl = PROD + 'slate-face-scrub';
            bodyText = 'Slate Face Scrub (100g)\nExfoliates dead skin, removes blackheads, and unplugs pores. Lemongrass and Eucalyptus leave you feeling instantly refreshed!\n\nPrice: ₹349';
            buttons = new List<Object>{
                de_AsterWhatsApp.ctaButton('View Product', prodUrl),
                de_AsterWhatsApp.replyButton('buy_facescrub', 'Buy Now')
            };
        } else if (key.contains('body')) {
            cardKey = 'detail_bodywash';
            img = IMG + 'slate-body-wash.png';
            prodUrl = PROD + 'slate-body-wash';
            bodyText = 'Slate Body Wash (300ml)\nLemongrass and Cinnamon deep-cleanse and refresh, washing away impurities and leaving skin energised.\n\nPrice: ₹299';
            buttons = new List<Object>{
                de_AsterWhatsApp.ctaButton('View Product', prodUrl),
                de_AsterWhatsApp.replyButton('buy_bodywash', 'Buy Now')
            };
        } else if (key.contains('shampoo')) {
            cardKey = 'detail_shampoo';
            img = IMG + 'slate-shampoo.png';
            prodUrl = PROD + 'slate-shampoo';
            bodyText = 'Slate Shampoo (250ml)\nPeppermint and Clove detoxify the scalp, control dandruff, and leave hair fresh and clean.\n\nPrice: ₹299';
            buttons = new List<Object>{
                de_AsterWhatsApp.ctaButton('View Product', prodUrl),
                de_AsterWhatsApp.replyButton('buy_shampoo', 'Buy Now')
            };
        } else {
            cardKey = 'detail_facewash';
            img = IMG + 'slate-face-wash.png';
            prodUrl = PROD + 'slate-face-wash';
            bodyText = 'Great choice! 🖤\nSlate Face Wash (100ml)\nInfused with Ylang-Ylang and Argan, this face wash goes deep into your pores to draw out dirt, pollution, and excess oil.\n\nPrice: ₹259';
            buttons = new List<Object>{
                de_AsterWhatsApp.replyButton('buy_facewash', 'Buy Now'),
                de_AsterWhatsApp.replyButton('more_like_this', 'Show More Like This')
            };
        }

        de_AsterWhatsApp.deliverInteractive(new Map<String, Object>{
            'type' => 'button',
            'header' => new Map<String, Object>{
                'type' => 'image',
                'image' => new Map<String, Object>{ 'link' => img }
            },
            'body' => new Map<String, Object>{ 'text' => bodyText },
            'action' => new Map<String, Object>{ 'buttons' => buttons }
        });

        return de_AsterWhatsApp.tag(cardKey);
    }

    public class Request {
        @InvocableVariable(label='Product Key' description='facewash | facescrub | bodywash | shampoo' required=false)
        public String productKey;
    }
}
