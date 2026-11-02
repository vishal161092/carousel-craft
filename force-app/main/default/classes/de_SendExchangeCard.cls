/**
 * STEP 9 — Free-replacement / exchange confirmation card (Confirm Exchange / Speak to Agent).
 * Call after the customer has shared a photo of the product's expiry date.
 */
public with sharing class de_SendExchangeCard {

    @InvocableMethod(label='Send Exchange Card' description='Sends the free-replacement confirmation card with "Confirm Exchange" and "Speak to Agent" buttons. Call after the customer shares a photo of the product expiry date.' category='Aster')
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
                'text' => 'Thank you for sharing the photo. I apologize for the oversight. 🙏\n\nI can immediately process a free replacement for this item, and our delivery executive will collect the old one during drop-off.'
            },
            'action' => new Map<String, Object>{
                'buttons' => new List<Object>{
                    de_AsterWhatsApp.replyButton('exchange_confirm', 'Confirm Exchange'),
                    de_AsterWhatsApp.replyButton('exchange_agent', 'Speak to Agent')
                }
            }
        });

        return de_AsterWhatsApp.tag('exchange');
    }

    public class Request {
        @InvocableVariable(label='(unused)' description='No inputs required' required=false)
        public String ignore;
    }
}
