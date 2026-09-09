import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { PlaceType, Shop } from '@lunch-map/shared';
import * as places from '../api/places.js';
import { addShop, importOsmParkings, importOsmShops, refreshMarket } from '../api/staticData.js';
import { toast } from '../lib/toast.js';

/** 星星評分:再點一次同樣的分數會取消評分(跟原本 rate() 的 toggle 行為一樣,由呼叫端判斷)。 */
export function useRateMutation(placeType: PlaceType) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ placeId, person, score }: { placeId: string; person: string; score: number }) =>
      places.rate(placeType, placeId, person, score),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['ratings', placeType] });
      toast(vars.score > 0 ? '評分已存,大家都看得到' : '已取消評分');
    },
    onError: () => toast('評分沒存上,再試一次'),
  });
}

export function useVoteMutation(placeType: PlaceType) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ placeId, person, value }: { placeId: string; person: string; value: number }) =>
      places.setVote(placeType, placeId, person, value),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['votes', placeType] }),
  });
}

export function useSetMenuMutation(placeType: PlaceType) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ placeId, text }: { placeId: string; text: string }) => places.setMenu(placeType, placeId, text),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['menus', placeType] });
      toast('菜單已存,同事都看得到了');
    },
    onError: () => toast('菜單沒存上,再試一次'),
  });
}

export function useAddMessageMutation(placeType: PlaceType) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ placeId, person, text }: { placeId: string; person: string; text: string }) =>
      places.addMessage(placeType, placeId, person, text),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['messages', placeType, vars.placeId] });
      toast('留言已送出,大家都看得到');
    },
    onError: () => toast('留言沒送出,再試一次'),
  });
}

export function useUploadPhotoMutation(placeType: PlaceType, placeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ file, who, shared }: { file: File; who: string; shared: boolean }) =>
      places.uploadPhoto(placeType, placeId, file, who, shared),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['photos', placeType, placeId] });
      toast('照片已上傳');
    },
    onError: () => toast('照片沒傳成功,再試一次'),
  });
}

export function useAddShopMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (shop: Omit<Shop, 'id' | 'needsReview'>) => addShop(shop),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shops'] });
      toast('店家已新增');
    },
    onError: (err) => toast(`新增失敗:${err instanceof Error ? err.message : '未知錯誤'}`),
  });
}

export function useImportOsmShopsMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: importOsmShops,
    onSuccess: (summary) => {
      qc.invalidateQueries({ queryKey: ['shops'] });
      toast(`OSM 匯入完成:新增 ${summary.added} 家(${summary.needsReview} 家時段待確認),略過 ${summary.skippedDuplicate} 家重複`);
    },
    onError: (err) => toast(`OSM 匯入失敗:${err instanceof Error ? err.message : '未知錯誤'}`),
  });
}

export function useImportOsmParkingsMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: importOsmParkings,
    onSuccess: (summary) => {
      qc.invalidateQueries({ queryKey: ['parkings'] });
      toast(`停車場匯入完成:新增 ${summary.added} 個,略過 ${summary.skippedDuplicate} 個重複`);
    },
    onError: (err) => toast(`停車場匯入失敗:${err instanceof Error ? err.message : '未知錯誤'}`),
  });
}

export function useRefreshMarketMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: refreshMarket,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['market'] });
      toast('行情已更新');
    },
    onError: (err) => toast(`行情更新失敗:${err instanceof Error ? err.message : '未知錯誤'}`),
  });
}

export function useDeletePhotoMutation(placeType: PlaceType, placeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (photoId: string) => places.deletePhoto(photoId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['photos', placeType, placeId] }),
  });
}
