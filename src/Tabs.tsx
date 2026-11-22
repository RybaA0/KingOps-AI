import { useState } from "react";
import { Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import ChatScreen from "./screens/ChatScreen";
import ModelsScreen from "./screens/ModelsScreen";
import SettingsScreen from "./screens/SettingsScreen";
import { C } from "./theme";

type Tab = "chat" | "models" | "settings";
const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: "chat", label: "Czat", icon: "💬" },
  { key: "models", label: "Modele", icon: "🧩" },
  { key: "settings", label: "Ustawienia", icon: "⚙️" },
];

export default function Tabs() {
  const [tab, setTab] = useState<Tab>("chat");
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.body}>
        {tab === "chat" && <ChatScreen />}
        {tab === "models" && <ModelsScreen />}
        {tab === "settings" && <SettingsScreen />}
      </View>
      <View style={styles.bar}>
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <Pressable key={t.key} style={styles.item} onPress={() => setTab(t.key)}>
              <Text style={[styles.icon, { opacity: active ? 1 : 0.5 }]}>{t.icon}</Text>
              <Text style={[styles.label, { color: active ? C.violet : C.faint }]}>{t.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  body: { flex: 1 },
  bar: { flexDirection: "row", borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border, backgroundColor: C.panel, paddingBottom: 6, paddingTop: 8 },
  item: { flex: 1, alignItems: "center", justifyContent: "center", gap: 2 },
  icon: { fontSize: 20 },
  label: { fontSize: 11, fontWeight: "600" },
});
