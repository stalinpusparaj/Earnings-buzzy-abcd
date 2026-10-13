// Self-hosted glyph fonts (brief §7.3): Baloo 2 for Latin, Baloo Thambi 2 for Tamil, both
// weight 800, files in public/fonts (copied by `npm run fonts`). They're registered as one
// family split by unicode-range, so a single font stack draws both scripts. Glyphs are drawn
// on canvas, where the browser won't wait for a web font, so callers await loadGlyphFonts()
// before the first glyph texture is made.

export const GLYPH_FAMILY = 'Buzzy Glyph';

// Unicode ranges as published with the Fontsource subsets (@fontsource/* 800.css).
const FACES = [
  {
    file: 'baloo-2-latin-800-normal.woff2',
    range: 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD',
  },
  {
    file: 'baloo-thambi-2-tamil-800-normal.woff2',
    range: 'U+0964-0965,U+0B82-0BFA,U+200C-200D,U+20B9,U+25CC',
  },
];

const TIMEOUT_MS = 4000;
let loading: Promise<boolean> | null = null;

/**
 * Registers and loads both faces once. Resolves true when both loaded, false on failure
 * or after a timeout; drawing then falls back to the platform fonts in GLYPH_FONT, so the
 * game never waits on a font for long.
 */
export function loadGlyphFonts(): Promise<boolean> {
  if (loading) return loading;
  if (typeof FontFace === 'undefined' || !document.fonts) return (loading = Promise.resolve(false));
  const faces = FACES.map((f) => {
    const face = new FontFace(GLYPH_FAMILY, `url("${import.meta.env.BASE_URL}fonts/${f.file}") format("woff2")`, {
      weight: '800',
      style: 'normal',
      display: 'block',
      unicodeRange: f.range,
    });
    document.fonts.add(face);
    return face.load();
  });
  const all = Promise.all(faces).then(
    () => true,
    (err: unknown) => {
      console.warn('glyph fonts failed to load; using platform fonts', err);
      return false;
    },
  );
  const timeout = new Promise<boolean>((resolve) => window.setTimeout(() => resolve(false), TIMEOUT_MS));
  loading = Promise.race([all, timeout]);
  return loading;
}
