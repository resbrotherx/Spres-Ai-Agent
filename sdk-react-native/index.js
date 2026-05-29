function buildHeaders(apiKey) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`
  };
}

function parseJsonOrText(text) {
  try {
    return JSON.parse(text);
  } catch {
    return { response: text };
  }
}

class BrainboxReactNativeSDK {
  constructor(apiUrl, apiKey, tenantId) {
    this.apiUrl = apiUrl.replace(/\/$/, '');
    this.apiKey = apiKey;
    this.tenantId = tenantId;
  }

  async ingest(sourceType, content, filePath, metadata) {
    const payload = {
      tenant_id: this.tenantId,
      source_type: sourceType,
      content,
      file_path: filePath,
      metadata: metadata || {}
    };

    const response = await fetch(`${this.apiUrl}/api/ingest`, {
      method: 'POST',
      headers: buildHeaders(this.apiKey),
      body: JSON.stringify(payload)
    });

    return response.json();
  }

  async chat(question, sessionId) {
    const payload = {
      tenant_id: this.tenantId,
      question,
      session_id: sessionId
    };

    const response = await fetch(`${this.apiUrl}/api/chat`, {
      method: 'POST',
      headers: buildHeaders(this.apiKey),
      body: JSON.stringify(payload)
    });

    return response.json();
  }

  async streamChat(question, sessionId, onChunk, onComplete, onError) {
    try {
      const payload = {
        tenant_id: this.tenantId,
        question,
        session_id: sessionId
      };

      const response = await fetch(`${this.apiUrl}/api/chat/stream`, {
        method: 'POST',
        headers: buildHeaders(this.apiKey),
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `Stream request failed: ${response.status}`);
      }

      if (typeof response.body === 'undefined' || typeof response.body.getReader !== 'function') {
        const text = await response.text();
        const parsed = parseJsonOrText(text);
        onChunk(parsed.response || text || '');
        onComplete?.(parsed);
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        onChunk(chunk);
      }

      onComplete?.({ success: true });
    } catch (error) {
      onError?.(error instanceof Error ? error : new Error(String(error)));
    }
  }

  async createChatSession(title) {
    const payload = {
      tenant_id: this.tenantId,
      title: title || 'New Session'
    };

    const response = await fetch(`${this.apiUrl}/api/chat/session`, {
      method: 'POST',
      headers: buildHeaders(this.apiKey),
      body: JSON.stringify(payload)
    });

    return response.json();
  }

  async healthCheck() {
    const response = await fetch(`${this.apiUrl}/api/health`, {
      method: 'GET',
      headers: buildHeaders(this.apiKey)
    });

    return response.json();
  }
}

const ChatScreen = require('./ChatScreen');

module.exports = {
  BrainboxReactNativeSDK,
  ChatScreen
};
