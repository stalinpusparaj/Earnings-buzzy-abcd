import type { Cue } from '../core/cues';

/** Peak amplitude per column of the song, for drawing (null if the file can't be decoded). */
export async function songPeaks(url: string, columns: number): Promise<Float32Array | null> {
  try {
    const bytes = await (await fetch(url)).arrayBuffer();
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    const ctx = new Ctor();
    const buf = await ctx.decodeAudioData(bytes);
    void ctx.close();
    const data = buf.getChannelData(0);
    const peaks = new Float32Array(columns);
    const per = Math.max(1, Math.floor(data.length / columns));
    for (let c = 0; c < columns; c++) {
      let max = 0;
      for (let i = c * per, end = Math.min(data.length, i + per); i < end; i++) max = Math.max(max, Math.abs(data[i]));
      peaks[c] = max;
    }
    return peaks;
  } catch {
    return null;
  }
}

export type WaveView = { peaks: Float32Array | null; duration: number; time: number; cues: readonly Cue[]; glyphOf: (id: string) => string };

/** Waveform, cue markers with their glyphs, and the playhead. */
export function drawWave(canvas: HTMLCanvasElement, v: WaveView): void {
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (canvas.width !== Math.round(w * dpr)) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#1d1a17';
  ctx.fillRect(0, 0, w, h);
  const mid = h * 0.58;
  if (v.peaks) {
    ctx.fillStyle = '#5b5048';
    for (let x = 0; x < w; x++) {
      const p = v.peaks[Math.floor((x / w) * v.peaks.length)] ?? 0;
      const ph = Math.max(1, p * h * 0.4);
      ctx.fillRect(x, mid - ph, 1, ph * 2);
    }
  }
  if (!(v.duration > 0)) return;
  ctx.font = '700 15px "Buzzy Glyph", system-ui, sans-serif';
  ctx.textAlign = 'center';
  v.cues.forEach((c) => {
    const x = (c.t / v.duration) * w;
    ctx.fillStyle = '#FFD23F';
    ctx.fillRect(x - 1, 22, 2, h - 22);
    ctx.fillText(v.glyphOf(c.id), x, 16);
  });
  ctx.fillStyle = '#6FD3E8';
  ctx.fillRect((v.time / v.duration) * w - 1, 0, 2, h);
}
