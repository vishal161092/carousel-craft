/**
 * STEP 8 — Order-tracking list (#AO-8932 Processing, #AO-7511 Shipped).
 */
public with sharing class de_SendOrderList {

    @InvocableMethod(label='Send Order List' description='Sends a WhatsApp list of the customer\'s recent orders to pick from for tracking. Call when the customer asks to track an order.' category='Aster')
    public static List<String> send(List<Request> requests) {
        List<String> results = new List<String>();
        for (Integer i = 0; i < (requests == null || requests.isEmpty() ? 1 : requests.size()); i++) {
            results.add(doSend());
        }
        return results;
    }

    private static String doSend() {
        List<Object> rows = new List<Object>{
            new Map<String, Object>{ 'id' => 'ord_8932', 'title' => 'Order #AO-8932', 'description' => 'Processing · Today' },
            new Map<String, Object>{ 'id' => 'ord_7511', 'title' => 'Order #AO-7511', 'description' => 'Shipped · Oct 5' }
        };

        de_AsterWhatsApp.deliverInteractive(new Map<String, Object>{
            'type' => 'list',
            'body' => new Map<String, Object>{
                'text' => 'Let\'s check your orders. Please select the order you wish to track from the list below:'
            },
            'action' => new Map<String, Object>{
                'button' => '📦 Select Order',
                'sections' => new List<Object>{
                    new Map<String, Object>{ 'title' => 'Your Orders', 'rows' => rows }
                }
            }
        });

        return de_AsterWhatsApp.tag('order_list');
    }

    public class Request {
        @InvocableVariable(label='(unused)' description='No inputs required' required=false)
        public String ignore;
    }
}
