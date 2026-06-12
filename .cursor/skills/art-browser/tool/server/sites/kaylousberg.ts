import * as cheerio from 'cheerio';
import type { SiteAdapter } from './adapter';
import type { SearchResult, SearchOptions, AssetDetail, SearchResultItem } from '../../src/types';

const BASE = 'https://www.kaylousberg.com';
const ITCH_BASE = 'https://kaylousberg.itch.io';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

async function fetchPage(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, 'Accept': 'text/html' },
  });
  if (!res.ok) throw new Error(`KayLousberg: HTTP ${res.status}`);
  return res.text();
}

interface PackEntry extends SearchResultItem {
  tags: string;
}

let cachedPacks: PackEntry[] | null = null;

async function getAllPacks(): Promise<PackEntry[]> {
  if (cachedPacks) return cachedPacks;

  const html = await fetchPage(`${BASE}/game-assets/`);
  const $ = cheerio.load(html);
  const items: PackEntry[] = [];

  $('a[href*="/game-assets/"]').each((_i, el) => {
    const $link = $(el);
    const href = $link.attr('href') || '';
    const match = href.match(/\/game-assets\/([^/?#]+)$/);
    if (!match) return;

    const id = match[1];
    if (id === 'complete-kaykit-collection') return;
    if (items.some((it) => it.id === id)) return;

    const name = $link.text().trim() || id;

    let thumbnail = '';
    const $img = $link.find('img').first();
    if ($img.length) {
      let src = $img.attr('data-src') || $img.attr('src') || '';
      if (src && !src.startsWith('http')) src = `${BASE}${src}`;
      thumbnail = src;
    }

    const tags = [name.toLowerCase(), id.toLowerCase().replace(/-/g, ' ')].join(' ');

    items.push({
      id,
      name,
      source: 'kaylousberg',
      thumbnail,
      author: 'Kay Lousberg',
      license: 'CC0',
      formats: ['fbx', 'gltf'],
      tags,
    });
  });

  cachedPacks = items;
  return items;
}

const SLUG_MAP: Record<string, string> = {
  'rpg-tools': 'rpg-tools-bits',
  'holiday-bits': 'holiday-bits',
  'character-animations': 'kaykit-character-animations',
  'forest-nature-pack': 'kaykit-forest',
  'platformer': 'kaykit-platformer',
  'resource-bits': 'resource-bits',
  'block-bits': 'block-bits',
  'medieval-hexagon': 'kaykit-medieval-hexagon',
  'characters-skeletons': 'kaykit-skeletons',
  'characters-adventurers': 'kaykit-adventurers',
  'dungeon-remastered': 'kaykit-dungeon-remastered',
  'halloween-bits': 'halloween-bits',
  'restaurant-bits': 'restaurant-bits',
  'prototype-bits': 'prototype-bits',
  'furniture-bits': 'furniture-bits',
  'space-base-bits': 'space-base-bits',
  'city-builder-bits': 'city-builder-bits',
  'fantasy-weapons-bits': 'fantasy-weapons-bits',
};

function getItchSlug(assetId: string): string {
  return SLUG_MAP[assetId] || assetId;
}

/**
 * Resolve an itch.io game page URL into a direct file download URL.
 *
 * Flow:
 * 1. GET game page → extract csrf_token
 * 2. POST /<slug>/download_url → get download page URL
 * 3. GET download page → find upload_id for the free file
 * 4. POST /<slug>/file/<upload_id> → get direct download URL
 */
async function resolveItchDownloadUrl(itchPageUrl: string): Promise<string> {
  const pageRes = await fetch(itchPageUrl, {
    headers: { 'User-Agent': UA, 'Accept': 'text/html' },
    redirect: 'follow',
  });
  if (!pageRes.ok) throw new Error(`itch.io page: HTTP ${pageRes.status}`);

  const cookies = pageRes.headers.getSetCookie?.() || [];
  const cookieStr = cookies.map((c) => c.split(';')[0]).join('; ');

  const pageHtml = await pageRes.text();
  const $page = cheerio.load(pageHtml);

  let csrfToken = $page('meta[name="csrf_token"]').attr('content') || '';
  if (!csrfToken) {
    const csrfMatch = pageHtml.match(/csrf_token\s*[=:]\s*["']([^"']+)["']/);
    if (csrfMatch) csrfToken = csrfMatch[1];
  }
  if (!csrfToken) {
    const windowMatch = pageHtml.match(/window\.itchio_token\s*=\s*["']([^"']+)["']/);
    if (windowMatch) csrfToken = windowMatch[1];
  }

  if (!csrfToken) {
    throw new Error('无法获取 itch.io CSRF token，该资源可能需要手动下载');
  }

  const slug = new URL(itchPageUrl).pathname.replace(/^\//, '');
  const downloadUrlRes = await fetch(`${ITCH_BASE}/${slug}/download_url`, {
    method: 'POST',
    headers: {
      'User-Agent': UA,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cookie': cookieStr,
      'Referer': itchPageUrl,
    },
    body: `csrf_token=${encodeURIComponent(csrfToken)}`,
    redirect: 'follow',
  });

  if (!downloadUrlRes.ok) {
    throw new Error(`itch.io download_url: HTTP ${downloadUrlRes.status}`);
  }

  const downloadUrlJson = await downloadUrlRes.json() as { url?: string };
  if (!downloadUrlJson.url) {
    throw new Error('itch.io 未返回下载页面链接');
  }

  const dlPageRes = await fetch(downloadUrlJson.url, {
    headers: { 'User-Agent': UA, 'Accept': 'text/html', 'Cookie': cookieStr },
    redirect: 'follow',
  });
  if (!dlPageRes.ok) throw new Error(`itch.io download page: HTTP ${dlPageRes.status}`);

  const dlCookies = dlPageRes.headers.getSetCookie?.() || [];
  const allCookies = [...cookies, ...dlCookies].map((c) => c.split(';')[0]).join('; ');

  const dlHtml = await dlPageRes.text();
  const $dl = cheerio.load(dlHtml);

  let freeUploadId = '';
  $dl('.upload').each((_i, el) => {
    if (freeUploadId) return;
    const $upload = $dl(el);
    const text = $upload.text().toLowerCase();
    if (text.includes('extra') || text.includes('source')) return;
    const uploadId = $upload.find('.download_btn, [data-upload_id]').attr('data-upload_id')
                  || $upload.attr('data-upload_id') || '';
    if (uploadId) freeUploadId = uploadId;
  });

  if (!freeUploadId) {
    const idMatch = dlHtml.match(/data-upload_id=["'](\d+)["']/);
    if (idMatch) freeUploadId = idMatch[1];
  }

  if (!freeUploadId) {
    throw new Error('无法在 itch.io 下载页找到免费文件，请手动下载');
  }

  let dlCsrf = $dl('meta[name="csrf_token"]').attr('content') || '';
  if (!dlCsrf) {
    const m = dlHtml.match(/csrf_token\s*[=:]\s*["']([^"']+)["']/);
    if (m) dlCsrf = m[1];
  }
  if (!dlCsrf) dlCsrf = csrfToken;

  const fileRes = await fetch(`${ITCH_BASE}/${slug}/file/${freeUploadId}`, {
    method: 'POST',
    headers: {
      'User-Agent': UA,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cookie': allCookies,
      'Referer': downloadUrlJson.url,
    },
    body: `csrf_token=${encodeURIComponent(dlCsrf)}`,
    redirect: 'follow',
  });

  if (!fileRes.ok) {
    throw new Error(`itch.io file download: HTTP ${fileRes.status}`);
  }

  const fileJson = await fileRes.json() as { url?: string };
  if (!fileJson.url) {
    throw new Error('itch.io 未返回文件下载链接');
  }

  return fileJson.url;
}

export function createKayLousbergAdapter(): SiteAdapter {
  return {
    id: 'kaylousberg',
    name: 'Kay Lousberg',
    icon: '🧱',

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
      const html = await fetchPage(`${BASE}/game-assets/${assetId}`);
      const $ = cheerio.load(html);

      const title = $('h1').first().text().trim() || assetId;
      const description = $('meta[property="og:description"]').attr('content') || '';

      let thumbnail = $('meta[property="og:image"]').attr('content') || '';
      const images: string[] = [];
      $('img[src]').each((_i, el) => {
        let src = $(el).attr('src') || '';
        if (src && !src.startsWith('http')) src = `${BASE}${src}`;
        if (src && !images.includes(src)) images.push(src);
      });
      if (!thumbnail && images.length) thumbnail = images[0];

      let itchUrl = '';
      $('a[href*="itch.io"]').each((_i, el) => {
        if (itchUrl) return;
        itchUrl = $(el).attr('href') || '';
      });
      if (!itchUrl) {
        const itchSlug = getItchSlug(assetId);
        itchUrl = `${ITCH_BASE}/${itchSlug}`;
      }

      return {
        id: assetId,
        source: 'kaylousberg',
        name: title,
        description,
        author: 'Kay Lousberg',
        license: 'CC0',
        thumbnail,
        images,
        formats: ['fbx', 'gltf'],
        downloadUrl: itchUrl,
      };
    },

    async getDownloadUrl(assetId: string): Promise<string> {
      const detail = await this.getDetail(assetId);
      const itchUrl = detail.downloadUrl;

      try {
        return await resolveItchDownloadUrl(itchUrl);
      } catch (err: any) {
        console.warn(`[KayLousberg] itch.io 自动下载失败: ${err.message}`);
        throw new Error(
          `itch.io 自动下载失败: ${err.message}\n` +
          `请手动访问 ${itchUrl} 下载资源`,
        );
      }
    },
  };
}
