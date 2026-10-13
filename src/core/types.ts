export type Lang = 'en' | 'ta';
export type TemplateId = 'pollenPop' | 'traceTrail' | 'basketMatch';
export type Tolerance = 'little' | 'big';

export type LetterDef = {
  id: string; // "A", or ASCII ids for Tamil: "ta_a", "ta_aa"…
  lang: Lang;
  glyph: string;
  word: string;
  wordRoman?: string; // reference only, never shown to kids
  objectModel: string; // → assets/models/{objectModel}.glb
  template: TemplateId;
  distractors: string[]; // glyphs for Pollen Pop
  matchDistractors: string[]; // objectModel ids for Basket Match
  vo: { intro: string; isFor: string; sound: string };
  songSlice?: { start: number; end: number };
};

export type Point2 = readonly [number, number];
export type StrokeDef = { id: string; strokes: Point2[][] };
