// Wrapper de fetch que auto-incluye el header Authorization desde localStorage.
// Úsalo en TODOS los endpoints protegidos para no repetir código.
//
// Uso:
//   const res = await fetchAuth(`${API_BASE_URL}/api/...`);
//   const res = await fetchAuth(url, { method: "POST", body: JSON.stringify(...) });
//
// Nota: Content-Type se setea automáticamente a application/json si se envía body.

export async function fetchAuth(
  url: string,
  init: RequestInit = {}
): Promise<Response> {
  const token = localStorage.getItem("app_token");
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return fetch(url, { ...init, headers });
}
