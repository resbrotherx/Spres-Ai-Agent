import React, { ReactNode, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Text, View } from 'react-native';

/** Apple-like sheet easing from the design spec. */
export const EASE_SHEET = Easing.bezier(0.32, 0.72, 0, 1);

/** True when the OS "Reduce motion" setting is on. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled?.()
      .then((v) => alive && setReduced(!!v))
      .catch(() => undefined);
    const sub = AccessibilityInfo.addEventListener?.('reduceMotionChanged', (v: boolean) => setReduced(!!v));
    return () => {
      alive = false;
      sub?.remove?.();
    };
  }, []);
  return reduced;
}

/** Message appear: 220ms translateY 6px + fade (opacity only when motion is reduced). */
export function Appear({ children, enabled, reduced }: { children: ReactNode; enabled: boolean; reduced: boolean }) {
  const v = useRef(new Animated.Value(enabled ? 0 : 1)).current;
  useEffect(() => {
    if (!enabled) return;
    Animated.timing(v, {
      toValue: 1,
      duration: reduced ? 100 : 220,
      easing: EASE_SHEET,
      useNativeDriver: true
    }).start();
  }, [enabled, reduced, v]);
  if (!enabled) return <>{children}</>;
  const style = reduced
    ? { opacity: v }
    : { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [6, 0] }) }] };
  return <Animated.View style={style}>{children}</Animated.View>;
}

/** Three 6px dots with a staggered 1.2s pulse. */
export function TypingDots({ color, reduced }: { color: string; reduced: boolean }) {
  const dots = useRef([0, 1, 2].map(() => new Animated.Value(0))).current;
  useEffect(() => {
    const anims = dots.map((d, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 160),
          Animated.timing(d, { toValue: 1, duration: 300, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(d, { toValue: 0, duration: 300, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.delay(600 - i * 160)
        ])
      )
    );
    anims.forEach((a) => a.start());
    return () => anims.forEach((a) => a.stop());
  }, [dots]);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', height: 22, gap: 4 }} accessibilityLabel="Assistant is typing">
      {dots.map((d, i) => (
        <Animated.View
          key={i}
          style={{
            width: 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: color,
            opacity: d.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }),
            transform: reduced ? [] : [{ scale: d.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) }]
          }}
        />
      ))}
    </View>
  );
}

/** Soft blinking caret ▍ appended to streaming text (state-driven so it works as a nested <Text>). */
export function Caret({ color }: { color: string }) {
  const [on, setOn] = useState(true);
  useEffect(() => {
    const id = setInterval(() => setOn((v) => !v), 530);
    return () => clearInterval(id);
  }, []);
  return <Text style={{ color: on ? color : 'transparent' }}>{' ▍'}</Text>;
}
