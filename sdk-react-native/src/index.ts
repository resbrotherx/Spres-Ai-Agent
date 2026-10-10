// Headless
export { BrainboxClient } from './client';
export type { RequestOptions } from './client';
export { BrainboxError } from './errors';
export type { BrainboxErrorCode } from './errors';
export { SSEParser } from './sse';
export type { SSEEvent } from './sse';
export { createMemoryStorage, getDefaultStorage } from './storage';
export * from './types';

// Hook
export { useBrainboxChat, parseServerTime } from './useBrainboxChat';
export type {
  BrainboxMessage,
  BrainboxMessageStatus,
  BrainboxChatEventName,
  UseBrainboxChatOptions,
  UseBrainboxChatResult
} from './useBrainboxChat';

// Theme, haptics, markdown
export { useBrainboxTheme, buildTokens } from './theme';
export type { BrainboxThemeOptions, BrainboxThemeMode, BrainboxTokens } from './theme';
export { triggerHaptic } from './haptics';
export type { BrainboxHaptics, BrainboxHapticType } from './haptics';
export type { BrainboxClipboard } from './clipboard';
export { parseMarkdown, parseInline, safeHref } from './markdown';
export type { MdBlock, MdInline } from './markdown';

// Components
export { BrainboxChat, BrainboxChatView, useClientFromProps } from './components/BrainboxChat';
export type {
  BrainboxChatProps,
  BrainboxChatViewProps,
  BrainboxBranding,
  BrainboxQuickAction,
  BrainboxFeatures,
  BrainboxConnectionProps,
  BrainboxAppearanceProps
} from './components/BrainboxChat';
export { BrainboxLauncher, BrainboxModal } from './components/BrainboxLauncher';
export type { BrainboxLauncherProps, BrainboxModalProps, BrainboxPosition, BrainboxLauncherVariant } from './components/BrainboxLauncher';
export { BrainboxWidget } from './components/BrainboxWidget';
export type { BrainboxWidgetProps, BrainboxWidgetHandle } from './components/BrainboxWidget';
export { BrainboxLogo, BrainboxOrb, BrainboxLauncherMark } from './components/Logo';
export type { BrainboxLogoProps, BrainboxOrbColors } from './components/Logo';
export { BrainboxIcon } from './components/Icon';
export type { BrainboxIconName } from './components/Icon';
export { Markdown } from './components/Markdown';

// v1 compatibility
export { BrainboxReactNativeSDK, ChatScreen } from './compat';
export type { ChatScreenProps } from './compat';
