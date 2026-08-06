// Lightweight Web Audio sound effects — no audio files needed, synthesized on the fly.
// Respects a user mute setting stored in localStorage ("sound_enabled", default "true").

let _ctx = null;
function ctx() {
  if (typeof window === 'undefined') return null;
  if (!_ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    _ctx = new AC();
  }
  // Some browsers start the context suspended until a user gesture.
  if (_ctx.state === 'suspended') _ctx.resume();
  return _ctx;
}

export function isSoundEnabled() {
  try { return localStorage.getItem('sound_enabled') !== 'false'; } catch { return true; }
}

export function setSoundEnabled(v) {
  try { localStorage.setItem('sound_enabled', String(v)); } catch { /* ignore */ }
}

// Play a single tone with a gentle envelope.
function tone(freq, startAt, dur, type = 'sine', gain = 0.15) {
  const ac = ctx();
  if (!ac) return;
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, ac.currentTime + startAt);
  // envelope: quick attack, smooth decay
  g.gain.setValueAtTime(0.0001, ac.currentTime + startAt);
  g.gain.exponentialRampToValueAtTime(gain, ac.currentTime + startAt + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + startAt + dur);
  o.connect(g);
  g.connect(ac.destination);
  o.start(ac.currentTime + startAt);
  o.stop(ac.currentTime + startAt + dur + 0.02);
}

function play(seq) {
  if (!isSoundEnabled()) return;
  try {
    seq(); // builds scheduled tones
  } catch { /* ignore audio failures */ }
}

// Correct guess: bright ascending arpeggio
export function playCorrect() {
  play(() => {
    tone(523.25, 0, 0.12, 'triangle', 0.18);   // C5
    tone(659.25, 0.10, 0.12, 'triangle', 0.18); // E5
    tone(783.99, 0.20, 0.18, 'triangle', 0.20); // G5
    tone(1046.5, 0.32, 0.22, 'triangle', 0.18); // C6
  });
}

// Wrong guess: dull descending buzz
export function playWrong() {
  play(() => {
    tone(220, 0, 0.18, 'sawtooth', 0.12);
    tone(196, 0.12, 0.22, 'sawtooth', 0.12);
    tone(155.56, 0.26, 0.30, 'sawtooth', 0.12); // Eb3
  });
}

// Someone else guessed correctly (alert): two-note chime
export function playAlert() {
  play(() => {
    tone(880, 0, 0.14, 'sine', 0.14);   // A5
    tone(1174.66, 0.12, 0.20, 'sine', 0.14); // D6
  });
}

// Soft ding when a hint is submitted
export function playHint() {
  play(() => {
    tone(987.77, 0, 0.18, 'sine', 0.12); // B5
  });
}

// Short tick when a new question appears
export function playPop() {
  play(() => {
    tone(660, 0, 0.08, 'triangle', 0.08);
  });
}
// Cosmetic unlock: sparkly rising run with a shimmer on top
export function playUnlock() {
  play(() => {
    tone(659.25, 0, 0.10, 'triangle', 0.14);    // E5
    tone(783.99, 0.08, 0.10, 'triangle', 0.16); // G5
    tone(1046.5, 0.16, 0.14, 'triangle', 0.18); // C6
    tone(1318.5, 0.26, 0.22, 'triangle', 0.16); // E6
    tone(2093.0, 0.30, 0.30, 'sine', 0.10);     // C7 shimmer
  });
}
