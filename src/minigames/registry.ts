import type { TemplateId } from '../core/types';
import { BasketMatch } from './BasketMatch';
import type { MiniGame } from './MiniGame';
import { PollenPop } from './PollenPop';
import { TraceTrail } from './TraceTrail';

// Adding a 4th template = one new file + one line here. Nothing else changes.
export const miniGames: Record<TemplateId, () => MiniGame> = {
  pollenPop: () => new PollenPop(),
  traceTrail: () => new TraceTrail(),
  basketMatch: () => new BasketMatch(),
};
