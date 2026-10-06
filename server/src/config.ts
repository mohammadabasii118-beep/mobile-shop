import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { GameConfig } from '@game/shared';

export const CONFIG_PATH = fileURLToPath(new URL('../../shared/config/game.json', import.meta.url));

export function loadConfig(path = CONFIG_PATH): GameConfig {
  const cfg = JSON.parse(readFileSync(path, 'utf8')) as GameConfig;
  const ids = new Set(cfg.cards.map((c) => c.id));
  for (const id of cfg.startingDeck) if (!ids.has(id)) throw new Error(`startingDeck: unknown card ${id}`);
  for (const st of cfg.solo.stages) for (const [id] of st.deck) if (!ids.has(id)) throw new Error(`solo: unknown card ${id}`);
  if (cfg.startingDeck.length !== 3) throw new Error('startingDeck must have exactly 3 cards');
  return cfg;
}
