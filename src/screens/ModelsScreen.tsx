import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import { getModels, type Model } from "../api";
import { C } from "../theme";

function Badge({ text, color }: { text: string; color: string }) {
  return <View style={[styles.badge, { borderColor: color }]}><Text style={[styles.badgeTxt, { color }]}>{text}</Text></View>;
}

export default function ModelsScreen() {
  const [models, setModels] = useState<Model[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const load = () => getModels().then(setModels).catch(() => setModels([]));
  useEffect(() => { load(); }, []);
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  if (!models) return <View style={styles.center}><ActivityIndicator color={C.violet} size="large" /></View>;

  return (
    <FlatList
      style={{ flex: 1 }}
      contentContainerStyle={{ padding: 14, gap: 10 }}
      data={models}
      keyExtractor={(m) => m.id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.violet} />}
      ListHeaderComponent={
        <View style={{ marginBottom: 6 }}>
          <Text style={styles.h1}>Dostępne modele</Text>
          <Text style={styles.sub}>Modele „widzące" (obrazy) obsługują też głos — dyktowanie i czytanie odpowiedzi.</Text>
        </View>
      }
      ListEmptyComponent={<Text style={styles.sub}>Brak modeli do wyświetlenia.</Text>}
      renderItem={({ item }) => (
        <View style={styles.card}>
          <View style={styles.cardTop}>
            <Text style={styles.name}>{item.label}</Text>
            <Text style={[styles.dot, { color: item.provider === "local" ? C.emerald : C.sky }]}>●</Text>
          </View>
          <Text style={styles.provider}>{item.provider === "local" ? "Serwer KingOps" : "Chmura"}{item.adminOnly ? " · tylko admin" : ""}</Text>
          <View style={styles.badges}>
            {item.vision && <Badge text="obrazy / głos" color={C.sky} />}
            {item.tools && <Badge text="narzędzia" color={C.violet} />}
            {item.reasoning && <Badge text="myśli na głos" color={C.amber} />}
          </View>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: C.bg, justifyContent: "center", alignItems: "center" },
  h1: { color: C.text, fontSize: 22, fontWeight: "800" },
  sub: { color: C.sub, fontSize: 13, marginTop: 4 },
  card: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 14, padding: 14 },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  name: { color: C.text, fontSize: 16, fontWeight: "700", flex: 1 },
  dot: { fontSize: 12 },
  provider: { color: C.faint, fontSize: 12, marginTop: 2 },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 },
  badge: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  badgeTxt: { fontSize: 11, fontWeight: "600" },
});
