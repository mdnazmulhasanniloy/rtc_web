const API = () => (process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000").replace(/\/$/, "");
export const assetUrl = (path?: string | null) => path ? (/^(https?:|data:)/.test(path) ? path : `${API()}${path}`) : "";
export const token = () => typeof window === "undefined" ? null : localStorage.getItem("relay_token");
export async function api<T>(path:string, options:RequestInit = {}):Promise<T> {
  const response = await fetch(`${API()}${path}`, { ...options, headers:{ "Content-Type":"application/json", ...(token()?{Authorization:`Bearer ${token()}`}:{}) ,...options.headers } });
  const data = await response.json().catch(()=>({}));
  if (!response.ok) { if(response.status===401 && typeof window!=="undefined") { localStorage.removeItem("relay_token"); localStorage.removeItem("relay_user"); } throw new Error(data.error || "Request failed"); }
  return data;
}
