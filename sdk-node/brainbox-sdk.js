const axios = require('axios');

class BrainboxNodeSDK {
    constructor(apiUrl, apiKey, tenantId) {
        this.apiUrl = apiUrl.replace(/\/$/, '');
        this.apiKey = apiKey;
        this.tenantId = tenantId;
        this.client = axios.create({
            baseURL: this.apiUrl,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            }
        });
    }

    async ingest(sourceType, content, filePath = null, metadata = {}) {
        try {
            const payload = {
                tenant_id: this.tenantId,
                source_type: sourceType,
                content: content,
                file_path: filePath,
                metadata: metadata
            };

            const response = await this.client.post('/api/ingest', payload);
            return response.data;
        } catch (error) {
            throw new Error(`Ingestion failed: ${error.message}`);
        }
    }

    async getIngestStatus(taskId) {
        try {
            const response = await this.client.get(`/api/ingest/status/${taskId}`);
            return response.data;
        } catch (error) {
            throw new Error(`Failed to get ingestion status: ${error.message}`);
        }
    }

    async chat(question, sessionId = null) {
        try {
            const payload = {
                tenant_id: this.tenantId,
                question: question,
                session_id: sessionId
            };

            const response = await this.client.post('/api/chat', payload);
            return response.data;
        } catch (error) {
            throw new Error(`Chat failed: ${error.message}`);
        }
    }

    async createChatSession(title = null) {
        try {
            const payload = {
                tenant_id: this.tenantId,
                title: title || 'New Session'
            };

            const response = await this.client.post('/api/chat/session', payload);
            return response.data;
        } catch (error) {
            throw new Error(`Failed to create chat session: ${error.message}`);
        }
    }

    async healthCheck() {
        try {
            const response = await this.client.get('/api/health');
            return response.data;
        } catch (error) {
            throw new Error(`Health check failed: ${error.message}`);
        }
    }
}

module.exports = BrainboxNodeSDK;

// Example usage
if (require.main === module) {
    const sdk = new BrainboxNodeSDK(
        'http://localhost:8000',
        'your-api-key',
        'company-1'
    );

    (async () => {
        // Ingest logs
        const ingestResult = await sdk.ingest(
            'logs',
            '2024-01-15 ERROR: Database connection failed',
            '/var/log/app.log'
        );
        console.log(`Ingestion queued: ${ingestResult.task_id}`);

        // Chat
        const chatResult = await sdk.chat('What error occurred in the logs?');
        console.log(`Response: ${chatResult.response}`);
    })();
}
