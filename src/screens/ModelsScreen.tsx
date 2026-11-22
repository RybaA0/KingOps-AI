import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { getModels, type Model } from "../api";
import { type Colors, useTheme } from "../theme";

export default function ModelsScreen() {
  const { c } = useTheme();
  const s = useMemo(() => makeStyles(c), [c]);
  const [models, setModels] = useState<Model[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const load = () => getModels().then(setModels).catch(() => setModels([]));
  useEffect(() => { load(); }, []);
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const Badge = ({ text, color }: { text: string; color: string }) => (
    <View style={[s.badge, { borderColor: color }]}><Text style={[s.badgeTxt, { color }]}>{text}</Text></View>
  );

  if (!models) return <View style={s.center}><ActivityIndicator color={c.accent} size="large" /></View>;

  return (
    <FlatList
      style={{ flex: 1 }}
      contentContainerStyle={{ padding: 14, gap: 10 }}
      data={models}
      keyExtractor={(m) => m.id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.accent} />}
      ListHeaderComponent={
        <View style={{ marginBottom: 6 }}>
          <Text style={s.h1}>Dostępne modele</Text>
          <Text style={s.sub}>Modele „widzące" (obrazy) obsługują też głos — dyktowanie i czytanie odpowiedzi.</Text>
        </View>
      }
      ListEmptyComponent={<Text style={s.sub}>Brak modeli do wyświetlenia.</Text>}
      renderItem={({ item }) => (
        <View style={s.card}>
          <View style={s.cardTop}>
            <Text style={s.name}>{item.label}</Text>
            <Ionicons name="ellipse" size={10} color={item.provider === "local" ? c.emerald : c.sky} />
          </View>
          <Text style={s.provider}>{item.provider === "local" ? "Serwer KingOps" : "Chmura"}{item.adminOnly ? " · tylko admin" : ""}</Text>
          <View style={s.badges}>
            {item.vision && <Badge text="obrazy / głos" color={c.sky} />}
            {item.tools && <Badge text="narzędzia" color={c.accent} />}
            {item.reasoning && <Badge text="myśli na głos" color={c.amber} />}
          </View>
        </View>
      )}
    />
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    center: { flex: 1, backgroundColor: c.bg, justifyContent: "center", alignItems: "center" },
    h1: { color: c.text, fontSize: 22, fontWeight: "800" },
    sub: { color: c.sub, fontSize: 13, marginTop: 4 },
    card: { backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: 14, padding: 14 },
    cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    name: { color: c.text, fontSize: 16, fontWeight: "700", flex: 1 },
    provider: { color: c.faint, fontSize: 12, marginTop: 2 },
    badges: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 },
    badge: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
    badgeTxt: { fontSize: 11, fontWeight: "600" },
  });
