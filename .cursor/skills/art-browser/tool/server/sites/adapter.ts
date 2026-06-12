import type { SearchResult, SearchOptions, AssetDetail, SiteInfo } from '../../src/types';

export interface SiteAdapter {
  id: string;
  name: string;
  icon: string;
  search(query: string, options?: SearchOptions): Promise<SearchResult>;
  getDetail(assetId: string): Promise<AssetDetail>;
  getDownloadUrl(assetId: string, format?: string): Promise<string>;
}

export function getSiteInfoList(adapters: Map<string, SiteAdapter>): SiteInfo[] {
  return Array.from(adapters.values()).map((a) => ({
    id: a.id,
    name: a.name,
    icon: a.icon,
  }));
}
