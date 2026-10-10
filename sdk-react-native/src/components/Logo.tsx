import React, { useRef } from 'react';
import { Image, StyleProp, View, ViewStyle } from 'react-native';
import Svg, { Circle, ClipPath, Defs, LinearGradient, Path, Polygon, RadialGradient, Rect, Stop } from 'react-native-svg';

let gid = 0;
function useGradientId(prefix: string): string {
  const ref = useRef<string>();
  if (!ref.current) ref.current = `${prefix}${++gid}`;
  return ref.current;
}

export interface BrainboxOrbColors {
  core?: string;
  mid?: string;
  rim?: string;
}

export interface BrainboxLogoProps {
  size?: number;
  style?: StyleProp<ViewStyle>;
  /** Show a custom image instead of the Brainbox mark. */
  logoUrl?: string;
  /** 'orb' (default): the omago blue orb. 'cube': the classic Brainbox cube mark. */
  variant?: 'orb' | 'cube';
  /** Override the orb gradient stops (default #9dbcff -> #2f6bff -> #1d3fae). */
  colors?: BrainboxOrbColors;
}

/**
 * The omago orb: a radial blue gradient (#9dbcff -> #2f6bff -> #1d3fae, soft rim), a white highlight
 * and the white speaker glyph, on a 64×64 viewBox.
 */
export function BrainboxOrb({ size = 38, colors }: { size?: number; colors?: BrainboxOrbColors }) {
  const g = useGradientId('bbOrbG');
  const c = useGradientId('bbOrbC');
  const core = colors?.core || '#9dbcff';
  const mid = colors?.mid || '#2f6bff';
  const rim = colors?.rim || '#1d3fae';
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Defs>
        <RadialGradient id={g} cx="32" cy="32" r="32" fx="32" fy="32" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={core} />
          <Stop offset="0.2" stopColor={core} />
          <Stop offset="0.59" stopColor={mid} />
          <Stop offset="0.93" stopColor={rim} />
          <Stop offset="1" stopColor={rim} stopOpacity={0.35} />
        </RadialGradient>
        <ClipPath id={c}>
          <Circle cx="32" cy="32" r="14.3" />
        </ClipPath>
      </Defs>
      <Circle cx="32" cy="32" r="32" fill={`url(#${g})`} />
      <Circle cx="23" cy="17.9" r="7.4" fill="#fff" fillOpacity={0.95} />
      <Polygon points="17.7,32 32.9,22 46.3,17.7 46.3,46.3 32.9,42" fill="#fff" clipPath={`url(#${c})`} />
    </Svg>
  );
}

/** The Brainbox logo: the blue orb by default (or the classic cube, or your own image). */
export function BrainboxLogo({ size = 38, style, logoUrl, variant = 'orb', colors }: BrainboxLogoProps) {
  const id = useGradientId('bbLogoG');
  if (logoUrl) {
    return (
      <Image
        source={{ uri: logoUrl }}
        style={[{ width: size, height: size, borderRadius: variant === 'cube' ? size * (15 / 64) : size / 2 }, style as any]}
        accessibilityIgnoresInvertColors
      />
    );
  }
  if (variant === 'orb') {
    return (
      <View style={[{ width: size, height: size }, style]} accessible accessibilityRole="image" accessibilityLabel="Brainbox">
        <BrainboxOrb size={size} colors={colors} />
      </View>
    );
  }
  return (
    <View style={[{ width: size, height: size }, style]} accessible accessibilityRole="image" accessibilityLabel="Brainbox">
      <Svg width={size} height={size} viewBox="0 0 64 64">
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#9dbcff" />
            <Stop offset="1" stopColor="#1d3fae" />
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

/**
 * Accent gradient fill (radial, light at the top-left) that stretches to its parent. Used behind the
 * launcher pill and the send button. Place it first inside a view with `overflow: 'hidden'`.
 */
export function BrainboxGradientFill({
  light, mid, deep, cx = '20%', cy = '20%'
}: { light: string; mid: string; deep: string; cx?: string; cy?: string }) {
  const id = useGradientId('bbFillG');
  return (
    <Svg width="100%" height="100%" style={{ position: 'absolute', top: 0, left: 0 }} preserveAspectRatio="none">
      <Defs>
        <RadialGradient id={id} cx={cx} cy={cy} r="100%" fx={cx} fy={cy}>
          <Stop offset="0" stopColor={light} />
          <Stop offset="0.5" stopColor={mid} />
          <Stop offset="1" stopColor={deep} />
        </RadialGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
    </Svg>
  );
}

/** Lavender body background: a vertical gradient with a soft glow on the right (omago body). */
export function BrainboxPanelBackground({ from, to, glow }: { from: string; to: string; glow: string }) {
  const lin = useGradientId('bbBodyL');
  const rad = useGradientId('bbBodyR');
  return (
    <Svg width="100%" height="100%" style={{ position: 'absolute', top: 0, left: 0 }} preserveAspectRatio="none" pointerEvents="none">
      <Defs>
        <LinearGradient id={lin} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={from} />
          <Stop offset="1" stopColor={to} />
        </LinearGradient>
        <RadialGradient id={rad} cx="86%" cy="42%" r="30%" fx="86%" fy="42%">
          <Stop offset="0" stopColor={glow} />
          <Stop offset="1" stopColor={glow} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${lin})`} />
      <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${rad})`} />
    </Svg>
  );
}

/** Round launcher mark: the orb-style accent circle with a white chat glyph. */
export function BrainboxLauncherMark({ size = 56, from = '#9dbcff', to = '#1d3fae' }: { size?: number; from?: string; to?: string }) {
  const id = useGradientId('bbLaunchG');
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Defs>
        <RadialGradient id={id} cx="20%" cy="20%" r="100%" fx="20%" fy="20%">
          <Stop offset="0" stopColor={from} />
          <Stop offset="1" stopColor={to} />
        </RadialGradient>
      </Defs>
      <Circle cx="32" cy="32" r="32" fill={`url(#${id})`} />
      <Path
        d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"
        fill="none"
        stroke="#fff"
        strokeWidth={1.9}
        strokeLinejoin="round"
        strokeLinecap="round"
        transform="translate(18 18) scale(1.1667)"
      />
    </Svg>
  );
}
