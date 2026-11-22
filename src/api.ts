import * as SecureStore from "expo-secure-store";

export const BASE = "https://ai.kingops.eu";
const TOKEN_KEY = "kingai_token";
let token: string | null = null;

export async function loadToken(): Promise<string | null> {
  try { token = await SecureStore.getItemAsync(TOKEN_KEY); } catch { token = null; }
  return token;
}
export async function setToken(t: string | null): Promise<void> {
  token = t;
  try { if (t) await SecureStore.setItemAsync(TOKEN_KEY, t); else await SecureStore.deleteItemAsync(TOKEN_KEY); } catch { /* keychain unavailable */ }
}
export function getToken(): string | null { return token; }

function authHeaders(json = true): Record<string, string> {
  const h: Record<string, string> = { "User-Agent": "KingAi-iOS" };
  if (json) h["Content-Type"] = "application/json";
  if (token) h["Authorization"] = `Bearer ${token}`;
  return h;
}

async function jsonOrNull(r: Response): Promise<any> { try { return await r.json(); } catch { return null; } }

// ---------- types ----------
export type User = { name: string | null; email: string; role: string };
export type Me = {
  name: string | null; email: string; role: string;
  tokensUsed: number; tokenLimit: number;
  wallet?: { credit: number; spent: number; remaining: number };
  allowedModels?: string[];
};
export type Model = { id: string; label: string; provider: "cloud" | "local"; vision: boolean; tools: boolean; reasoning: boolean; adminOnly?: boolean };
export type Conversation = { id: string; title: string; updatedAt: string };
export type Message = { id?: string; role: "user" | "assistant"; content: string; model?: string | null; thinkMs?: number | null; images?: string[] };

// ---------- auth ----------
export async function login(email: string, password: string): Promise<{ ok: true; user: User } | { ok: false; code?: string; message: string }> {
  const r = await fetch(`${BASE}/api/desktop/login`, { method: "POST", headers: authHeaders(), body: JSON.stringify({ email: email.trim(), password, device: "iPhone" }) });
  const j = await jsonOrNull(r);
  if (r.ok && j?.token) { await setToken(j.token); return { ok: true, user: j.user }; }
  return { ok: false, code: j?.error?.code, message: j?.error?.message ?? "Nie udało się zalogować." };
}
export async function register(data: { name: string; email: string; password: string; confirm: string }): Promise<{ ok: boolean; message?: string }> {
  const r = await fetch(`${BASE}/api/register`, { method: "POST", headers: authHeaders(), body: JSON.stringify(data) });
  const j = await jsonOrNull(r);
  return r.ok ? { ok: true } : { ok: false, message: j?.message ?? j?.error?.message ?? "Nie udało się założyć konta." };
}
export async function logout(): Promise<void> {
  try { await fetch(`${BASE}/api/desktop/logout`, { method: "POST", headers: authHeaders(false) }); } catch { /* offline */ }
  await setToken(null);
}
export async function getMe(): Promise<Me | null> {
  const r = await fetch(`${BASE}/api/desktop/me`, { headers: authHeaders(false) });
  if (!r.ok) return null;
  return (await jsonOrNull(r)) as Me;
}
export async function registerPushToken(token: string, platform: string): Promise<void> {
  try { await fetch(`${BASE}/api/desktop/push-token`, { method: "POST", headers: authHeaders(), body: JSON.stringify({ token, platform }) }); } catch { /* offline */ }
}

export async function getModels(): Promise<Model[]> {
  const r = await fetch(`${BASE}/api/v1/models`, { headers: authHeaders(false) });
  const j = await jsonOrNull(r);
  return (j?.data ?? []).map((m: Model) => ({ id: m.id, label: m.label, provider: m.provider, vision: m.vision, tools: m.tools, reasoning: m.reasoning, adminOnly: m.adminOnly }));
}

// ---------- conversations ----------
export async function getConversations(): Promise<Conversation[]> {
  const r = await fetch(`${BASE}/api/chat/conversations`, { headers: authHeaders(false) });
  const j = await jsonOrNull(r);
  return j?.conversations ?? [];
}
export async function getConversation(id: string): Promise<{ title: string; model?: string; messages: Message[] }> {
  const r = await fetch(`${BASE}/api/chat/conversations/${id}`, { headers: authHeaders(false) });
  const j = await jsonOrNull(r);
  return { title: j?.conversation?.title ?? "", model: j?.conversation?.model, messages: (j?.messages ?? []) as Message[] };
}
export async function deleteConversation(id: string): Promise<void> {
  try { await fetch(`${BASE}/api/chat/conversations/${id}`, { method: "DELETE", headers: authHeaders(false) }); } catch { /* ignore */ }
}

// ---------- speech-to-text (records on-device, transcribed by the self-hosted Whisper via the API) ----------
export async function transcribe(audio: string, mime: string, lang = "pl"): Promise<string> {
  const r = await fetch(`${BASE}/api/v1/transcribe`, { method: "POST", headers: authHeaders(), body: JSON.stringify({ audio, mime, lang }) });
  const j = await jsonOrNull(r);
  return r.ok && typeof j?.text === "string" ? j.text : "";
}

// ---------- streaming chat (NDJSON over XHR — React Native's fetch has no stream reader) ----------
export type ChatEvent =
  | { type: "meta"; conversationId: string; title: string; model: string; auto?: boolean; reason?: string }
  | { type: "reasoning"; text: string }
  | { type: "delta"; text: string }
  | { type: "done"; messageId?: string; model?: string; thinkMs?: number }
  | { type: "error"; message: string; dropped?: boolean }
  | { type: string; [k: string]: unknown };

export function streamChat(
  body: { conversationId?: string; message: string; model: string; images?: string[] },
  on: (ev: ChatEvent) => void,
): { abort: () => void } {
  const xhr = new XMLHttpRequest();
  xhr.open("POST", `${BASE}/api/chat`);
  for (const [k, v] of Object.entries(authHeaders())) xhr.setRequestHeader(k, v);
  let seen = 0; // bytes of responseText already parsed
  const flush = (final: boolean) => {
    const text = xhr.responseText;
    let chunk = text.slice(seen);
    const lastNl = chunk.lastIndexOf("\n");
    if (lastNl === -1 && !final) return;
    const take = final ? chunk : chunk.slice(0, lastNl + 1);
    seen += take.length;
    for (const line of take.split("\n")) {
      const s = line.trim();
      if (!s) continue;
      try { on(JSON.parse(s)); } catch { /* partial / non-json */ }
    }
  };
  xhr.onprogress = () => flush(false);
  xhr.onload = () => { flush(true); };
  xhr.onerror = () => on({ type: "error", message: "Błąd połączenia." });
  xhr.send(JSON.stringify(body));
  return { abort: () => { try { xhr.abort(); } catch { /* noop */ } } };
}
