import React, { ReactNode, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Modal,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
  useWindowDimensions
} from 'react-native';
import { BrainboxThemeOptions, useBrainboxTheme } from '../theme';
import { BrainboxGradientFill } from './Logo';
import { BrainboxIcon } from './Icon';
import { EASE_SHEET, useReducedMotion } from './motion';

export type BrainboxPosition = 'bottom-right' | 'bottom-left';
/** 'auto' (default): round icon until a `text` is set, then a pill. 'button': pill with icon + label. 'icon': round button. */
export type BrainboxLauncherVariant = 'auto' | 'button' | 'icon';

export interface BrainboxLauncherProps {
  onPress: () => void;
  /** Unread replies; shows a red badge when > 0. */
  unread?: number;
  position?: BrainboxPosition;
  /** Distance from the screen corner (default {x: 20, y: 28}). */
  offset?: { x?: number; y?: number };
  /** Diameter of the round launcher (default 60). The pill is 46pt tall. */
  size?: number;
  /** 'auto' (default), 'button' (pill) or 'icon' (round). */
  variant?: BrainboxLauncherVariant;
  /** Launcher label. Empty (default) = icon-only launcher. */
  text?: string;
  theme?: BrainboxThemeOptions;
  accessibilityLabel?: string;
  /** Hide with a scale-out (e.g. while the chat is open). */
  hidden?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Floating omago launcher: a round blue gradient button with a chat icon (or a pill once a text is set), unread badge. No shadow. */
export function BrainboxLauncher({
  onPress, unread = 0, position = 'bottom-right', offset, size = 60, variant = 'auto', text = '', theme,
  accessibilityLabel, hidden = false, style
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
  const label2 = (text || '').trim();
  const pill = variant === 'button' || (variant === 'auto' && !!label2);
  const h = pill ? 46 : size;
  return (
    <Animated.View
      pointerEvents={hidden ? 'none' : 'auto'}
      style={[
        styles.wrap,
        pill ? { minWidth: 104, height: h, borderRadius: h / 2, bottom: y } : { width: size, height: size, borderRadius: size / 2, bottom: y },
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
        style={[
          pill ? styles.pill : { width: size, height: size, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: 3, borderColor: 'rgba(255,255,255,0.7)' },
          { borderRadius: h / 2, backgroundColor: t.accent }
        ]}
      >
        <BrainboxGradientFill light={t.accentLight} mid={t.accent} deep={t.accentDeep} />
        <BrainboxIcon name="aichat" size={pill ? 22 : Math.round(size * 0.47)} color={t.onAccent} strokeWidth={1.9} />
        {pill ? (
          <Text style={[styles.pillText, { color: t.onAccent }, t.fontFamily ? { fontFamily: t.fontFamily } : null]} numberOfLines={1}>
            {label2 || 'Chat'}
          </Text>
        ) : null}
      </Pressable>
      {unread > 0 ? (
        <View style={[styles.badge, { backgroundColor: t.danger, borderColor: t.panel }]} pointerEvents="none">
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
 * Presents the chat with a slide-up spring. Phones (< 576pt wide): full-screen frosted sheet with a 22pt
 * top radius. Tablets: a 380×600 floating omago window (radius 22, 2pt frosted border, no shadow).
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
        { width: winW, height: winH, backgroundColor: t.panel, borderColor: t.frameBorder, bottom: 24 },
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
        { backgroundColor: t.panel, borderColor: t.frameBorder },
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
  wrap: { position: 'absolute', elevation: 0 },
  pill: {
    height: 46,
    minWidth: 104,
    paddingHorizontal: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden'
  },
  pillText: { fontSize: 15, lineHeight: 18, fontWeight: '700', marginLeft: 10 },
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
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderTopWidth: 2,
    overflow: 'hidden',
    elevation: 0
  },
  window: {
    position: 'absolute',
    borderRadius: 22,
    borderWidth: 2,
    overflow: 'hidden',
    elevation: 0
  }
});
