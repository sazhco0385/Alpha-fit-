// Lightweight beep/tone helper using Web Audio API.
// No asset needed — generates oscillator tones in the browser.

let ctx = null;

function getCtx() {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

/**
 * Play a single tone.
 * @param {number} freq - Frequency in Hz (e.g. 800)
 * @param {number} duration - Duration in seconds (e.g. 0.15)
 * @param {number} volume - 0..1 (default 0.25)
 * @param {string} type - "sine" | "square" | "triangle" | "sawtooth"
 */
export function playTone(freq = 800, duration = 0.15, volume = 0.25, type = "sine") {
  try {
    const c = getCtx();
    if (!c) return;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, c.currentTime);
    gain.gain.setValueAtTime(0, c.currentTime);
    gain.gain.linearRampToValueAtTime(volume, c.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + duration);
    osc.connect(gain).connect(c.destination);
    osc.start(c.currentTime);
    osc.stop(c.currentTime + duration + 0.05);
  } catch {
    // silent
  }
}

/** Short pip used for 3,2,1 countdown */
export function playCountdownBeep() {
  playTone(660, 0.12, 0.2, "sine");
  vibrate(40);
}

/** Triumphant "rest over" chord */
export function playRestOverChime() {
  // 3-note ascending: C5 E5 G5
  playTone(523.25, 0.18, 0.28, "triangle"); // C5
  setTimeout(() => playTone(659.25, 0.18, 0.28, "triangle"), 130); // E5
  setTimeout(() => playTone(783.99, 0.34, 0.32, "triangle"), 260); // G5
  vibrate([90, 50, 90, 50, 180]);
}

function vibrate(pattern) {
  try {
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(pattern);
    }
  } catch {}
}

// User-preference helpers (read by ActiveWorkout)
const KEY = "alphafit_sound_enabled";
export function isSoundEnabled() {
  if (typeof window === "undefined") return true;
  const v = localStorage.getItem(KEY);
  return v === null ? true : v === "1";
}
export function setSoundEnabled(enabled) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, enabled ? "1" : "0");
}
