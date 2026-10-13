import { describe, expect, it } from 'vitest';
import { CueTracker, roundCueTime, uncuedLetters, validateCues, type Cue } from '../../src/core/cues';

const letters = ['A', 'B', 'C', 'D', 'E', 'F'].map((id) => ({ id }));
const cues: Cue[] = [
  { id: 'A', t: 4.2 },
  { id: 'B', t: 7.9 },
  { id: 'C', t: 11.5 },
];

describe('validateCues', () => {
  it('accepts a valid list (and an empty one)', () => {
    expect(validateCues(cues, letters, 60)).toEqual([]);
    expect(validateCues([], letters)).toEqual([]);
  });

  it('rejects non-arrays, unknown letters, bad or out-of-order times and times past the song', () => {
    expect(validateCues({ id: 'A', t: 1 }, letters)).toHaveLength(1);
    expect(validateCues([{ id: 'Z', t: 1 }], letters)[0]).toMatch(/not a letter/);
    expect(validateCues([{ id: 'A', t: -1 }], letters)[0]).toMatch(/≥ 0/);
    expect(validateCues([{ id: 'A', t: '4' }], letters)[0]).toMatch(/number/);
    expect(validateCues([{ id: 'A', t: 5 }, { id: 'B', t: 3 }], letters)[0]).toMatch(/in order/);
    expect(validateCues([{ id: 'A', t: 70 }], letters, 60)[0]).toMatch(/past the end/);
  });

  it('allows a letter to be cued more than once (the chorus names A to F again)', () => {
    expect(validateCues([...cues, { id: 'A', t: 30 }], letters)).toEqual([]);
  });

  it('lists letters with no cue', () => {
    expect(uncuedLetters(cues, letters)).toEqual(['D', 'E', 'F']);
  });

  it('rounds times to centiseconds', () => {
    expect(roundCueTime(4.20499)).toBe(4.2);
    expect(roundCueTime(4.205)).toBe(4.21);
  });
});

describe('CueTracker', () => {
  it('fires each cue once, in order, as time passes it', () => {
    const t = new CueTracker(cues);
    expect(t.update(0)).toEqual([]);
    expect(t.update(4.19)).toEqual([]);
    expect(t.update(4.2)).toEqual([cues[0]]);
    expect(t.update(5)).toEqual([]);
    expect(t.update(12)).toEqual([cues[1], cues[2]]);
    expect(t.update(20)).toEqual([]);
  });

  it('sorts its input', () => {
    const t = new CueTracker([cues[2], cues[0], cues[1]]);
    expect(t.update(100).map((c) => c.id)).toEqual(['A', 'B', 'C']);
  });

  it('re-arms the cues after a backward seek', () => {
    const t = new CueTracker(cues);
    t.update(12);
    expect(t.update(5)).toEqual([]);
    expect(t.update(8)).toEqual([cues[1]]);
  });

  it('seek() skips cues before the new position', () => {
    const t = new CueTracker(cues);
    t.seek(5);
    expect(t.update(12).map((c) => c.id)).toEqual(['B', 'C']);
  });
});
