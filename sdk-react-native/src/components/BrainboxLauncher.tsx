import React, { ReactNode, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Modal,
  Platform,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
  useWindowDimensions
} from 'react-native';
import { BrainboxThemeOptions, useBrainboxTheme } from '../theme';
import { BrainboxLauncherMark } from './Logo';
import { EASE_SHEET, useReducedMotion } from './motion';

export type BrainboxPosition = 'bottom-right' | 'bottom-left';

export interface BrainboxLauncherProps {
  onPress: () => void;
  /** Unread replies; shows a red badge when > 0. */
  unread?: number;
  position?: BrainboxPosition;
  /** Distance from the screen corner (default {x: 20, y: 28}). */
  offset?: { x?: number; y?: number };
  size?: number;
  theme?: BrainboxThemeOptions;
  accessibilityLabel?: string;
  /** Hide with a scale-out (e.g. while the chat is open). */
  hidden?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Floating 56px brand-gradient circle with the Brainbox mark and an unread badge. */
export function BrainboxLauncher({
  onPress, unread = 0, position = 'bottom-right', offset, size = 56, theme, accessibilityLabel, hidden = false, style
}: BrainboxLauncherProps) {
  const t = useBrainboxTheme(theme);
  const reduced = useReducedMotion();
  const scale = useRef(new Animated.Value(0)).current;
  const press = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const to = hidden ? 0 : 1;
    if (reduced) Animated.timing(scale, { toValue: to, duration: 100, useNativeDriver: true }).start();
    else Animated.spring(scale, { toValue: to, speed: 14, bounciness: 6, useNativeDriver: true }).start();
  }, [hidden, reduced, scale]);
  const pressTo = (v: number) => Animated.timing(press, { toValue: v, duration: 80, useNativeDriver: true }).start();
  const x = offset?.x ?? 20;
  const y = offset?.y ?? 28;
  const label = accessibilityLabel || (unread ? `Open chat, ${unread} unread` : 'Open chat');
  return (
    <Animated.View
      pointerEvents={hidden ? 'none' : 'auto'}
      style={[
        styles.wrap,
        { width: size, height: size, borderRadius: size / 2, bottom: y },
        position === 'bottom-left' ? { left: x } : { right: x },
        { opacity: scale, transform: [{ scale: Animated.multiply(scale, press) }] },
        style
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={onPress}
        onPressIn={() => pressTo(0.94)}
        onPressOut={() => pressTo(1)}
        style={{ width: size, height: size, borderRadius: size / 2 }}
      >
        <BrainboxLauncherMark size={size} from={theme?.primary ? t.accent : undefined} />
      </Pressable>
      {unread > 0 ? (
        <View style={[styles.badge, { backgroundColor: t.danger, borderColor: t.surface }]} pointerEvents="none">
          <Text style={styles.badgeText}>{unread > 9 ? '9+' : String(unread)}</Text>
        </View>
      ) : null}
    </Animated.View>
  );
}

export interface BrainboxModalProps {
  visible: boolean;
  onClose: () => void;
  position?: BrainboxPosition;
  theme?: BrainboxThemeOptions;
  /** Receives `{floating}`: true on wide screens (window), false on phones (full-screen sheet). */
  children: (layout: { floating: boolean }) => ReactNode;
}

/**
 * Presents the chat with a slide-up spring. Phones (< 576pt wide): full-screen sheet with a 12pt top
 * radius. Tablets: a 380×600 floating window in the launcher's corner.
 */
export function BrainboxModal({ visible, onClose, position = 'bottom-right', theme, children }: BrainboxModalProps) {
  const t = useBrainboxTheme(theme);
  const reduced = useReducedMotion();
  const { width, height } = useWindowDimensions();
  const floating = width >= 576;
  const v = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(visible);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      v.setValue(0);
      if (reduced) Animated.timing(v, { toValue: 1, duration: 100, useNativeDriver: true }).start();
      else Animated.spring(v, { toValue: 1, damping: 26, stiffness: 260, mass: 1, useNativeDriver: true }).start();
    } else if (mounted) {
      Animated.timing(v, { toValue: 0, duration: reduced ? 100 : 240, easing: EASE_SHEET, useNativeDriver: true }).start(
        ({ finished }) => finished && setMounted(false)
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const winW = Math.min(380, width - 32);
  const winH = Math.min(600, height - 64);
  const sheetStyle = floating
    ? [
        styles.window,
        { width: winW, height: winH, backgroundColor: t.surface, bottom: 24 },
        position === 'bottom-left' ? { left: 16 } : { right: 16 },
        reduced
          ? { opacity: v }
          : {
              opacity: v,
              transform: [
                { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) },
                { scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.98, 1] }) }
              ]
            }
      ]
    : [
        styles.sheet,
        { backgroundColor: t.surface },
        reduced
          ? { opacity: v }
          : { transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [height, 0] }) }] }
      ];

  return (
    <Modal
      visible={mounted}
      transparent
      animationType="none"
      onRequestClose={onClose}
      supportedOrientations={['portrait', 'landscape']}
    >
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: t.backdrop, opacity: v }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close chat" accessible={false} />
      </Animated.View>
      <Animated.View style={sheetStyle as any}>{children({ floating })}</Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
      android: { elevation: 4 },
      default: {}
    })
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center'
  },
  badgeText: { color: '#FFFFFF', fontSize: 11, lineHeight: 13, fontWeight: '600' },
  sheet: {
    ...StyleSheet.absoluteFillObject,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    overflow: 'hidden'
  },
  window: {
    position: 'absolute',
    borderRadius: 18,
    overflow: Platform.OS === 'android' ? 'hidden' : 'visible',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 20, shadowOffset: { width: 0, height: 12 } },
      android: { elevation: 4 },
      default: {}
    })
  }
});
