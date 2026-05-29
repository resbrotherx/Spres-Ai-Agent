import type { BrainboxReactSDK } from './brainbox-sdk';

export type ChatRole = 'user' | 'assistant' | 'system';

export interface ChatMessage {
  id: string;
  role: ChatRole;
  text: string;
  timestamp: string;
}

export interface ChatWidgetProps {
  sdk: BrainboxReactSDK;
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left' | 'center';
  primaryColor?: string;
  accentColor?: string;
  backgroundColor?: string;
  buttonText?: string;
  placeholder?: string;
  width?: string;
  height?: string;
  design?: 'support' | 'assistant';
}

export interface ChatPanelProps {
  sdk: BrainboxReactSDK;
  primaryColor?: string;
  accentColor?: string;
  backgroundColor?: string;
  headerText?: string;
  sidebarTitle?: string;
  initialSessionId?: string;
  design?: 'cloud' | 'classic';
}

export interface UseBrainboxChatHook {
  messages: ChatMessage[];
  loading: boolean;
  error: string | null;
  sessionId: string | null;
  sendMessage: (text: string) => Promise<void>;
  sendVoiceNote: (note: string) => Promise<void>;
  createSession: (title?: string) => Promise<void>;
  reset: () => void;
}

export interface BrainboxChatResponse {
  response: string;
  session_id?: string;
}

export interface ChatSessionPayload {
  tenant_id: string;
  title?: string;
}

export interface ChatPayload {
  tenant_id: string;
  question: string;
  session_id?: string;
}

export interface IngestPayload {
  tenant_id: string;
  source_type: string;
  content: string;
  file_path?: string;
  metadata?: Record<string, any>;
}
