import axios, { AxiosInstance } from 'axios';
import { ChatPayload, ChatSessionPayload, IngestPayload, BrainboxChatResponse } from './types';

export class BrainboxReactSDK {
  private apiUrl: string;
  private apiKey: string;
  private tenantId: string;
  private client: AxiosInstance;

  constructor(apiUrl: string, apiKey: string, tenantId: string) {
    this.apiUrl = apiUrl.replace(/\/$/, '');
    this.apiKey = apiKey;
    this.tenantId = tenantId;

    this.client = axios.create({
      baseURL: this.apiUrl,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      }
    });
  }

  async ingest(
    sourceType: string,
    content: string,
    filePath?: string,
    metadata?: Record<string, any>
  ): Promise<any> {
    const payload: IngestPayload = {
      tenant_id: this.tenantId,
      source_type: sourceType,
      content,
      file_path: filePath,
      metadata: metadata || {}
    };

    const response = await this.client.post('/api/ingest', payload);
    return response.data;
  }

  async chat(question: string, sessionId?: string): Promise<BrainboxChatResponse> {
    const payload: ChatPayload = {
      tenant_id: this.tenantId,
      question,
      session_id: sessionId
    };

    const response = await this.client.post('/api/chat', payload);
    return response.data;
  }

  async streamChat(
    question: string,
    sessionId: string | undefined,
    onChunk: (chunk: string) => void,
    onComplete?: (result: any) => void,
    onError?: (error: Error) => void
  ): Promise<void> {
    const payload: ChatPayload = {
      tenant_id: this.tenantId,
      question,
      session_id: sessionId
    };

    try {
      if (typeof fetch !== 'undefined') {
        const response = await fetch(`${this.apiUrl}/api/chat/stream`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`
          },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          throw new Error(`Stream request failed: ${response.status}`);
        }

        if (!response.body || typeof response.body.getReader !== 'function') {
          const text = await response.text();
          let parsed: any;
          try {
            parsed = JSON.parse(text);
          } catch {
            parsed = { response: text };
          }
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
        return;
      }

      const result = await this.chat(question, sessionId);
      onChunk(result.response || JSON.stringify(result));
      onComplete?.(result);
    } catch (error: any) {
      const message = error?.message || 'Unknown stream error';
      onError?.(new Error(message));
    }
  }

  async createChatSession(title?: string): Promise<any> {
    const payload: ChatSessionPayload = {
      tenant_id: this.tenantId,
      title: title || 'New Session'
    };

    const response = await this.client.post('/api/chat/session', payload);
    return response.data;
  }

  async healthCheck(): Promise<any> {
    const response = await this.client.get('/api/health');
    return response.data;
  }
}
