/**
 * STEP 3 — "Show more like this" recommendations list (Face Scrub, Peel-Off Mask, Soap Bar).
 */
public with sharing class de_SendRecommendations {

    @InvocableMethod(label='Send Recommendations List' description='Sends a WhatsApp list of complementary Slate products (Face Scrub, Peel-Off Mask, Soap Bar). Call when the customer taps "Show More Like This".' category='Aster')
    public static List<String> send(List<Request> requests) {
        List<String> results = new List<String>();
        for (Integer i = 0; i < (requests == null || requests.isEmpty() ? 1 : requests.size()); i++) {
            results.add(doSend());
        }
        return results;
    }

    private static String doSend() {
        List<Object> rows = new List<Object>{
            new Map<String, Object>{ 'id' => 'rec_facescrub', 'title' => 'Slate Face Scrub', 'description' => '₹349' },
            new Map<String, Object>{ 'id' => 'rec_mask', 'title' => 'Slate Peel-Off Mask', 'description' => '₹349' },
            new Map<String, Object>{ 'id' => 'rec_soap', 'title' => 'Slate Soap Bar', 'description' => '₹199' }
        };

        de_AsterWhatsApp.deliverInteractive(new Map<String, Object>{
            'type' => 'list',
            'body' => new Map<String, Object>{
                'text' => 'Here are some perfect additions to complete your Slate detox routine. Click below to view:'
            },
            'action' => new Map<String, Object>{
                'button' => '📋 View Recommendations',
                'sections' => new List<Object>{
                    new Map<String, Object>{ 'title' => 'Slate Detox Routine', 'rows' => rows }
                }
            }
        });

        return de_AsterWhatsApp.tag('recommendations');
    }

    public class Request {
        @InvocableVariable(label='(unused)' description='No inputs required' required=false)
        public String ignore;
    }
}
