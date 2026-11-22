import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, type DimensionValue, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { getMe, type Me } from "../api";
import { useAuth } from "../auth";
import { C } from "../theme";

const nf = new Intl.NumberFormat("pl-PL");
const usd = (n: number) => "$" + n.toFixed(2);

export default function SettingsScreen() {
  const { user, signOut } = useAuth();
  const [me, setMe] = useState<Me | null>(null);
  useEffect(() => { getMe().then(setMe).catch(() => {}); }, []);

  const remaining = me ? Math.max(0, me.tokenLimit - me.tokensUsed) : null;
  const pct = me && me.tokenLimit > 0 ? Math.min(1, me.tokensUsed / me.tokenLimit) : 0;

  const confirmLogout = () => Alert.alert("Wylogować?", "Zostaniesz wylogowany z aplikacji.", [
    { text: "Anuluj", style: "cancel" },
    { text: "Wyloguj", style: "destructive", onPress: () => signOut() },
  ]);

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 14 }}>
      <Text style={styles.h1}>Ustawienia</Text>

      <View style={styles.card}>
        <Text style={styles.name}>{user?.name || user?.email?.split("@")[0]}</Text>
        <Text style={styles.email}>{user?.email}</Text>
        {user?.role === "ADMIN" && <View style={styles.adminTag}><Text style={styles.adminTxt}>admin</Text></View>}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>Limit tokenów</Text>
        {me === null ? <ActivityIndicator color={C.violet} /> : (
          <>
            <Text style={styles.big}>{nf.format(remaining ?? 0)} <Text style={styles.sub}>pozostało</Text></Text>
            <View style={styles.barBg}><View style={[styles.barFill, { width: `${pct * 100}%` as DimensionValue }]} /></View>
            <Text style={styles.sub}>{nf.format(me.tokensUsed)} / {nf.format(me.tokenLimit)} wykorzystane</Text>
            {me.wallet && me.wallet.credit > 0 && (
              <Text style={[styles.sub, { marginTop: 8, color: C.emerald }]}>Budżet premium: {usd(me.wallet.remaining)} z {usd(me.wallet.credit)}</Text>
            )}
          </>
        )}
      </View>

      <Pressable style={styles.linkRow} onPress={() => Linking.openURL("https://ai.kingops.eu/dashboard")}>
        <Text style={styles.linkTxt}>Panel w przeglądarce</Text><Text style={styles.chev}>›</Text>
      </Pressable>

      <Pressable style={styles.logout} onPress={confirmLogout}>
        <Text style={styles.logoutTxt}>Wyloguj</Text>
      </Pressable>

      <Text style={styles.version}>KingAi · ai.kingops.eu</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  h1: { color: C.text, fontSize: 24, fontWeight: "800" },
  card: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 14, padding: 16 },
  name: { color: C.text, fontSize: 18, fontWeight: "700" },
  email: { color: C.sub, fontSize: 14, marginTop: 2 },
  adminTag: { alignSelf: "flex-start", backgroundColor: C.violetSoft, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2, marginTop: 8 },
  adminTxt: { color: C.violet, fontSize: 12, fontWeight: "600" },
  cardLabel: { color: C.faint, fontSize: 12, fontWeight: "700", letterSpacing: 0.5, marginBottom: 8 },
  big: { color: C.text, fontSize: 26, fontWeight: "800" },
  sub: { color: C.sub, fontSize: 13, fontWeight: "400" },
  barBg: { height: 8, borderRadius: 4, backgroundColor: C.border, marginVertical: 10, overflow: "hidden" },
  barFill: { height: 8, borderRadius: 4, backgroundColor: C.violet },
  linkRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 14, padding: 16 },
  linkTxt: { color: C.text, fontSize: 15 },
  chev: { color: C.faint, fontSize: 22 },
  logout: { backgroundColor: "rgba(248,113,113,0.12)", borderWidth: 1, borderColor: "rgba(248,113,113,0.3)", borderRadius: 14, padding: 16, alignItems: "center" },
  logoutTxt: { color: C.red, fontSize: 15, fontWeight: "700" },
  version: { color: C.faint, fontSize: 12, textAlign: "center", marginTop: 10 },
});
