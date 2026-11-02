public with sharing class de_WhatsAppMediaUploader {

    private static de_WhatsApp_Config__mdt getConfig() {
        return de_WhatsApp_Config__mdt.getInstance('de_Default');
    }

    public static String uploadFileToMeta(Id contentVersionId) {
        de_WhatsApp_Config__mdt config = getConfig();
        String accessToken = config.de_Access_Token__c;

        ContentVersion cv = [
            SELECT Id, Title, FileExtension, ContentSize, VersionData
            FROM ContentVersion
            WHERE Id = :contentVersionId
            LIMIT 1
        ];

        String mimeType = getMimeType(cv.FileExtension);
        Integer fileSize = cv.ContentSize;

        String uploadId = createUploadSession(accessToken, fileSize, mimeType);
        String handle = uploadFileBytes(accessToken, uploadId, cv.VersionData);

        return handle;
    }

    private static String createUploadSession(String accessToken, Integer fileSize, String mimeType) {
        HttpRequest req = new HttpRequest();
        req.setEndpoint('https://graph.facebook.com/v21.0/app/uploads');
        req.setMethod('POST');
        req.setTimeout(30000);

        String boundary = '----FormBoundary' + String.valueOf(Datetime.now().getTime());
        req.setHeader('Authorization', 'Bearer ' + accessToken);
        req.setHeader('Content-Type', 'multipart/form-data; boundary=' + boundary);

        String body = '--' + boundary + '\r\n';
        body += 'Content-Disposition: form-data; name="file_length"\r\n\r\n';
        body += String.valueOf(fileSize) + '\r\n';
        body += '--' + boundary + '\r\n';
        body += 'Content-Disposition: form-data; name="file_type"\r\n\r\n';
        body += mimeType + '\r\n';
        body += '--' + boundary + '\r\n';
        body += 'Content-Disposition: form-data; name="messaging_product"\r\n\r\n';
        body += 'whatsapp\r\n';
        body += '--' + boundary + '--\r\n';

        req.setBody(body);

        Http http = new Http();
        HttpResponse resp = http.send(req);

        if (resp.getStatusCode() != 200) {
            throw new CalloutException('Upload session failed: ' + resp.getBody());
        }

        Map<String, Object> result = (Map<String, Object>) JSON.deserializeUntyped(resp.getBody());
        return (String) result.get('id');
    }

    private static String uploadFileBytes(String accessToken, String uploadId, Blob fileData) {
        HttpRequest req = new HttpRequest();
        // The upload ID must be passed exactly as received — no encoding
        req.setEndpoint('https://graph.facebook.com/v21.0/' + uploadId);
        req.setMethod('POST');
        req.setTimeout(60000);
        req.setHeader('Authorization', 'OAuth ' + accessToken);
        req.setHeader('file_offset', '0');
        req.setBodyAsBlob(fileData);

        Http http = new Http();
        HttpResponse resp = http.send(req);

        if (resp.getStatusCode() != 200) {
            throw new CalloutException('File upload failed: ' + resp.getBody());
        }

        Map<String, Object> result = (Map<String, Object>) JSON.deserializeUntyped(resp.getBody());
        return (String) result.get('h');
    }

    private static String getMimeType(String extension) {
        if (extension == null) return 'application/octet-stream';
        switch on extension.toLowerCase() {
            when 'png' { return 'image/png'; }
            when 'jpg', 'jpeg' { return 'image/jpeg'; }
            when 'gif' { return 'image/gif'; }
            when 'webp' { return 'image/webp'; }
            when 'mp4' { return 'video/mp4'; }
            when 'pdf' { return 'application/pdf'; }
            when else { return 'application/octet-stream'; }
        }
    }
}
