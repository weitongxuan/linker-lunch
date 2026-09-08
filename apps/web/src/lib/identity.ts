const KEY = 'lunchmap.me';

export function getMe(): string {
  try {
    return localStorage.getItem(KEY) || '';
  } catch {
    return '';
  }
}

export function setMe(name: string) {
  try {
    localStorage.setItem(KEY, name);
  } catch {
    // localStorage unavailable (private mode etc.) — name just won't persist across reloads
  }
}
