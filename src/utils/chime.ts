// A short, soft two-note chime made with the Web Audio API, so the extension needs
// no audio file. Used by the offscreen page (phase end) and the "Test sound" button.

export async function playChime(): Promise<void> {
  const context = new AudioContext();
  try {
    await context.resume();
    const start = context.currentTime + 0.02;
    [659.25, 880].forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const at = start + index * 0.22;
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(0.25, at + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.5);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(at);
      oscillator.stop(at + 0.55);
    });
    await new Promise((resolve) => setTimeout(resolve, 900));
  } finally {
    await context.close();
  }
}
