import type { BrainboxReactSDK } from './brainbox-sdk';

export type ChatRole = 'user' | 'assistant' | 'system';

export interface ChatMessage {
  id: string;
  role: ChatRole;
  text: string;
  timestamp: string;
  userInitials?: string;
  metadata?: {
    context_used?: boolean;
    [key: string]: any;
  };
}

export interface CustomizationProps {
  // Colors
  primaryColor?: string;
  accentColor?: string;
  backgroundColor?: string;
  border?: string;
  borderRadius?: string;

  // Branding
  logoUrl?: string;
  logoText?: string;
  data?: Record<string, any>;
  manualData?: Record<string, any>;
  user?: {
    name?: string;
    email?: string;
    username?: string;
    firstName?: string;
    lastName?: string;
    avatarUrl?: string;
    [key: string]: any;
  };
  bot?: {
    name?: string;
    avatarUrl?: string;
    [key: string]: any;
  };

  // Text customization
  headerText?: string;
  sidebarTitle?: string;
  newChatButtonText?: string;
  searchPlaceholder?: string;
  sendButtonText?: string;

  // Features
  showExportButton?: boolean;
  showVoiceInput?: boolean;
  showFileUpload?: boolean;
  showImageUpload?: boolean;
}

export interface ChatWidgetProps extends CustomizationProps {
  sdk: BrainboxReactSDK;
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left' | 'center';
  buttonText?: string;
  placeholder?: string;
  width?: string;
  height?: string;
  design?: 'support' | 'assistant';
  defaultOpen?: boolean;
}

export interface ChatPanelProps extends CustomizationProps {
  sdk: BrainboxReactSDK;
  initialSessionId?: string;
  design?: 'cloud' | 'classic';
}

export interface UseBrainboxChatHook {
  messages: ChatMessage[];
  loading: boolean;
  error: string | null;
  sessionId: string | null;
  sessions?: ChatSession[];
  sendMessage: (text: string) => Promise<void>;
  sendVoiceNote: (note: Blob) => Promise<void>;
  uploadFile: (file: File) => Promise<void>;
  uploadImage: (image: File) => Promise<void>;
  createSession: (title?: string) => Promise<void>;
  loadSession: (sessionId: string) => Promise<void>;
  exportChat: (format: 'json' | 'pdf') => Promise<void>;
  reset: () => void;
}

export interface BrainboxChatResponse {
  response: string;
  session_id?: string;
}

export interface ChatSession {
  session_id: string;
  title: string;
  created_at: string;
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

export interface SessionsGroupedByDate {
  today: ChatSession[];
  yesterday: ChatSession[];
  this_week: ChatSession[];
  older: ChatSession[];
}
