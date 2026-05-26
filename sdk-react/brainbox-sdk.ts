import axios, { AxiosInstance } from 'axios';

interface IngestPayload {
  tenant_id: string;
  source_type: string;
  content: string;
  file_path?: string;
  metadata?: Record<string, any>;
}

interface ChatPayload {
  tenant_id: string;
  question: string;
  session_id?: string;
}

interface ChatSessionPayload {
  tenant_id: string;
  title?: string;
}

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
        'Authorization': `Bearer ${apiKey}`
      }
    });
  }

  async ingest(
    sourceType: string,
    content: string,
    filePath?: string,
    metadata?: Record<string, any>
  ): Promise<any> {
    try {
      const payload: IngestPayload = {
        tenant_id: this.tenantId,
        source_type: sourceType,
        content: content,
        file_path: filePath,
        metadata: metadata || {}
      };

      const response = await this.client.post('/api/ingest', payload);
      return response.data;
    } catch (error: any) {
      throw new Error(`Ingestion failed: ${error.message}`);
    }
  }

  async getIngestStatus(taskId: string): Promise<any> {
    try {
      const response = await this.client.get(`/api/ingest/status/${taskId}`);
      return response.data;
    } catch (error: any) {
      throw new Error(`Failed to get ingestion status: ${error.message}`);
    }
  }

  async chat(question: string, sessionId?: string): Promise<any> {
    try {
      const payload: ChatPayload = {
        tenant_id: this.tenantId,
        question: question,
        session_id: sessionId
      };

      const response = await this.client.post('/api/chat', payload);
      return response.data;
    } catch (error: any) {
      throw new Error(`Chat failed: ${error.message}`);
    }
  }

  async createChatSession(title?: string): Promise<any> {
    try {
      const payload: ChatSessionPayload = {
        tenant_id: this.tenantId,
        title: title || 'New Session'
      };

      const response = await this.client.post('/api/chat/session', payload);
      return response.data;
    } catch (error: any) {
      throw new Error(`Failed to create chat session: ${error.message}`);
    }
  }

  async healthCheck(): Promise<any> {
    try {
      const response = await this.client.get('/api/health');
      return response.data;
    } catch (error: any) {
      throw new Error(`Health check failed: ${error.message}`);
    }
  }
}

// React Hook for using Brainbox SDK
import { useState, useCallback } from 'react';

export const useBrainbox = (apiUrl: string, apiKey: string, tenantId: string) => {
  const [sdk] = useState(() => new BrainboxReactSDK(apiUrl, apiKey, tenantId));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ingest = useCallback(
    async (sourceType: string, content: string, filePath?: string, metadata?: Record<string, any>) => {
      setLoading(true);
      setError(null);
      try {
        const result = await sdk.ingest(sourceType, content, filePath, metadata);
        return result;
      } catch (err: any) {
        setError(err.message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [sdk]
  );

  const chat = useCallback(
    async (question: string, sessionId?: string) => {
      setLoading(true);
      setError(null);
      try {
        const result = await sdk.chat(question, sessionId);
        return result;
      } catch (err: any) {
        setError(err.message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [sdk]
  );

  const createChatSession = useCallback(
    async (title?: string) => {
      setLoading(true);
      setError(null);
      try {
        const result = await sdk.createChatSession(title);
        return result;
      } catch (err: any) {
        setError(err.message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [sdk]
  );

  return {
    ingest,
    chat,
    createChatSession,
    loading,
    error
  };
};
