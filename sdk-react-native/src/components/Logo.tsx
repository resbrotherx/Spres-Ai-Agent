import React, { useRef } from 'react';
import { Image, StyleProp, View, ViewStyle } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

let gid = 0;
function useGradientId(prefix: string): string {
  const ref = useRef<string>();
  if (!ref.current) ref.current = `${prefix}${++gid}`;
  return ref.current;
}

export interface BrainboxLogoProps {
  size?: number;
  style?: StyleProp<ViewStyle>;
  /** Show a custom image instead of the Brainbox mark. */
  logoUrl?: string;
}

/** The Brainbox logo, exactly as in the design spec (64×64 viewBox, scaled). */
export function BrainboxLogo({ size = 32, style, logoUrl }: BrainboxLogoProps) {
  const id = useGradientId('bbLogoG');
  if (logoUrl) {
    return (
      <Image
        source={{ uri: logoUrl }}
        style={[{ width: size, height: size, borderRadius: size * (15 / 64) }, style as any]}
        accessibilityIgnoresInvertColors
      />
    );
  }
  return (
    <View style={[{ width: size, height: size }, style]} accessible accessibilityRole="image" accessibilityLabel="Brainbox">
      <Svg width={size} height={size} viewBox="0 0 64 64">
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#2F7CF6" />
            <Stop offset="1" stopColor="#5E5CE6" />
          </LinearGradient>
        </Defs>
        <Rect width="64" height="64" rx="15" fill={`url(#${id})`} />
        <Path d="M32 15.5 47 24v16L32 48.5 17 40V24z" fill="none" stroke="#fff" strokeWidth={3.2} strokeLinejoin="round" />
        <Path
          d="M17 24l15 8.5L47 24M32 32.5v16"
          fill="none"
          stroke="#fff"
          strokeWidth={3.2}
          strokeLinejoin="round"
          strokeLinecap="round"
          opacity={0.9}
        />
        <Circle cx="32" cy="32.5" r="3.4" fill="#fff" />
        <Path d="M50.5 9.5l1.3 3.2 3.2 1.3-3.2 1.3-1.3 3.2-1.3-3.2-3.2-1.3 3.2-1.3z" fill="#fff" />
      </Svg>
    </View>
  );
}

/** Round launcher mark: the logo geometry on a brand-gradient circle. */
export function BrainboxLauncherMark({ size = 56, from = '#2F7CF6', to = '#5E5CE6' }: { size?: number; from?: string; to?: string }) {
  const id = useGradientId('bbLaunchG');
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={from} />
          <Stop offset="1" stopColor={to} />
        </LinearGradient>
      </Defs>
      <Circle cx="32" cy="32" r="32" fill={`url(#${id})`} />
      {/* logo glyph, scaled to 70% around the centre so it clears the circle edge */}
      <Path
        d="M32 15.5 47 24v16L32 48.5 17 40V24z"
        fill="none"
        stroke="#fff"
        strokeWidth={3.2}
        strokeLinejoin="round"
        transform="translate(9.6 9.6) scale(0.7)"
      />
      <Path
        d="M17 24l15 8.5L47 24M32 32.5v16"
        fill="none"
        stroke="#fff"
        strokeWidth={3.2}
        strokeLinejoin="round"
        strokeLinecap="round"
        opacity={0.9}
        transform="translate(9.6 9.6) scale(0.7)"
      />
      <Circle cx="32" cy="32.5" r="3.4" fill="#fff" transform="translate(9.6 9.6) scale(0.7)" />
      <Path d="M50.5 9.5l1.3 3.2 3.2 1.3-3.2 1.3-1.3 3.2-1.3-3.2-3.2-1.3 3.2-1.3z" fill="#fff" transform="translate(4 4) scale(0.85)" />
    </Svg>
  );
}
