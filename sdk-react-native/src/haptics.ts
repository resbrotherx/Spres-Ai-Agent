import { Platform, Vibration } from 'react-native';

export type BrainboxHapticType = 'send' | 'receive' | 'error' | 'selection';
/** `true` = built-in tiny vibration (Android), `false` = off, or your own function (e.g. expo-haptics). */
export type BrainboxHaptics = boolean | ((type: BrainboxHapticType) => void);

const DURATION: Record<BrainboxHapticType, number> = { send: 8, receive: 12, error: 20, selection: 5 };

/**
 * Fire a tiny haptic. The built-in fallback uses `Vibration` on Android only (needs the
 * android.permission.VIBRATE permission, which Expo includes by default). iOS ignores
 * vibration durations and always buzzes ~400ms, so it stays silent there unless you pass a
 * function, e.g. `haptics={(t) => Haptics.selectionAsync()}` with expo-haptics.
 */
export function triggerHaptic(haptics: BrainboxHaptics | undefined, type: BrainboxHapticType): void {
  if (haptics === false) return;
  try {
    if (typeof haptics === 'function') {
      haptics(type);
      return;
    }
    if (Platform.OS === 'android') Vibration.vibrate(DURATION[type]);
  } catch {
    /* never throw from a haptic */
  }
}
