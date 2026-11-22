import { type ReactNode, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, type DimensionValue, Linking, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Notifications from "expo-notifications";
import { getMe, type Me } from "../api";
import { useAuth } from "../auth";
import { setPrefs, usePrefs } from "../store";
import { ACCENTS, type AccentKey, type Appearance, type Colors, useTheme } from "../theme";
import RemoteScreen from "./RemoteScreen";

const nf = new Intl.NumberFormat("pl-PL");
const usd = (n: number) => "$" + n.toFixed(2);

export default function SettingsScreen() {
  const { c, appearance, setAppearance, accent, setAccent } = useTheme();
  const s = useMemo(() => makeStyles(c), [c]);
  const { user, signOut } = useAuth();
  const prefs = usePrefs();
  const [me, setMe] = useState<Me | null>(null);
  const [view, setView] = useState<"main" | "remote">("main");
  useEffect(() => { getMe().then(setMe).catch(() => {}); }, []);

  const remaining = me ? Math.max(0, me.tokenLimit - me.tokensUsed) : null;
  const pct = me && me.tokenLimit > 0 ? Math.min(1, me.tokensUsed / me.tokenLimit) : 0;
  const premium = me?.wallet && me.wallet.credit > 0;

  const confirmLogout = () => Alert.alert("Wylogować?", "Zostaniesz wylogowany z aplikacji.", [
    { text: "Anuluj", style: "cancel" },
    { text: "Wyloguj", style: "destructive", onPress: () => signOut() },
  ]);
  const toggleNotifications = async (on: boolean) => {
    setPrefs({ notifications: on });
    if (on) { try { await Notifications.requestPermissionsAsync(); } catch { /* ignore */ } }
    else { try { await Notifications.setBadgeCountAsync(0); } catch { /* ignore */ } }
  };
  const showInfo = () => Alert.alert("KingAi", "KingAi · asystent AI od KingOps\nWersja 1.0\n\naplikacja: ai.kingops.eu\nTo samo konto co w przeglądarce — historia rozmów jest wspólna.");

  if (view === "remote") return <RemoteScreen onBack={() => setView("main")} />;

  const APPEARANCES: { key: Appearance; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { key: "light", label: "Jasny", icon: "sunny-outline" },
    { key: "dark", label: "Ciemny", icon: "moon-outline" },
    { key: "system", label: "Systemowy", icon: "contrast-outline" },
  ];

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 18 }}>
      {/* Profile */}
      <View style={s.profile}>
        <View style={[s.avatar, { backgroundColor: c.accent }]}><Text style={s.avatarTxt}>{(user?.name || user?.email || "?").slice(0, 1).toUpperCase()}</Text></View>
        <Text style={s.name}>{user?.name || user?.email?.split("@")[0]}</Text>
        <Text style={s.email}>{user?.email}</Text>
        {user?.role === "ADMIN" && <View style={s.adminTag}><Text style={s.adminTxt}>admin</Text></View>}
      </View>

      {/* Usage card */}
      <View style={s.card}>
        <Text style={s.cardLabel}>Limit tokenów</Text>
        {me === null ? <ActivityIndicator color={c.accent} /> : (
          <>
            <Text style={s.big}>{nf.format(remaining ?? 0)} <Text style={s.subInline}>pozostało</Text></Text>
            <View style={s.barBg}><View style={[s.barFill, { width: `${pct * 100}%` as DimensionValue }]} /></View>
            <Text style={s.subInline}>{nf.format(me.tokensUsed)} / {nf.format(me.tokenLimit)} wykorzystane · {premium ? "Premium" : "Bezpłatny"}</Text>
            {premium && me.wallet && <Text style={[s.subInline, { marginTop: 8, color: c.emerald }]}>Budżet premium: {usd(me.wallet.remaining)} z {usd(me.wallet.credit)}</Text>}
          </>
        )}
      </View>

      {/* Motyw */}
      <Section s={s} title="Motyw">
        <View style={s.segment}>
          {APPEARANCES.map((a) => {
            const on = appearance === a.key;
            return (
              <Pressable key={a.key} style={[s.segBtn, on && { backgroundColor: c.accentSoft, borderColor: c.accent }]} onPress={() => setAppearance(a.key)}>
                <Ionicons name={a.icon} size={18} color={on ? c.accent : c.sub} />
                <Text style={[s.segTxt, { color: on ? c.accent : c.sub }]}>{a.label}</Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={s.rowLabelSmall}>Kolor wyróżniający</Text>
        <View style={s.swatches}>
          {(Object.keys(ACCENTS) as AccentKey[]).map((k) => (
            <Pressable key={k} onPress={() => setAccent(k)} style={[s.swatch, { backgroundColor: ACCENTS[k].color }, accent === k && s.swatchOn]}>
              {accent === k && <Ionicons name="checkmark" size={18} color="#fff" />}
            </Pressable>
          ))}
        </View>
      </Section>

      {/* App settings */}
      <Section s={s} title="Ustawienia aplikacji">
        <Row s={s} c={c} icon="notifications-outline" label="Powiadomienia" right={<Switch value={prefs.notifications} onValueChange={toggleNotifications} trackColor={{ true: c.accent, false: c.border }} />} />
        <Divider c={c} />
        <Row s={s} c={c} icon="mic-outline" label="Głos — auto-wysyłka" sub="W trybie rozmowy wyślij od razu po mowie" right={<Switch value={prefs.voiceAutoSend} onValueChange={(v) => setPrefs({ voiceAutoSend: v })} trackColor={{ true: c.accent, false: c.border }} />} />
        <Divider c={c} />
        <Row s={s} c={c} icon="terminal-outline" label="Zdalne sterowanie" sub="Serwery SSH, na których asystent może pracować" onPress={() => setView("remote")} chevron />
        <Divider c={c} />
        <Row s={s} c={c} icon="globe-outline" label="Panel w przeglądarce" onPress={() => Linking.openURL("https://ai.kingops.eu/dashboard")} chevron />
      </Section>

      {/* Help */}
      <Section s={s} title="Pomoc i informacje">
        <Row s={s} c={c} icon="help-circle-outline" label="Centrum pomocy" onPress={() => Linking.openURL("https://ai.kingops.eu")} chevron />
        <Divider c={c} />
        <Row s={s} c={c} icon="information-circle-outline" label="Informacje" onPress={showInfo} chevron />
      </Section>

      <Pressable style={s.logout} onPress={confirmLogout}>
        <Ionicons name="log-out-outline" size={20} color={c.red} />
        <Text style={s.logoutTxt}>Wyloguj się</Text>
      </Pressable>
      <Text style={s.version}>KingAi · ai.kingops.eu</Text>
    </ScrollView>
  );
}

function Section({ s, title, children }: { s: ReturnType<typeof makeStyles>; title: string; children: ReactNode }) {
  return (
    <View>
      <Text style={s.sectionTitle}>{title}</Text>
      <View style={s.group}>{children}</View>
    </View>
  );
}
function Divider({ c }: { c: Colors }) { return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.border, marginLeft: 46 }} />; }
function Row({ s, c, icon, label, sub, right, onPress, chevron }: { s: ReturnType<typeof makeStyles>; c: Colors; icon: keyof typeof Ionicons.glyphMap; label: string; sub?: string; right?: ReactNode; onPress?: () => void; chevron?: boolean }) {
  return (
    <Pressable style={s.row} onPress={onPress} disabled={!onPress}>
      <Ionicons name={icon} size={21} color={c.text} />
      <View style={{ flex: 1 }}>
        <Text style={s.rowLabel}>{label}</Text>
        {!!sub && <Text style={s.rowSub}>{sub}</Text>}
      </View>
      {right}
      {chevron && <Ionicons name="chevron-forward" size={18} color={c.faint} />}
    </Pressable>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    profile: { alignItems: "center", gap: 6, paddingTop: 8 },
    avatar: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center", marginBottom: 4 },
    avatarTxt: { color: "#fff", fontWeight: "800", fontSize: 30 },
    name: { color: c.text, fontSize: 20, fontWeight: "700" },
    email: { color: c.sub, fontSize: 13 },
    adminTag: { backgroundColor: c.accentSoft, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2, marginTop: 4 },
    adminTxt: { color: c.accent, fontSize: 12, fontWeight: "600" },
    card: { backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: 16, padding: 16 },
    cardLabel: { color: c.faint, fontSize: 12, fontWeight: "700", letterSpacing: 0.5, marginBottom: 8 },
    big: { color: c.text, fontSize: 26, fontWeight: "800" },
    subInline: { color: c.sub, fontSize: 13, fontWeight: "400" },
    barBg: { height: 8, borderRadius: 4, backgroundColor: c.border, marginVertical: 10, overflow: "hidden" },
    barFill: { height: 8, borderRadius: 4, backgroundColor: c.accent },
    sectionTitle: { color: c.faint, fontSize: 13, fontWeight: "700", marginBottom: 8, marginLeft: 4 },
    group: { backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: 16, overflow: "hidden" },
    segment: { flexDirection: "row", gap: 8, padding: 12 },
    segBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: c.border },
    segTxt: { fontSize: 13, fontWeight: "600" },
    rowLabelSmall: { color: c.sub, fontSize: 13, paddingHorizontal: 14, marginTop: 2 },
    swatches: { flexDirection: "row", gap: 12, padding: 14, flexWrap: "wrap" },
    swatch: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
    swatchOn: { borderWidth: 2, borderColor: "#fff" },
    row: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 14, paddingVertical: 13 },
    rowLabel: { color: c.text, fontSize: 15 },
    rowSub: { color: c.faint, fontSize: 12, marginTop: 1 },
    logout: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: 16, paddingVertical: 15 },
    logoutTxt: { color: c.red, fontSize: 15, fontWeight: "700" },
    version: { color: c.faint, fontSize: 12, textAlign: "center" },
  });
