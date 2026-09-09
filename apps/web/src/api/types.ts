export interface OsmImportSummary {
  found: number;
  added: number;
  skippedDuplicate: number;
  skippedFar: number;
  needsReview: number;
}

export interface RatingsResponse {
  avg: number;
  n: number;
  who: Record<string, number>;
}

export interface VotesResponse {
  total: number;
  byPerson: Record<string, number>;
}

export interface Photo {
  id: string;
  url: string;
  who: string;
  date: string;
  kb: number;
  shared: boolean;
}

export interface Message {
  id: number;
  who: string;
  text: string;
  date: string;
}
