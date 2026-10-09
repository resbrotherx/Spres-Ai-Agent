/**
 * Tiny WebAudio synth for UI sounds (no audio files). Shared by the chat widgets and the
 * staff dashboard so every Brainbox UI sounds the same. Never throws.
 */
export type BrainboxSound = 'send' | 'receive' | 'notify' | 'success' | 'error';

type Tone = { freq: number; to?: number; start: number; dur: number; type?: OscillatorType; gain: number };

const TONES: Record<BrainboxSound, Tone[]> = {
  send: [{ freq: 880, to: 1320, start: 0, dur: 0.15, gain: 0.05 }],
  receive: [
    { freq: 1046.5, start: 0, dur: 0.12, gain: 0.04 },
    { freq: 1318.5, start: 0.08, dur: 0.2, gain: 0.04 },
  ],
  notify: [
    { freq: 1046.5, start: 0, dur: 0.16, gain: 0.045 },
    { freq: 1318.5, start: 0.07, dur: 0.16, gain: 0.045 },
    { freq: 1567.98, start: 0.14, dur: 0.16, gain: 0.045 },
  ],
  success: [
    { freq: 1318.5, start: 0, dur: 0.14, gain: 0.04 },
    { freq: 1760, start: 0.09, dur: 0.18, gain: 0.04 },
  ],
  error: [
    { freq: 330, start: 0, dur: 0.09, type: 'triangle', gain: 0.05 },
    { freq: 262, start: 0.1, dur: 0.12, type: 'triangle', gain: 0.05 },
  ],
};

const MASTER_VOLUME = 0.6;
let ctx: AudioContext | null = null;
let unlocked = false;

function getContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (ctx) return ctx;
  const Ctor = (window as any).AudioContext || (window as any).webkitAudioContext;
  if (!Ctor) return null;
  try {
    ctx = new Ctor();
  } catch {
    ctx = null;
  }
  return ctx;
}

/** Browsers only allow audio after a user gesture: call once from any click/keydown handler. */
export function unlockSounds(): void {
  if (unlocked) return;
  const c = getContext();
  if (!c) return;
  unlocked = true;
  if (c.state === 'suspended') c.resume().catch(() => undefined);
}

if (typeof window !== 'undefined') {
  const unlock = () => {
    unlockSounds();
    window.removeEventListener('pointerdown', unlock, true);
    window.removeEventListener('keydown', unlock, true);
  };
  window.addEventListener('pointerdown', unlock, true);
  window.addEventListener('keydown', unlock, true);
}

export function playSound(name: BrainboxSound, enabled = true): void {
  if (!enabled) return;
  try {
    if (typeof document !== 'undefined' && document.hidden && name !== 'notify') return;
    const c = getContext();
    if (!c || (!unlocked && c.state === 'suspended')) return;
    const now = c.currentTime + 0.01;
    for (const tone of TONES[name]) {
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = tone.type || 'sine';
      osc.frequency.setValueAtTime(tone.freq, now + tone.start);
      if (tone.to) osc.frequency.exponentialRampToValueAtTime(tone.to, now + tone.start + 0.06);
      const peak = tone.gain * MASTER_VOLUME;
      gain.gain.setValueAtTime(0.0001, now + tone.start);
      gain.gain.exponentialRampToValueAtTime(peak, now + tone.start + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + tone.start + tone.dur);
      osc.connect(gain).connect(c.destination);
      osc.start(now + tone.start);
      osc.stop(now + tone.start + tone.dur + 0.02);
    }
  } catch {
    /* sounds are optional */
  }
}
