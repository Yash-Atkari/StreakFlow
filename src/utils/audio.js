// src/utils/audio.js

let audioCtx = null;

function getAudioContext() {
  if (!audioCtx) {
    // Standard AudioContext initialization with browser fallback
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  
  // Resume context if it was suspended (autoplay prevention)
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  
  return audioCtx;
}

/**
 * Synthesizes a beautiful bell chime note.
 */
function playNote(freq, startTime, duration, type = "sine", gainVal = 0.15) {
  const ctx = getAudioContext();
  if (!ctx) return null;

  const osc = ctx.createOscillator();
  const gainNode = ctx.createGain();
  
  osc.type = type;
  osc.frequency.setValueAtTime(freq, startTime);
  
  // Smooth envelope: rapid attack, nice exponential decay
  gainNode.gain.setValueAtTime(0, startTime);
  gainNode.gain.linearRampToValueAtTime(gainVal, startTime + 0.01);
  gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
  
  osc.connect(gainNode);
  gainNode.connect(ctx.destination);
  
  osc.start(startTime);
  osc.stop(startTime + duration);
  
  return osc;
}

/**
 * Success / Check-in: Ascending pentatonic chime (C5 -> E5 -> G5 -> C6)
 */
export function playSuccessChime() {
  const ctx = getAudioContext();
  if (!ctx) return;
  
  const now = ctx.currentTime;
  const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
  const spacing = 0.08;
  const duration = 0.45;
  
  notes.forEach((freq, idx) => {
    // Play with sine for body, and a quieter triangle for mechanical punch
    playNote(freq, now + idx * spacing, duration, "sine", 0.12);
    playNote(freq, now + idx * spacing, duration * 0.7, "triangle", 0.04);
  });
}

/**
 * Undo / Uncheck: Descending chime (C6 -> G5 -> E5 -> C5)
 */
export function playUndoSound() {
  const ctx = getAudioContext();
  if (!ctx) return;
  
  const now = ctx.currentTime;
  const notes = [1046.50, 783.99, 659.25, 523.25]; // C6, G5, E5, C5
  const spacing = 0.08;
  const duration = 0.4;
  
  notes.forEach((freq, idx) => {
    playNote(freq, now + idx * spacing, duration, "sine", 0.1);
  });
}

/**
 * Streak Milestone: Shimmering sparkling arpeggio
 */
export function playStreakCelebration() {
  const ctx = getAudioContext();
  if (!ctx) return;
  
  const now = ctx.currentTime;
  // Sparkling arpeggio spanning two octaves
  const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51, 1567.98, 2093.00]; // C5, E5, G5, C6, E6, G6, C7
  const spacing = 0.06;
  const duration = 0.8;
  
  notes.forEach((freq, idx) => {
    // Shimmer effect: Sine waves with subtle high-frequency delay
    playNote(freq, now + idx * spacing, duration, "sine", 0.08);
    // Add tiny detuned harmonics to create a metallic sheen
    playNote(freq * 1.005, now + idx * spacing + 0.01, duration * 0.5, "sine", 0.03);
  });
}

/**
 * Interface Tap: A very quick, satisfying organic click
 */
export function playTap() {
  const ctx = getAudioContext();
  if (!ctx) return;
  
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gainNode = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  
  // Sweep frequency down rapidly to create a mechanical woodblock tap
  osc.frequency.setValueAtTime(800, now);
  osc.frequency.exponentialRampToValueAtTime(150, now + 0.04);
  
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(1000, now);
  filter.frequency.exponentialRampToValueAtTime(200, now + 0.04);
  
  gainNode.gain.setValueAtTime(0.08, now);
  gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.045);
  
  osc.connect(filter);
  filter.connect(gainNode);
  gainNode.connect(ctx.destination);
  
  osc.start(now);
  osc.stop(now + 0.05);
}

/**
 * Shield claim: Retro futuristic sweep upwards (Charge effect)
 */
export function playShieldCharge() {
  const ctx = getAudioContext();
  if (!ctx) return;
  
  const now = ctx.currentTime;
  const duration = 0.6;
  
  // Rising frequency sweep
  const osc1 = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  const gainNode = ctx.createGain();
  
  osc1.type = "sine";
  osc1.frequency.setValueAtTime(220, now); // A3
  osc1.frequency.exponentialRampToValueAtTime(880, now + duration); // A5
  
  osc2.type = "triangle";
  osc2.frequency.setValueAtTime(277.18, now); // C#4 (Creating a major chord vibe)
  osc2.frequency.exponentialRampToValueAtTime(1108.73, now + duration); // C#6
  
  gainNode.gain.setValueAtTime(0, now);
  gainNode.gain.linearRampToValueAtTime(0.12, now + 0.05);
  gainNode.gain.linearRampToValueAtTime(0.08, now + duration * 0.5);
  gainNode.gain.exponentialRampToValueAtTime(0.001, now + duration);
  
  osc1.connect(gainNode);
  osc2.connect(gainNode);
  gainNode.connect(ctx.destination);
  
  osc1.start(now);
  osc2.start(now);
  
  osc1.stop(now + duration);
  osc2.stop(now + duration);
}

/**
 * Error / Action prohibited: Low pitch double pluck
 */
export function playErrorPluck() {
  const ctx = getAudioContext();
  if (!ctx) return;
  
  const now = ctx.currentTime;
  
  // Pluck 1
  playNote(110.00, now, 0.15, "sawtooth", 0.08); // A2
  // Pluck 2 (delayed and lower)
  playNote(82.41, now + 0.12, 0.25, "sawtooth", 0.08); // E2
}

/**
 * Resonant theme change sweep
 */
export function playThemeSweep() {
  const ctx = getAudioContext();
  if (!ctx) return;
  
  const now = ctx.currentTime;
  const duration = 0.5;
  
  const osc = ctx.createOscillator();
  const gainNode = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  
  osc.type = "sine";
  osc.frequency.setValueAtTime(440, now);
  osc.frequency.exponentialRampToValueAtTime(220, now + duration);
  
  filter.type = "lowpass";
  filter.Q.setValueAtTime(10, now);
  filter.frequency.setValueAtTime(100, now);
  filter.frequency.exponentialRampToValueAtTime(1500, now + duration * 0.4);
  filter.frequency.exponentialRampToValueAtTime(200, now + duration);
  
  gainNode.gain.setValueAtTime(0, now);
  gainNode.gain.linearRampToValueAtTime(0.1, now + 0.05);
  gainNode.gain.exponentialRampToValueAtTime(0.001, now + duration);
  
  osc.connect(filter);
  filter.connect(gainNode);
  gainNode.connect(ctx.destination);
  
  osc.start(now);
  osc.stop(now + duration);
}
