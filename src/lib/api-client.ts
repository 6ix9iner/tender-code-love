import { supabase } from "@/integrations/supabase/client";

const BASE_URL = import.meta.env.VITE_RAILWAY_API_BASE_URL ?? "";

export class ApiClientError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export function isApiConfigured() {
  return Boolean(BASE_URL);
}

async function authHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!BASE_URL) {
    throw new ApiClientError(
      "AI API not configured. Deploy the php-api/ folder to Railway and set VITE_RAILWAY_API_BASE_URL.",
      0,
    );
  }
  const headers = {
    "Content-Type": "application/json",
    ...(await authHeader()),
    ...(init.headers as Record<string, string> | undefined),
  };
  const res = await fetch(`${BASE_URL}${path}`, { ...init, headers });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new ApiClientError(text || `Request failed (${res.status})`, res.status);
  }
  return (await res.json()) as T;
}

export const api = {
  summarize: (noteId: string) =>
    request<{ summary: string }>("/summarize", {
      method: "POST",
      body: JSON.stringify({ note_id: noteId }),
    }),
  generateInsights: () =>
    request<{ ok: true }>("/insights/generate", { method: "POST" }),
  graph: () =>
    request<{
      nodes: { id: string; title: string; tags: string[] }[];
      edges: { source: string; target: string; kind: "link" | "tag" }[];
    }>("/graph"),
  search: (q: string) =>
    request<{ results: { id: string; title: string; snippet: string }[] }>(
      `/search?q=${encodeURIComponent(q)}`,
    ),
  suggestLinks: (noteId: string) =>
    request<{ suggestions: { id: string; title: string; reason: string }[] }>(
      "/suggest-links",
      { method: "POST", body: JSON.stringify({ note_id: noteId }) },
    ),
};