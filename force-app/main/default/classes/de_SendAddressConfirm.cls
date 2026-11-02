/**
 * STEP 5 — Saved-address confirmation card (Yes, deliver here / Add new address).
 */
public with sharing class de_SendAddressConfirm {

    @InvocableMethod(label='Send Address Confirmation' description='Sends the saved-address confirmation card with "Yes, deliver here" and "Add new address" buttons. Call after the customer taps Buy Now.' category='Aster')
    public static List<String> send(List<Request> requests) {
        List<String> results = new List<String>();
        for (Integer i = 0; i < (requests == null || requests.isEmpty() ? 1 : requests.size()); i++) {
            results.add(doSend());
        }
        return results;
    }

    private static String doSend() {
        de_AsterWhatsApp.deliverInteractive(new Map<String, Object>{
            'type' => 'button',
            'body' => new Map<String, Object>{
                'text' => 'Awesome! Adding 1x Slate Face Scrub to your cart. 🛒\n\nSince you\'re a returning gentleman, shall we deliver this to your saved address? 📍\nFlat 12B, Maple Residency, Lakeview Road, Springfield 000000'
            },
            'action' => new Map<String, Object>{
                'buttons' => new List<Object>{
                    de_AsterWhatsApp.replyButton('addr_yes', 'Yes, deliver here'),
                    de_AsterWhatsApp.replyButton('addr_new', 'Add new address')
                }
            }
        });

        return de_AsterWhatsApp.tag('address_confirm');
    }

    public class Request {
        @InvocableVariable(label='(unused)' description='No inputs required' required=false)
        public String ignore;
    }
}
