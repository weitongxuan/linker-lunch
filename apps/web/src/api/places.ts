import type { PlaceType } from '@lunch-map/shared';
import { apiDelete, apiGet, apiPost, apiPut, apiUpload } from './client.js';
import type { Message, Photo, RatingsResponse, VotesResponse } from './types.js';

const base = (placeType: PlaceType, placeId: string) => `/api/places/${placeType}/${placeId}`;

export const getRatings = (placeType: PlaceType, placeId: string) =>
  apiGet<RatingsResponse>(`${base(placeType, placeId)}/ratings`);

export const rate = (placeType: PlaceType, placeId: string, person: string, score: number) =>
  apiPost<{ ok: true }>(`${base(placeType, placeId)}/ratings`, { person, score });

export const getMenu = (placeType: PlaceType, placeId: string) =>
  apiGet<{ text: string }>(`${base(placeType, placeId)}/menu`);

export const setMenu = (placeType: PlaceType, placeId: string, text: string) =>
  apiPut<{ ok: true }>(`${base(placeType, placeId)}/menu`, { text });

export const getPhotos = (placeType: PlaceType, placeId: string) =>
  apiGet<Photo[]>(`${base(placeType, placeId)}/photos`);

export const uploadPhoto = (placeType: PlaceType, placeId: string, file: File, who: string, shared: boolean) => {
  const form = new FormData();
  form.append('photo', file);
  form.append('who', who);
  form.append('shared', String(shared));
  return apiUpload<Photo>(`${base(placeType, placeId)}/photos`, form);
};

export const deletePhoto = (photoId: string) => apiDelete<{ ok: true }>(`/api/photos/${photoId}`);

export const getVotes = (placeType: PlaceType, placeId: string) =>
  apiGet<VotesResponse>(`${base(placeType, placeId)}/votes`);

export const setVote = (placeType: PlaceType, placeId: string, person: string, value: number) =>
  apiPost<{ ok: true }>(`${base(placeType, placeId)}/votes`, { person, value });

export const getMessages = (placeType: PlaceType, placeId: string) =>
  apiGet<Message[]>(`${base(placeType, placeId)}/messages`);

export const addMessage = (placeType: PlaceType, placeId: string, person: string, text: string) =>
  apiPost<Message>(`${base(placeType, placeId)}/messages`, { person, text });

// ---- 批次:一次拿某個 placeType 底下所有店家的評分/投票/菜單,
//      用來算 189 家店的可行性與排序,不用一家一家打 API ----
export const getRatingsBulk = (placeType: PlaceType) =>
  apiGet<Record<string, RatingsResponse>>(`/api/ratings?placeType=${placeType}`);

export const getVotesBulk = (placeType: PlaceType) =>
  apiGet<Record<string, VotesResponse>>(`/api/votes?placeType=${placeType}`);

export const getMenusBulk = (placeType: PlaceType) =>
  apiGet<Record<string, string>>(`/api/menus?placeType=${placeType}`);
