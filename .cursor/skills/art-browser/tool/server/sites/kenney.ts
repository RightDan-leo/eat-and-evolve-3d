import * as cheerio from 'cheerio';
import type { SiteAdapter } from './adapter';
import type { SearchResult, SearchOptions, AssetDetail, SearchResultItem } from '../../src/types';

const BASE = 'https://kenney.nl';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

async function fetchPage(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, 'Accept': 'text/html' },
  });
  if (!res.ok) throw new Error(`Kenney: HTTP ${res.status}`);
  return res.text();
}

function parseAssetCards($: cheerio.CheerioAPI): SearchResultItem[] {
  const items: SearchResultItem[] = [];

  $('.asset').each((_i, el) => {
    const $asset = $(el);
    const $link = $asset.find('a[href*="/assets/"]').first();
    const href = $link.attr('href') || '';
    const match = href.match(/\/assets\/([^/?#]+)$/);
    if (!match) return;

    const id = match[1];
    if (items.some((it) => it.id === id)) return;

    const $h2 = $asset.find('h2');
    const name = $h2.text().trim() || id;

    let thumbnail = '';
    const $cover = $asset.find('.cover');
    if ($cover.length) {
      const bgStyle = $cover.attr('style') || '';
      const bgMatch = bgStyle.match(/url\("([^"]+)"\)/);
      if (bgMatch) thumbnail = bgMatch[1];
    }

    const categories: string[] = [];
    $asset.find('.text-muted a').each((_j, tagEl) => {
      categories.push($(tagEl).text().trim());
    });

    items.push({
      id,
      name,
      source: 'kenney',
      thumbnail,
      author: 'Kenney',
      license: 'CC0',
      formats: ['zip'],
    });
  });

  return items;
}

export function createKenneyAdapter(): SiteAdapter {
  return {
    id: 'kenney',
    name: 'Kenney',
    icon: '🎮',

    async search(query: string, options?: SearchOptions): Promise<SearchResult> {
      const page = options?.page ?? 1;
      const url = `${BASE}/assets?search=${encodeURIComponent(query)}`;
      const html = await fetchPage(url);
      const $ = cheerio.load(html);
      const items = parseAssetCards($);

      const start = (page - 1) * 20;
      const paged = items.slice(start, start + 20);

      return {
        query,
        items: paged,
        total: items.length,
        page,
        hasMore: start + 20 < items.length,
      };
    },

    async getDetail(assetId: string): Promise<AssetDetail> {
      const html = await fetchPage(`${BASE}/assets/${assetId}`);
      const $ = cheerio.load(html);

      const title = $('h1').first().text().trim() || assetId;
      const description = $('meta[name="description"]').attr('content') ||
                          $('meta[property="og:description"]').attr('content') || '';

      let thumbnail = $('meta[property="og:image"]').attr('content') || '';
      const images: string[] = [];
      $('img[src]').each((_i, el) => {
        let src = $(el).attr('src') || '';
        if (src && !src.startsWith('http')) src = `${BASE}${src}`;
        if (src && !images.includes(src)) images.push(src);
      });
      if (!thumbnail && images.length) thumbnail = images[0];

      let downloadUrl = '';
      $('a').each((_i, el) => {
        const href = $(el).attr('href') || '';
        const text = $(el).text().trim().toLowerCase();
        if ((text.includes('download') || href.includes('/download')) && !downloadUrl) {
          downloadUrl = href.startsWith('http') ? href : `${BASE}${href}`;
        }
      });

      return {
        id: assetId,
        source: 'kenney',
        name: title,
        description,
        author: 'Kenney',
        license: 'CC0',
        thumbnail,
        images,
        formats: ['zip'],
        downloadUrl,
      };
    },

    async getDownloadUrl(assetId: string): Promise<string> {
      const detail = await this.getDetail(assetId);
      return detail.downloadUrl;
    },
  };
}
