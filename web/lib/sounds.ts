/* Tiny synthesized chimes — no audio assets, Web Audio only.
   Autoplay-safe: browsers only allow audio after a user gesture, so
   initSoundUnlock() resumes the context on the first pointer/key press. */

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AC =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AC) return null;
  ctx ??= new AC();
  return ctx;
}

/** Call once on mount: the first interaction unlocks audio for the session. */
export function initSoundUnlock(): () => void {
  const unlock = () => getCtx()?.resume().catch(() => {});
  window.addEventListener("pointerdown", unlock, { once: true });
  window.addEventListener("keydown", unlock, { once: true });
  return () => {
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
  };
}

export function isSoundMuted(): boolean {
  try {
    return localStorage.getItem("marsky-sound") === "off";
  } catch {
    return false;
  }
}

export function setSoundMuted(muted: boolean) {
  try {
    if (muted) localStorage.setItem("marsky-sound", "off");
    else localStorage.removeItem("marsky-sound");
  } catch {
    // private mode etc. — toggle just won't persist
  }
}

type Note = {
  f: number;
  t: number;
  d: number;
  type?: OscillatorType;
  g?: number;
};

const PATTERNS: Record<"due" | "comment" | "added", Note[]> = {
  // Reminder due: three rising chimes — the "pay attention" voice.
  due: [
    { f: 660, t: 0, d: 0.16, type: "triangle", g: 0.14 },
    { f: 880, t: 0.14, d: 0.22, type: "triangle", g: 0.16 },
    { f: 1108, t: 0.3, d: 0.32, type: "sine", g: 0.12 },
  ],
  // Partner commented: one soft blip.
  comment: [{ f: 988, t: 0, d: 0.14, type: "sine", g: 0.12 }],
  // Partner added a task: gentle two-note pop.
  added: [
    { f: 523, t: 0, d: 0.12, type: "sine", g: 0.12 },
    { f: 784, t: 0.11, d: 0.18, type: "sine", g: 0.12 },
  ],
};

export type SoundKind = keyof typeof PATTERNS;

export function playSound(kind: SoundKind) {
  if (isSoundMuted()) return;
  const c = getCtx();
  if (!c) return;
  if (c.state === "suspended") void c.resume().catch(() => {});
  const now = c.currentTime;
  for (const n of PATTERNS[kind]) {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = n.type ?? "sine";
    osc.frequency.value = n.f;
    const t0 = now + n.t;
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(n.g ?? 0.1, t0 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + n.d);
    osc.connect(gain).connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + n.d + 0.02);
  }
}
