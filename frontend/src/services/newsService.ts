import newsData from '../data/movilidad_news.json';
import type { NewsItem } from '../types/news';

interface RawNewsItem {
  headline: string;
  description?: string;
  link?: string;
  publication_date?: string;
  source?: string;
  topics?: string[];
}

export function getNews(): NewsItem[] {
  return newsData
    .map((item: RawNewsItem, index: number): NewsItem => ({
      id: index + 1,
      headline: item.headline,
      summary: item.description,
      link: item.link,
      source: item.source,
      publication_dt: item.publication_date || '',
      topics: item.topics,
      raw_txt: undefined,
      city: undefined,
    }))
    .sort((a, b) =>
      new Date(b.publication_dt).getTime() - new Date(a.publication_dt).getTime()
    );
}
