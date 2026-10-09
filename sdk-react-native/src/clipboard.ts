/** Anything with `setString` (RN core / @react-native-clipboard) or `setStringAsync` (expo-clipboard). */
export interface BrainboxClipboard {
  setString?: (text: string) => void;
  setStringAsync?: (text: string) => Promise<unknown>;
}

/**
 * Resolve a clipboard: the one passed in, else React Native's core `Clipboard` when this RN version
 * still ships it (checked via the property descriptor so the deprecation getter only runs on copy).
 * Returns null when none is available — the copy button is then hidden.
 */
export function resolveClipboard(custom?: BrainboxClipboard | null): BrainboxClipboard | null {
  if (custom === null) return null;
  if (custom && (custom.setString || custom.setStringAsync)) return custom;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const RN = require('react-native');
    if (!RN || !Object.getOwnPropertyDescriptor(RN, 'Clipboard')) return null;
    return {
      setString: (text: string) => {
        try {
          RN.Clipboard?.setString?.(text);
        } catch {
          /* removed in this RN version */
        }
      }
    };
  } catch {
    return null;
  }
}

export async function copyText(clip: BrainboxClipboard | null, text: string): Promise<boolean> {
  if (!clip) return false;
  try {
    if (clip.setStringAsync) await clip.setStringAsync(text);
    else clip.setString?.(text);
    return true;
  } catch {
    return false;
  }
}
