import type { SearchResult } from './types';

export async function searchWeb(
  query: string,
  apiKey: string,
  cx: string
): Promise<SearchResult[]> {
  const url = `https://www.googleapis.com/customsearch/v1?key=${encodeURIComponent(apiKey)}&cx=${encodeURIComponent(cx)}&q=${encodeURIComponent(query)}&num=5&lr=lang_tr`;

  const response = await fetch(url);
  if (!response.ok) {
    console.error(`Search API error: ${response.status} ${response.statusText}`);
    return [];
  }

  const data = await response.json();
  return (
    data.items?.map((item: any) => ({
      title: item.title || '',
      snippet: item.snippet || '',
      link: item.link || '',
    })) || []
  );
}

export function buildSearchQueries(
  businessName: string,
  sector: string
): string[] {
  const sectorLabels: Record<string, string> = {
    fmcg: 'FMCG gida',
    gastronomi: 'restoran gastronomi',
    retail: 'perakende magaza',
    corporate: 'kurumsal hizmet',
    tech: 'teknoloji yazilim',
    health: 'saglik klinik',
    education: 'egitim kurumu',
  };

  const sectorLabel = sectorLabels[sector] || sector;

  return [
    `"${businessName}" ${sectorLabel} Turkiye`,
    `${sectorLabel} sektoru rekabet analizi Turkiye 2025`,
    `${sectorLabel} pazar trendleri dijital pazarlama Turkiye`,
    `${sectorLabel} lider markalar Turkiye`,
  ];
}
