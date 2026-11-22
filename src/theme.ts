import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type Appearance = "dark" | "light" | "system";
export type AccentKey = "violet" | "blue" | "green" | "orange" | "pink" | "red";

export const ACCENTS: Record<AccentKey, { label: string; color: string }> = {
  violet: { label: "Fioletowy", color: "#8b5cf6" },
  blue: { label: "Niebieski", color: "#3b82f6" },
  green: { label: "Zielony", color: "#22c55e" },
  orange: { label: "Pomarańczowy", color: "#f97316" },
  pink: { label: "Różowy", color: "#ec4899" },
  red: { label: "Czerwony", color: "#ef4444" },
};

function hexToSoft(hex: string, a = 0.15): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

export function makeColors(dark: boolean, accent: AccentKey) {
  const ac = ACCENTS[accent]?.color ?? ACCENTS.violet.color;
  const base = dark
    ? {
        scheme: "dark" as const,
        bg: "#0b0b0f",
        panel: "#15151c",
        card: "#1b1b24",
        cardAlt: "#23232e",
        border: "#2a2a35",
        text: "#f4f4f6",
        sub: "#a1a1ad",
        faint: "#6b6b78",
        sky: "#38bdf8",
        emerald: "#34d399",
        red: "#f87171",
        amber: "#fbbf24",
        overlay: "rgba(0,0,0,0.6)",
      }
    : {
        scheme: "light" as const,
        bg: "#f6f6f8",
        panel: "#ffffff",
        card: "#ffffff",
        cardAlt: "#eef0f3",
        border: "#e2e2e8",
        text: "#17171c",
        sub: "#5b5b66",
        faint: "#9a9aa6",
        sky: "#0284c7",
        emerald: "#059669",
        red: "#dc2626",
        amber: "#d97706",
        overlay: "rgba(0,0,0,0.35)",
      };
  return { ...base, accent: ac, accentSoft: hexToSoft(ac, dark ? 0.18 : 0.12) };
}

export type Colors = ReturnType<typeof makeColors>;

type ThemeState = {
  c: Colors;
  dark: boolean;
  appearance: Appearance;
  accent: AccentKey;
  setAppearance: (a: Appearance) => void;
  setAccent: (a: AccentKey) => void;
};

const PREF_KEY = "kingai_theme";
const Ctx = createContext<ThemeState | null>(null);

export function useTheme(): ThemeState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useTheme must be used within ThemeProvider");
  return v;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const [appearance, setAppearanceState] = useState<Appearance>("system");
  const [accent, setAccentState] = useState<AccentKey>("violet");

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(PREF_KEY);
        if (raw) {
          const p = JSON.parse(raw) as { appearance?: Appearance; accent?: AccentKey };
          if (p.appearance === "dark" || p.appearance === "light" || p.appearance === "system") setAppearanceState(p.appearance);
          if (p.accent && ACCENTS[p.accent]) setAccentState(p.accent);
        }
      } catch { /* defaults */ }
    })();
  }, []);

  const persist = (appearanceVal: Appearance, accentVal: AccentKey) => {
    AsyncStorage.setItem(PREF_KEY, JSON.stringify({ appearance: appearanceVal, accent: accentVal })).catch(() => {});
  };
  const setAppearance = (a: Appearance) => { setAppearanceState(a); persist(a, accent); };
  const setAccent = (a: AccentKey) => { setAccentState(a); persist(appearance, a); };

  const dark = appearance === "system" ? system !== "light" : appearance === "dark";
  const c = useMemo(() => makeColors(dark, accent), [dark, accent]);
  const value = useMemo<ThemeState>(() => ({ c, dark, appearance, accent, setAppearance, setAccent }), [c, dark, appearance, accent]); // eslint-disable-line react-hooks/exhaustive-deps

  return React.createElement(Ctx.Provider, { value }, children);
}
