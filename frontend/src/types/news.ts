export interface NewsItem {
  id: number;
  headline: string;
  summary?: string;
  link?: string;
  source?: string;
  publication_dt: string; // ISO date YYYY-MM-DD
  topics?: string[];
  raw_txt?: string;
  city?: string;
}
