import type { SiteAdapter } from './adapter';
import type { SearchResult, SearchOptions, AssetDetail, SearchResultItem } from '../../src/types';

const API_BASE = 'https://api.sketchfab.com/v3';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const FREE_LICENSES = ['by', 'by-sa', 'by-nd', 'cc0'];

const LICENSE_LABELS: Record<string, string> = {
  by: 'CC-BY',
  'by-sa': 'CC-BY-SA',
  'by-nd': 'CC-BY-ND',
  'by-nc': 'CC-BY-NC',
  'by-nc-sa': 'CC-BY-NC-SA',
  'by-nc-nd': 'CC-BY-NC-ND',
  cc0: 'CC0',
};

interface SketchfabModel {
  uid: string;
  name: string;
  animationCount?: number;
  viewerUrl?: string;
  user?: { username?: string; displayName?: string };
  isDownloadable?: boolean;
  thumbnails?: { images?: Array<{ url: string; width: number; height: number }> };
  license?: { slug?: string; label?: string };
  archives?: Record<string, { size?: number }>;
}

interface SketchfabSearchResponse {
  results: SketchfabModel[];
  next: string | null;
  previous: string | null;
  cursors?: { next?: string; previous?: string };
}

function pickThumbnail(model: SketchfabModel): string {
  const images = model.thumbnails?.images;
  if (!images?.length) return '';
  const medium = images.find((img) => img.width >= 200 && img.width <= 512);
  return (medium || images[images.length - 1]).url;
}

function parseLicense(model: SketchfabModel): string {
  const slug = model.license?.slug || '';
  return LICENSE_LABELS[slug] || model.license?.label || slug || 'Unknown';
}

let nextCursor: string | null = null;
let lastQuery = '';

export function createSketchfabAdapter(): SiteAdapter {
  return {
    id: 'sketchfab',
    name: 'Sketchfab',
    icon: '🎭',

    async search(query: string, options?: SearchOptions): Promise<SearchResult> {
      const page = options?.page ?? 1;
      const animated = options?.animated ?? false;

      if (query !== lastQuery || page === 1) {
        nextCursor = null;
        lastQuery = query;
      }

      const params = new URLSearchParams({
        type: 'models',
        q: query,
        downloadable: 'true',
      });

      for (const lic of FREE_LICENSES) {
        params.append('license', lic);
      }

      if (animated) {
        params.set('animated', 'true');
      }

      if (nextCursor && page > 1) {
        params.set('cursor', nextCursor);
      }

      const url = `${API_BASE}/search?${params}`;
      const res = await fetch(url, {
        headers: { 'User-Agent': UA },
      });

      if (!res.ok) {
        throw new Error(`Sketchfab: HTTP ${res.status}`);
      }

      const data: SketchfabSearchResponse = await res.json();
      nextCursor = data.cursors?.next ?? null;

      const items: SearchResultItem[] = [];

      for (const model of data.results) {
        if (items.some((it) => it.id === model.uid)) continue;

        items.push({
          id: model.uid,
          name: model.name,
          source: 'sketchfab',
          thumbnail: pickThumbnail(model),
          author: model.user?.displayName || model.user?.username || 'Unknown',
          license: parseLicense(model),
          formats: ['glb', 'gltf'],
          animated: (model.animationCount ?? 0) > 0,
          animationCount: model.animationCount ?? 0,
        });
      }

      return {
        query,
        items,
        total: items.length,
        page,
        hasMore: !!data.next,
      };
    },

    async getDetail(assetId: string): Promise<AssetDetail> {
      const url = `${API_BASE}/models/${assetId}`;
      const res = await fetch(url, {
        headers: { 'User-Agent': UA },
      });

      if (!res.ok) throw new Error(`Sketchfab: HTTP ${res.status}`);

      const model: SketchfabModel & {
        description?: string;
        viewerUrl?: string;
      } = await res.json();

      const thumbnail = pickThumbnail(model);
      const images = model.thumbnails?.images?.map((img) => img.url) || [];

      return {
        id: assetId,
        source: 'sketchfab',
        name: model.name,
        description: model.description || '',
        author: model.user?.displayName || model.user?.username || 'Unknown',
        license: parseLicense(model),
        thumbnail,
        images,
        formats: ['glb', 'gltf'],
        downloadUrl: model.viewerUrl || `https://sketchfab.com/3d-models/${assetId}`,
      };
    },

    async getDownloadUrl(assetId: string): Promise<string> {
      const apiToken = process.env.SKETCHFAB_API_TOKEN;
      if (apiToken) {
        const res = await fetch(`${API_BASE}/models/${assetId}/download`, {
          headers: {
            'User-Agent': UA,
            'Authorization': `Token ${apiToken}`,
          },
        });
        if (res.ok) {
          const data = await res.json();
          if (data.gltf?.url) return data.gltf.url;
          if (data.glb?.url) return data.glb.url;
        }
      }

      return `https://sketchfab.com/3d-models/${assetId}`;
    },
  };
}
