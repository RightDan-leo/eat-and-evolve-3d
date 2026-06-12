import type { SiteAdapter } from './adapter';
import { createPolyPizzaAdapter } from './polypizza';
import { createKenneyAdapter } from './kenney';
import { createKayLousbergAdapter } from './kaylousberg';
import { createQuaterniusAdapter } from './quaternius';
import { createSketchfabAdapter } from './sketchfab';

export { getSiteInfoList } from './adapter';
export type { SiteAdapter } from './adapter';

export function createAdapters(): Map<string, SiteAdapter> {
  const map = new Map<string, SiteAdapter>();
  const adapters = [
    createSketchfabAdapter(),
    createPolyPizzaAdapter(),
    createKenneyAdapter(),
    createKayLousbergAdapter(),
    createQuaterniusAdapter(),
  ];
  for (const a of adapters) {
    map.set(a.id, a);
  }
  return map;
}
