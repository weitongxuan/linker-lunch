import type { DayKey } from './types.js';

const JS2KEY: DayKey[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

/** "H:MM" / "HH:MM" -> 從午夜算起的分鐘數 */
export function toMin(s: string): number {
  const p = String(s).split(':').map(Number);
  return p[0] * 60 + (p[1] || 0);
}

/** 分鐘數 -> "HH:MM",先用雙重取模把負值/超過 1440 的值折回 0-1439 範圍 */
export function fmt(m: number): string {
  m = ((Math.round(m) % 1440) + 1440) % 1440;
  return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
}

export function dstr(d: Date): string {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

export function today(now: Date = new Date()): string {
  return dstr(now);
}

export function nowMin(now: Date = new Date()): number {
  return now.getHours() * 60 + now.getMinutes();
}

export function todayKey(now: Date = new Date()): DayKey {
  return JS2KEY[now.getDay()];
}
