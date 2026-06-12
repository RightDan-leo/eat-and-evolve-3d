import * as cheerio from 'cheerio';
import type { SiteAdapter } from './adapter';
import type { SearchResult, SearchOptions, AssetDetail, SearchResultItem } from '../../src/types';

const BASE = 'https://opengameart.org';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

async function fetchPage(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, 'Accept': 'text/html' },
  });
  if (!res.ok) throw new Error(`OpenGameArt: HTTP ${res.status}`);
  return res.text();
}

export function createOpenGameArtAdapter(): SiteAdapter {
  return {
    id: 'opengameart',
    name: 'OpenGameArt',
    icon: '🎨',

    async search(query: string, options?: SearchOptions): Promise<SearchResult> {
      const page = options?.page ?? 1;
      const offset = (page - 1) * 24;
      const url = `${BASE}/art-search-advanced?keys=${encodeURIComponent(query)}&page=${offset > 0 ? Math.floor(offset / 24) : 0}`;
      const html = await fetchPage(url);
      const $ = cheerio.load(html);
      const items: SearchResultItem[] = [];

      $('.view-content .views-row, .view-content .node, .search-result').each((_i, el) => {
        const $el = $(el);
        const $link = $el.find('a[href*="/content/"]').first();
        if (!$link.length) return;

        const href = $link.attr('href') || '';
        const idMatch = href.match(/\/content\/([^/?#]+)/);
        if (!idMatch) return;

        const id = idMatch[1];
        const name = $link.text().trim();
        if (!name || items.some((it) => it.id === id)) return;

        let thumbnail = '';
        const $img = $el.find('img').first();
        if ($img.length) {
          thumbnail = $img.attr('src') || '';
          if (thumbnail && !thumbnail.startsWith('http')) {
            thumbnail = `${BASE}${thumbnail}`;
          }
        }

        const licenseText = $el.find('.field-name-field-art-licenses, .license').text().trim();
        const license = normalizeLicense(licenseText);

        items.push({
          id,
          name,
          source: 'opengameart',
          thumbnail,
          author: extractAuthor($el, $),
          license,
          formats: [],
        });
      });

      const hasMore = $('li.pager-next, a[rel="next"]').length > 0;

      return {
        query,
        items,
        total: items.length + (hasMore ? 24 : 0),
        page,
        hasMore,
      };
    },

    async getDetail(assetId: string): Promise<AssetDetail> {
      const html = await fetchPage(`${BASE}/content/${assetId}`);
      const $ = cheerio.load(html);

      const title = $('h1').first().text().trim() || assetId;
      const description = $('meta[property="og:description"]').attr('content') ||
                          $('.field-name-body .field-item').first().text().trim().slice(0, 500) || '';
      const thumbnail = $('meta[property="og:image"]').attr('content') || '';

      const images: string[] = [];
      $('img[src*="/sites/default/files/"]').each((_i, el) => {
        let src = $(el).attr('src') || '';
        if (src && !src.startsWith('http')) src = `${BASE}${src}`;
        if (src && !images.includes(src)) images.push(src);
      });

      const SKIP_EXTS = new Set(['css', 'js', 'html', 'htm', 'php']);
      const ARCHIVE_EXTS = new Set(['zip', '7z', 'tar', 'gz', 'rar']);
      const formats: string[] = [];
      const downloadLinks: string[] = [];
      $('a[href*="/sites/default/files/"], .field-name-field-art-files a').each((_i, el) => {
        const href = $(el).attr('href') || '';
        if (!href) return;
        const ext = href.split('.').pop()?.split('?')[0]?.toLowerCase() || '';
        if (SKIP_EXTS.has(ext)) return;
        const fullUrl = href.startsWith('http') ? href : `${BASE}${href}`;
        if (!downloadLinks.includes(fullUrl)) {
          downloadLinks.push(fullUrl);
          if (ext && !formats.includes(ext)) formats.push(ext);
        }
      });

      const bestLink = downloadLinks.find((u) => {
        const ext = u.split('.').pop()?.split('?')[0]?.toLowerCase() || '';
        return ARCHIVE_EXTS.has(ext);
      }) || downloadLinks.find((u) => {
        const ext = u.split('.').pop()?.split('?')[0]?.toLowerCase() || '';
        return !['gif', 'jpg', 'jpeg', 'png', 'svg', 'webp'].includes(ext);
      }) || downloadLinks[0] || '';

      const licenseText = $('.field-name-field-art-licenses').text().trim();
      const author = $('a[href*="/users/"]').first().text().trim() || 'Unknown';

      return {
        id: assetId,
        source: 'opengameart',
        name: title,
        description,
        author,
        license: normalizeLicense(licenseText),
        thumbnail: thumbnail || (images[0] ?? ''),
        images,
        formats,
        downloadUrl: bestLink || `${BASE}/content/${assetId}`,
      };
    },

    async getDownloadUrl(assetId: string): Promise<string> {
      const detail = await this.getDetail(assetId);
      return detail.downloadUrl;
    },
  };
}

function extractAuthor($el: cheerio.Cheerio<any>, $: cheerio.CheerioAPI): string {
  const $author = $el.find('a[href*="/users/"]').first();
  return $author.text().trim() || 'Unknown';
}

function normalizeLicense(text: string): string {
  const lower = text.toLowerCase();
  if (lower.includes('cc0') || lower.includes('public domain')) return 'CC0';
  if (lower.includes('cc-by-sa') || lower.includes('cc by-sa')) return 'CC-BY-SA';
  if (lower.includes('cc-by') || lower.includes('cc by')) return 'CC-BY';
  if (lower.includes('gpl')) return 'GPL';
  if (lower.includes('ofl')) return 'OFL';
  return text || 'Unknown';
}
