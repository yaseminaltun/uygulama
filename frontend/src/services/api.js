const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';

export async function fetchJson(path) {
  const response = await fetch(`${API_BASE_URL}${path}`);

  if (!response.ok) {
    throw new Error(`Request failed with ${response.status}`);
  }

  return response.json();
}

export const api = {
  today: () => fetchJson('/home/today'),
  upcoming: () => fetchJson('/home/upcoming'),
  tennis: () => fetchJson('/tennis'),
  f1: () => fetchJson('/f1'),
  calendar: () => fetchJson('/calendar')
};
