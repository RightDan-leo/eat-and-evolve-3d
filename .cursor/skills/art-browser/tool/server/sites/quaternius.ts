import * as cheerio from 'cheerio';
import type { SiteAdapter } from './adapter';
import type { SearchResult, SearchOptions, AssetDetail, SearchResultItem } from '../../src/types';

const BASE = 'https://quaternius.com';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

async function fetchPage(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, 'Accept': 'text/html' },
  });
  if (!res.ok) throw new Error(`Quaternius: HTTP ${res.status}`);
  return res.text();
}

interface PackEntry extends SearchResultItem {
  tags: string;
}

let cachedPacks: PackEntry[] | null = null;

async function getAllPacks(): Promise<PackEntry[]> {
  if (cachedPacks) return cachedPacks;

  const html = await fetchPage(BASE);
  const $ = cheerio.load(html);
  const items: PackEntry[] = [];

  $('.pack').each((_i, el) => {
    const $pack = $(el);
    const $link = $pack.find('a[href*="/packs/"]').first();
    const href = $link.attr('href') || '';
    const match = href.match(/\/packs\/([^./?#]+)/);
    if (!match) return;

    const id = match[1];
    if (items.some((it) => it.id === id)) return;

    const $img = $pack.find('img').first();
    let thumbnail = $img.attr('src') || $img.attr('data-src') || '';
    if (thumbnail && !thumbnail.startsWith('http')) {
      thumbnail = `${BASE}${thumbnail}`;
    }

    const $packText = $pack.find('.PackText');
    let name = $packText.contents().first().text().trim();
    if (!name || name.length > 100) {
      name = id.replace(/([a-z])([A-Z])/g, '$1 $2')
               .replace(/[-_]/g, ' ')
               .replace(/\b\w/g, (c) => c.toUpperCase());
    }

    const visibleTags: string[] = [];
    $pack.find('.viewtag.tags').each((_j, tagEl) => {
      visibleTags.push($(tagEl).text().trim().toLowerCase());
    });

    const hiddenTags = $pack.find('noscript').text().trim().toLowerCase();

    const tags = [name.toLowerCase(), id.toLowerCase(), ...visibleTags, hiddenTags].join(' ');

    items.push({
      id,
      name,
      source: 'quaternius',
      thumbnail,
      author: 'Quaternius',
      license: 'CC0',
      formats: ['fbx', 'obj', 'blend'],
      tags,
    });
  });

  cachedPacks = items;
  return items;
}

export function createQuaterniusAdapter(): SiteAdapter {
  return {
    id: 'quaternius',
    name: 'Quaternius',
    icon: '🧊',

    async search(query: string, options?: SearchOptions): Promise<SearchResult> {
      const page = options?.page ?? 1;
      const packs = await getAllPacks();
      const q = query.toLowerCase();

      const matched = packs.filter((p) => p.tags.includes(q));

      const start = (page - 1) * 20;
      const paged = matched.slice(start, start + 20);

      return {
        query,
        items: paged,
        total: matched.length,
        page,
        hasMore: start + 20 < matched.length,
      };
    },

    async getDetail(assetId: string): Promise<AssetDetail> {
      const html = await fetchPage(`${BASE}/packs/${assetId}.html`);
      const $ = cheerio.load(html);

      const title = $('h1, h2').first().text().trim() || assetId;
      const thumbnail = $('meta[property="og:image"]').attr('content') ||
                        $('img').first().attr('src') || '';
      const description = $('meta[property="og:description"]').attr('content') || '';

      const images: string[] = [];
      $('img[src]').each((_i, el) => {
        let src = $(el).attr('src') || '';
        if (src && !src.startsWith('http')) src = `${BASE}${src}`;
        if (src && !images.includes(src)) images.push(src);
      });

      let downloadUrl = '';

      $('[onclick*="drive.google.com"]').each((_i, el) => {
        if (downloadUrl) return;
        const onclick = $(el).attr('onclick') || '';
        const urlMatch = onclick.match(/window\.open\('(https:\/\/drive\.google\.com\/[^']+)'/);
        if (urlMatch) downloadUrl = urlMatch[1];
      });

      if (!downloadUrl) {
        $('[onclick*="window.open"]').each((_i, el) => {
          if (downloadUrl) return;
          const onclick = $(el).attr('onclick') || '';
          const text = $(el).text().toLowerCase();
          if (!text.includes('download')) return;
          const urlMatch = onclick.match(/window\.open\('(https?:\/\/[^']+)'/);
          if (urlMatch) downloadUrl = urlMatch[1];
        });
      }

      if (!downloadUrl) {
        $('a[href*=".zip"]').each((_i, el) => {
          if (downloadUrl) return;
          const href = $(el).attr('href') || '';
          if (href.startsWith('http')) downloadUrl = href;
        });
      }

      return {
        id: assetId,
        source: 'quaternius',
        name: title,
        description,
        author: 'Quaternius',
        license: 'CC0',
        thumbnail: thumbnail.startsWith('http') ? thumbnail : `${BASE}${thumbnail}`,
        images,
        formats: ['fbx', 'obj', 'blend'],
        downloadUrl,
      };
    },

    async getDownloadUrl(assetId: string): Promise<string> {
      const detail = await this.getDetail(assetId);
      return detail.downloadUrl;
    },
  };
}
