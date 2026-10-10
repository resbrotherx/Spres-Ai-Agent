import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useBrainboxChat, BrainboxChatEventName } from '../useBrainboxChat';
import type { BrainboxChatResponse } from '../types';
import { BrainboxChatProps, BrainboxChatView, useClientFromProps, useHapticEvents } from './BrainboxChat';
import { BrainboxLauncher, BrainboxLauncherVariant, BrainboxModal, BrainboxPosition } from './BrainboxLauncher';

export interface BrainboxWidgetProps extends Omit<BrainboxChatProps, 'onClose' | 'safeArea'> {
  position?: BrainboxPosition;
  /** Launcher distance from the corner (default {x: 20, y: 28}). */
  offset?: { x?: number; y?: number };
  /** Open on first render. */
  defaultOpen?: boolean;
  /** Controlled open state (use with onOpenChange). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Show the floating launcher (default true). Set false to open from your own button via the ref. */
  launcher?: boolean;
  launcherLabel?: string;
  /** 'button' (default): purple "Chat" pill. 'icon': round purple button. */
  launcherVariant?: BrainboxLauncherVariant;
  /** Text on the 'button' launcher (default 'Chat'). */
  launcherText?: string;
}

export interface BrainboxWidgetHandle {
  open: () => void;
  close: () => void;
  toggle: () => void;
  isOpen: () => boolean;
  send: (text: string) => Promise<BrainboxChatResponse | null>;
  newChat: () => void;
}

/**
 * Drop-in floating assistant: launcher + slide-up chat sheet. Render it once near the root of your
 * app (it overlays the screen and lets touches through outside the launcher).
 */
export const BrainboxWidget = forwardRef<BrainboxWidgetHandle, BrainboxWidgetProps>(function BrainboxWidget(props, ref) {
  const { position = 'bottom-right', offset, defaultOpen = false, launcher = true, launcherLabel, launcherVariant, launcherText } = props;
  const client = useClientFromProps(props);
  const [innerOpen, setInnerOpen] = useState(defaultOpen);
  const isOpen = props.open ?? innerOpen;
  const openRef = useRef(isOpen);
  openRef.current = isOpen;
  const [unread, setUnread] = useState(0);

  const hapticEvents = useHapticEvents(props.haptics, props.onEvent);
  const onEvent = useCallback(
    (name: BrainboxChatEventName, detail: any) => {
      if (name === 'response' && !openRef.current) setUnread((n) => n + 1);
      hapticEvents(name, detail);
    },
    [hapticEvents]
  );

  const chat = useBrainboxChat(client, {
    streaming: props.streaming,
    storage: props.storage,
    storageKey: props.storageKey,
    persistSession: props.persistSession,
    initialSessionId: props.initialSessionId,
    onEvent
  });

  const setOpen = useCallback(
    (v: boolean) => {
      if (props.open === undefined) setInnerOpen(v);
      props.onOpenChange?.(v);
      onEvent(v ? 'open' : 'close', {});
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [props.open, props.onOpenChange, onEvent]
  );

  useEffect(() => {
    if (isOpen) setUnread(0);
  }, [isOpen]);

  useImperativeHandle(
    ref,
    () => ({
      open: () => setOpen(true),
      close: () => setOpen(false),
      toggle: () => setOpen(!openRef.current),
      isOpen: () => openRef.current,
      send: (text: string) => chat.send(text),
      newChat: () => chat.newChat()
    }),
    [setOpen, chat]
  );

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      {launcher ? (
        <BrainboxLauncher
          onPress={() => setOpen(true)}
          unread={unread}
          position={position}
          offset={offset}
          theme={props.theme}
          hidden={isOpen}
          accessibilityLabel={launcherLabel}
          variant={launcherVariant}
          text={launcherText}
        />
      ) : null}
      <BrainboxModal visible={isOpen} onClose={() => setOpen(false)} position={position} theme={props.theme}>
        {({ floating }) => (
          <BrainboxChatView
            {...props}
            chat={chat}
            user={props.user || client.user}
            onClose={() => setOpen(false)}
            safeArea={!floating}
          />
        )}
      </BrainboxModal>
    </View>
  );
});
