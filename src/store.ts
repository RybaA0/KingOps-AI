import { useSyncExternalStore } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Local (non-secret) app preferences. SSH servers live on the backend (encrypted); only
// notifications/voice/projects grouping is kept on the device here.
export type Project = { id: string; name: string; icon: string; convIds: string[] };
export type AppPrefs = {
  notifications: boolean;
  voiceAutoSend: boolean;
  enterToSend: boolean;
  projects: Project[];
};

const KEY = "kingai_prefs";
const DEFAULT: AppPrefs = { notifications: true, voiceAutoSend: true, enterToSend: false, projects: [] };

let state: AppPrefs = { ...DEFAULT };
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());

export async function initPrefs(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) state = { ...DEFAULT, ...JSON.parse(raw) };
  } catch { /* defaults */ }
  emit();
}

export function setPrefs(patch: Partial<AppPrefs>): void {
  state = { ...state, ...patch };
  AsyncStorage.setItem(KEY, JSON.stringify(state)).catch(() => {});
  emit();
}

export function getPrefs(): AppPrefs { return state; }

const subscribe = (cb: () => void) => { subs.add(cb); return () => { subs.delete(cb); }; };
export function usePrefs(): AppPrefs { return useSyncExternalStore(subscribe, () => state, () => state); }

// --- project helpers ---
export function addProject(name: string, icon = "folder"): Project {
  const p: Project = { id: `p_${Date.now()}`, name: name.trim() || "Projekt", icon, convIds: [] };
  setPrefs({ projects: [p, ...state.projects] });
  return p;
}
export function renameProject(id: string, name: string): void {
  setPrefs({ projects: state.projects.map((p) => (p.id === id ? { ...p, name } : p)) });
}
export function deleteProject(id: string): void {
  setPrefs({ projects: state.projects.filter((p) => p.id !== id) });
}
export function toggleConvInProject(id: string, convId: string): void {
  setPrefs({
    projects: state.projects.map((p) =>
      p.id === id ? { ...p, convIds: p.convIds.includes(convId) ? p.convIds.filter((c) => c !== convId) : [...p.convIds, convId] } : p,
    ),
  });
}
