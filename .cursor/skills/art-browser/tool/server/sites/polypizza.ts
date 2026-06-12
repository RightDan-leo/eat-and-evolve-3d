import type { SiteAdapter } from './adapter';
import type { SearchResult, SearchOptions, AssetDetail, SearchResultItem } from '../../src/types';

const BASE = 'https://poly.pizza';
const STATIC_BASE = 'https://static.poly.pizza';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

async function fetchPage(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, 'Accept': 'text/html' },
  });
  if (!res.ok) throw new Error(`Poly Pizza: HTTP ${res.status}`);
  return res.text();
}

function parseServerAppState(html: string): Record<string, any> | null {
  const match = html.match(/window\.__SERVER_APP_STATE__\s*=\s*({[\s\S]*?})\s*<\/script>/);
  if (!match) return null;
  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}

export function createPolyPizzaAdapter(): SiteAdapter {
  return {
    id: 'polypizza',
    name: 'Poly Pizza',
    icon: '🍕',

    async search(query: string, options?: SearchOptions): Promise<SearchResult> {
      const page = options?.page ?? 1;
      const url = `${BASE}/search/${encodeURIComponent(query)}`;
      const html = await fetchPage(url);
      const items: SearchResultItem[] = [];

      const state = parseServerAppState(html);
      const results: any[] = state?.initialData?.result ?? [];

      for (const r of results) {
        const id = r.publicID || r.PublicID;
        const name = r.title || r.Title;
        if (!id || !name) continue;
        if (items.some((it) => it.id === id)) continue;

        items.push({
          id,
          name,
          source: 'polypizza',
          thumbnail: r.previewUrl || '',
          author: r.creator?.username || 'Unknown',
          license: r.licence || 'CC0',
          formats: ['glb'],
        });
      }

      return {
        query,
        items,
        total: items.length,
        page,
        hasMore: false,
      };
    },

    async getDetail(assetId: string): Promise<AssetDetail> {
      const html = await fetchPage(`${BASE}/m/${assetId}`);
      const state = parseServerAppState(html);
      const model = state?.initialData?.model;

      const resourceId = model?.ResourceID || '';
      const title = model?.Title || assetId;
      const author = model?.Creator?.Username || 'Unknown';
      const licence = model?.Licence || 'CC0';

      const thumbnail = resourceId
        ? `${STATIC_BASE}/${resourceId}.webp`
        : '';
      const downloadUrl = resourceId
        ? `${STATIC_BASE}/${resourceId}.glb`
        : '';

      return {
        id: assetId,
        source: 'polypizza',
        name: title,
        description: `${title} by ${author}`,
        author,
        license: licence,
        thumbnail,
        images: thumbnail ? [thumbnail] : [],
        formats: ['glb'],
        downloadUrl,
      };
    },

    async getDownloadUrl(assetId: string, _format?: string): Promise<string> {
      const html = await fetchPage(`${BASE}/m/${assetId}`);
      const state = parseServerAppState(html);

      const resourceId = state?.initialData?.model?.ResourceID;
      if (resourceId) {
        return `${STATIC_BASE}/${resourceId}.glb`;
      }

      const staticMatch = html.match(/https:\/\/static\.poly\.pizza\/[^"'\s]+\.glb/i);
      if (staticMatch) {
        return staticMatch[0];
      }

      throw new Error(
        `无法从 Poly Pizza 获取下载链接 (model: ${assetId})，页面结构可能已变更`,
      );
    },
  };
}
