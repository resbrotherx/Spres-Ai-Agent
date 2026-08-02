import axios, { AxiosInstance } from 'axios';
import { ChatPayload, ChatSessionPayload, IngestPayload, BrainboxChatResponse, SessionsGroupedByDate } from './types';

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
        Authorization: `Bearer ${this.apiKey}`
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
    try {
      const result = await this.chat(question, sessionId);
      const fullText = result.response || JSON.stringify(result);
      const words = fullText.split(" ");
      let acc = "";
      for (let i = 0; i < words.length; i++) {
        acc += (i === 0 ? "" : " ") + words[i];
        onChunk(i === 0 ? acc : " " + words[i]);
        await new Promise(r => setTimeout(r, 18)); // typing speed
      }
      onComplete?.(result);
    } catch (error: any) {
      onError?.(new Error(error?.message || 'Unknown stream error'));
    }
  }
  //     onChunk(result.response || JSON.stringify(result));
  //     onComplete?.(result);
  //   } catch (error: any) {
  //     const message = error?.message || 'Unknown stream error';
  //     onError?.(new Error(message));
  //   }
  // }

  async createChatSession(title?: string): Promise<any> {
    const payload: ChatSessionPayload = {
      tenant_id: this.tenantId,
      title: title || 'New Session'
    };

    const response = await this.client.post('/api/chat/session', payload);
    return response.data;
  }

  async listSessions(): Promise<SessionsGroupedByDate> {
    const response = await this.client.post('/api/chat/sessions', {
      tenant_id: this.tenantId
    });
    return response.data;
  }

  async getSessionMessages(sessionId: string): Promise<any> {
    const response = await this.client.get(`/api/session/${sessionId}/messages`);
    return response.data;
  }

  async uploadFile(file: File, sessionId?: string): Promise<any> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('tenant_id', this.tenantId);
    if (sessionId) {
      formData.append('session_id', sessionId);
    }

    const response = await this.client.post('/api/chat/upload/file', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    return response.data;
  }

  async uploadImage(image: File, sessionId?: string): Promise<any> {
    const formData = new FormData();
    formData.append('image', image);
    formData.append('tenant_id', this.tenantId);
    if (sessionId) {
      formData.append('session_id', sessionId);
    }

    const response = await this.client.post('/api/chat/upload/image', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    return response.data;
  }

  async healthCheck(): Promise<any> {
    const response = await this.client.get('/api/health');
    return response.data;
  }

  getUserProfile(): any {
    try {
      const token = this.apiKey;
      const payload = token?.split?.('.')[1];
      if (!payload) return null;
      const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
      const name = decoded.name || decoded.full_name || decoded.username || decoded.sub || 'User';
      return {
        name,
        email: decoded.email || '',
        username: decoded.username || decoded.sub || name,
        firstName: decoded.first_name || decoded.given_name || '',
        lastName: decoded.last_name || decoded.family_name || '',
        avatarUrl: decoded.avatar_url || decoded.picture || ''
      };
    } catch {
      return null;
    }
  }
}
