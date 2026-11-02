@RestResource(urlMapping='/agent-proxy/*')
global with sharing class de_AgentProxy {

    // Agent (bot) Id comes from the de_Aster_Config__c hierarchy custom setting (Agent_Id__c).
    private static String botId() {
        de_Aster_Config__c cfg = de_Aster_Config__c.getOrgDefaults();
        if (cfg == null || String.isBlank(cfg.Agent_Id__c)) {
            throw new CalloutException('Set de_Aster_Config__c.Agent_Id__c (see README).');
        }
        return cfg.Agent_Id__c;
    }

    @HttpPost
    global static void handlePost() {
        RestRequest req = RestContext.request;
        RestResponse res = RestContext.response;

        Map<String, Object> body = (Map<String, Object>) JSON.deserializeUntyped(req.requestBody.toString());
        String action = (String) body.get('action');

        try {
            if (action == 'createSession') {
                res.responseBody = Blob.valueOf(createSession());
            } else if (action == 'sendMessage') {
                String sessionId = (String) body.get('sessionId');
                String message = (String) body.get('message');
                res.responseBody = Blob.valueOf(sendMessage(sessionId, message));
            } else {
                res.statusCode = 400;
                res.responseBody = Blob.valueOf('{"error":"Invalid action. Use createSession or sendMessage"}');
            }
        } catch (Exception e) {
            res.statusCode = 500;
            res.responseBody = Blob.valueOf('{"error":"' + e.getMessage().escapeJava() + '"}');
        }

        res.addHeader('Content-Type', 'application/json');
    }

    private static String getAgentJwt() {
        PageReference pr = new PageReference('/agentforce/bootstrap/nameduser');
        Blob content = pr.getContent();
        String body = content.toString();
        if (body.startsWith('<')) {
            throw new CalloutException('JWT bootstrap returned HTML — session may be invalid');
        }
        Map<String, Object> data = (Map<String, Object>) JSON.deserializeUntyped(body);
        return (String) data.get('access_token');
    }

    private static String createSession() {
        String jwt = getAgentJwt();

        HttpRequest req = new HttpRequest();
        req.setEndpoint('https://api.salesforce.com/einstein/ai-agent/v1/agents/' + BOT_ID + '/sessions');
        req.setMethod('POST');
        req.setHeader('Authorization', 'Bearer ' + jwt);
        req.setHeader('Content-Type', 'application/json');
        req.setTimeout(120000);

        Map<String, Object> payload = new Map<String, Object>{
            'externalSessionKey' => generateUUID(),
            'instanceConfig' => new Map<String, Object>{
                'endpoint' => URL.getOrgDomainUrl().toExternalForm()
            },
            'streamingCapabilities' => new Map<String, Object>{
                'chunkTypes' => new List<String>{'Text'}
            },
            'bypassUser' => true
        };
        req.setBody(JSON.serialize(payload));

        Http http = new Http();
        HttpResponse res = http.send(req);
        return res.getBody();
    }

    private static String sendMessage(String sessionId, String message) {
        String jwt = getAgentJwt();

        HttpRequest req = new HttpRequest();
        req.setEndpoint('https://api.salesforce.com/einstein/ai-agent/v1/sessions/' + sessionId + '/messages');
        req.setMethod('POST');
        req.setHeader('Authorization', 'Bearer ' + jwt);
        req.setHeader('Content-Type', 'application/json');
        req.setTimeout(120000);

        Map<String, Object> payload = new Map<String, Object>{
            'message' => new Map<String, Object>{
                'sequenceId' => System.currentTimeMillis(),
                'type' => 'Text',
                'text' => message
            }
        };
        req.setBody(JSON.serialize(payload));

        Http http = new Http();
        HttpResponse res = http.send(req);
        return res.getBody();
    }

    private static String generateUUID() {
        Blob b = Crypto.generateAesKey(128);
        String h = EncodingUtil.convertToHex(b);
        return h.substring(0, 8) + '-' + h.substring(8, 12) + '-' +
               h.substring(12, 16) + '-' + h.substring(16, 20) + '-' +
               h.substring(20, 32);
    }
}
