import { createContext, useContext, useMemo, useState } from "react";
import { Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import ChatScreen from "./screens/ChatScreen";
import ModelsScreen from "./screens/ModelsScreen";
import SettingsScreen from "./screens/SettingsScreen";
import { type Colors, useTheme } from "./theme";

export type Tab = "chat" | "models" | "settings";
const NavCtx = createContext<{ tab: Tab; setTab: (t: Tab) => void }>({ tab: "chat", setTab: () => {} });
export const useNav = () => useContext(NavCtx);

const TABS: { key: Tab; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: "chat", label: "Czat", icon: "chatbubble-ellipses-outline" },
  { key: "models", label: "Modele", icon: "apps-outline" },
  { key: "settings", label: "Konto", icon: "person-circle-outline" },
];

export default function Tabs() {
  const { c } = useTheme();
  const s = useMemo(() => makeStyles(c), [c]);
  const [tab, setTab] = useState<Tab>("chat");
  return (
    <NavCtx.Provider value={{ tab, setTab }}>
      <SafeAreaView style={s.safe}>
        <View style={s.body}>
          {tab === "chat" && <ChatScreen />}
          {tab === "models" && <ModelsScreen />}
          {tab === "settings" && <SettingsScreen />}
        </View>
        <View style={s.bar}>
          {TABS.map((t) => {
            const active = tab === t.key;
            return (
              <Pressable key={t.key} style={s.item} onPress={() => setTab(t.key)}>
                <Ionicons name={t.icon} size={23} color={active ? c.accent : c.faint} />
                <Text style={[s.label, { color: active ? c.accent : c.faint }]}>{t.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </SafeAreaView>
    </NavCtx.Provider>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg },
    body: { flex: 1 },
    bar: { flexDirection: "row", borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border, backgroundColor: c.panel, paddingBottom: 6, paddingTop: 8 },
    item: { flex: 1, alignItems: "center", justifyContent: "center", gap: 3 },
    label: { fontSize: 11, fontWeight: "600" },
  });
