/**
 * v1 compatibility layer: `BrainboxReactNativeSDK` and `ChatScreen` keep working on top of the v2
 * client. The old `/api/chat/stream` call (which 404'd) now streams when the server supports it and
 * otherwise falls back to POST /api/chat.
 */
import React from 'react';
import { StyleProp, TextStyle, ViewStyle } from 'react-native';
import { BrainboxClient } from './client';
import { BrainboxError } from './errors';
import type { BrainboxChatResponse } from './types';
import { BrainboxChat } from './components/BrainboxChat';

/** @deprecated Use `BrainboxClient` (headless) or the `BrainboxChat` / `BrainboxWidget` components. */
export class BrainboxReactNativeSDK {
  readonly client: BrainboxClient;

  constructor(apiUrl: string, apiKey: string, tenantId?: string) {
    this.client = new BrainboxClient({ apiUrl, apiKey, tenantId });
  }

  /** Training needs a secret key — only call this from internal tools, never ship a secret key in an app. */
  ingest(sourceType: string, content: string, filePath?: string, metadata?: Record<string, any>): Promise<any> {
    const body: Record<string, unknown> = { source_type: sourceType, content, file_path: filePath, metadata: metadata || {} };
    if (this.client.tenantId) body.tenant_id = this.client.tenantId;
    return this.client.request('POST', '/api/ingest', { body });
  }

  chat(question: string, sessionId?: string): Promise<BrainboxChatResponse> {
    return this.client.chat(question, sessionId);
  }

  /** v1 signature. `onChunk` receives text deltas; `onComplete` the final response object. */
  streamChat(
    question: string,
    sessionId: string | undefined,
    onChunk: (chunk: string) => void,
    onComplete?: (result: any) => void,
    onError?: (error: Error) => void
  ): Promise<void> {
    return new Promise((resolve) => {
      const h = this.client.streamChat(question, {
        sessionId,
        onToken: (delta) => onChunk(delta),
        onDone: (res) => onComplete?.(res),
        onError: (err: BrainboxError) => onError?.(err)
      });
      h.done.then(() => resolve());
    });
  }

  createChatSession(title?: string): Promise<any> {
    return this.client.createSession(title || 'New Session');
  }

  listSessions() {
    return this.client.listSessions();
  }

  getSessionMessages(sessionId: string) {
    return this.client.getSessionMessages(sessionId);
  }

  healthCheck(): Promise<any> {
    return this.client.health();
  }
}

export interface ChatScreenProps {
  sdk: BrainboxReactNativeSDK;
  title?: string;
  placeholder?: string;
  primaryColor?: string;
  /** Ignored in v2 (the bot bubble follows the design system). */
  accentColor?: string;
  style?: StyleProp<ViewStyle>;
  /** Ignored in v2. */
  headerStyle?: StyleProp<ViewStyle>;
  /** Ignored in v2. */
  inputStyle?: StyleProp<TextStyle>;
  /** Ignored in v2 (the send button is an icon). */
  buttonText?: string;
}

/** @deprecated v1 component — renders the v2 `BrainboxChat`. */
export function ChatScreen({ sdk, title, placeholder, primaryColor, style }: ChatScreenProps) {
  return (
    <BrainboxChat
      client={sdk.client}
      theme={primaryColor ? { primary: primaryColor } : undefined}
      branding={title ? { title } : undefined}
      placeholder={placeholder}
      style={style}
    />
  );
}
