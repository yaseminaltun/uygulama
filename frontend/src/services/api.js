const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000/api";

console.log("API_BASE_URL:", API_BASE_URL);

export async function fetchJson(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Request failed with ${response.status}`);
  }

  return response.json();
}

export const api = {
  today: () => fetchJson(`${API_BASE_URL}/home/today`),
  upcoming: () => fetchJson(`${API_BASE_URL}/home/upcoming`),
  tennis: () => fetchJson(`${API_BASE_URL}/tennis`),
  f1: () => fetchJson(`${API_BASE_URL}/f1`),
  calendar: () => fetchJson(`${API_BASE_URL}/calendar`)
};
