import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { createServer, deleteServer, getServers, testServer, type SshServer } from "../api";
import { type Colors, useTheme } from "../theme";

export default function RemoteScreen({ onBack }: { onBack: () => void }) {
  const { c } = useTheme();
  const s = useMemo(() => makeStyles(c), [c]);
  const [servers, setServers] = useState<SshServer[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [host, setHost] = useState("");
  const [port, setPort] = useState("22");
  const [username, setUsername] = useState("");
  const [authType, setAuthType] = useState<"password" | "key">("password");
  const [secret, setSecret] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () => getServers().then(setServers).catch(() => setServers([]));
  useEffect(() => { load(); }, []);

  const reset = () => { setName(""); setHost(""); setPort("22"); setUsername(""); setAuthType("password"); setSecret(""); setAdding(false); };
  const save = async () => {
    if (!host.trim() || !username.trim()) { Alert.alert("Uzupełnij dane", "Podaj host i użytkownika."); return; }
    setBusy(true);
    const r = await createServer({
      name: name.trim() || host.trim(), host: host.trim(), port: Number(port) || 22, username: username.trim(),
      ...(authType === "password" ? { password: secret } : { privateKey: secret }),
    });
    setBusy(false);
    if (r.ok) { reset(); load(); } else Alert.alert("Nie zapisano", r.message ?? "Spróbuj ponownie.");
  };
  const remove = (v: SshServer) => Alert.alert("Usunąć serwer?", v.name, [
    { text: "Anuluj", style: "cancel" },
    { text: "Usuń", style: "destructive", onPress: async () => { await deleteServer(v.id); load(); } },
  ]);
  const test = async (v: SshServer) => {
    setTesting(v.id);
    const r = await testServer(v.id);
    setTesting(null);
    Alert.alert(r.ok ? "Połączono ✓" : "Błąd połączenia", r.message);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={s.head}>
        <Pressable onPress={onBack} hitSlop={10} style={s.backBtn}><Ionicons name="chevron-back" size={24} color={c.text} /><Text style={s.backTxt}>Konto</Text></Pressable>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 16 }} keyboardShouldPersistTaps="handled">
        <View>
          <Text style={s.h1}>Zdalne sterowanie</Text>
          <Text style={s.sub}>Dodaj serwer SSH, a następnie w czacie dotknij ikony terminala i wybierz go — asystent będzie mógł uruchamiać na nim polecenia i pracować za Ciebie.</Text>
        </View>

        {servers === null ? <ActivityIndicator color={c.accent} /> : servers.length === 0 && !adding ? (
          <Text style={s.empty}>Brak serwerów.</Text>
        ) : (
          servers.map((v) => (
            <View key={v.id} style={s.card}>
              <View style={s.cardTop}>
                <Ionicons name="server-outline" size={20} color={c.accent} />
                <View style={{ flex: 1 }}>
                  <Text style={s.cardName}>{v.name}</Text>
                  <Text style={s.cardMeta}>{v.username}@{v.host}:{v.port}</Text>
                </View>
              </View>
              <View style={s.cardActions}>
                <Pressable style={s.actionBtn} onPress={() => test(v)} disabled={testing === v.id}>
                  {testing === v.id ? <ActivityIndicator color={c.sub} size="small" /> : <><Ionicons name="pulse-outline" size={16} color={c.sub} /><Text style={s.actionTxt}>Testuj</Text></>}
                </Pressable>
                <Pressable style={s.actionBtn} onPress={() => remove(v)}>
                  <Ionicons name="trash-outline" size={16} color={c.red} /><Text style={[s.actionTxt, { color: c.red }]}>Usuń</Text>
                </Pressable>
              </View>
            </View>
          ))
        )}

        {adding ? (
          <View style={s.card}>
            <Field s={s} c={c} label="Nazwa (opcjonalnie)"><TextInput style={s.input} value={name} onChangeText={setName} placeholder="np. VPS node03" placeholderTextColor={c.faint} /></Field>
            <Field s={s} c={c} label="Host / IP"><TextInput style={s.input} value={host} onChangeText={setHost} placeholder="89.144.32.23" placeholderTextColor={c.faint} autoCapitalize="none" autoCorrect={false} keyboardType="url" /></Field>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={{ width: 90 }}><Field s={s} c={c} label="Port"><TextInput style={s.input} value={port} onChangeText={setPort} keyboardType="number-pad" placeholderTextColor={c.faint} /></Field></View>
              <View style={{ flex: 1 }}><Field s={s} c={c} label="Użytkownik"><TextInput style={s.input} value={username} onChangeText={setUsername} placeholder="root" placeholderTextColor={c.faint} autoCapitalize="none" autoCorrect={false} /></Field></View>
            </View>
            <View style={s.segment}>
              {(["password", "key"] as const).map((t) => (
                <Pressable key={t} style={[s.segBtn, authType === t && { backgroundColor: c.accentSoft, borderColor: c.accent }]} onPress={() => setAuthType(t)}>
                  <Text style={[s.segTxt, { color: authType === t ? c.accent : c.sub }]}>{t === "password" ? "Hasło" : "Klucz prywatny"}</Text>
                </Pressable>
              ))}
            </View>
            <Field s={s} c={c} label={authType === "password" ? "Hasło" : "Klucz prywatny (PEM)"}>
              <TextInput style={[s.input, authType === "key" && { height: 110, textAlignVertical: "top" }]} value={secret} onChangeText={setSecret} placeholder={authType === "password" ? "••••••••" : "-----BEGIN OPENSSH PRIVATE KEY-----"} placeholderTextColor={c.faint} secureTextEntry={authType === "password"} multiline={authType === "key"} autoCapitalize="none" autoCorrect={false} />
            </Field>
            <Text style={s.warn}>Dane logowania są szyfrowane i przechowywane na serwerze KingAi. Dodawaj tylko serwery, którymi zarządzasz.</Text>
            <View style={{ flexDirection: "row", gap: 10, marginTop: 4 }}>
              <Pressable style={[s.saveBtn, { backgroundColor: c.card, borderWidth: 1, borderColor: c.border }]} onPress={reset}><Text style={[s.saveTxt, { color: c.sub }]}>Anuluj</Text></Pressable>
              <Pressable style={[s.saveBtn, busy && { opacity: 0.6 }]} onPress={save} disabled={busy}>{busy ? <ActivityIndicator color="#fff" /> : <Text style={s.saveTxt}>Zapisz</Text>}</Pressable>
            </View>
          </View>
        ) : (
          <Pressable style={s.addBtn} onPress={() => setAdding(true)}>
            <Ionicons name="add" size={20} color={c.accent} /><Text style={s.addTxt}>Dodaj serwer</Text>
          </Pressable>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({ s, c, label, children }: { s: ReturnType<typeof makeStyles>; c: Colors; label: string; children: React.ReactNode }) {
  return <View style={{ marginBottom: 10 }}><Text style={s.lbl}>{label}</Text>{children}</View>;
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    head: { paddingHorizontal: 10, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border },
    backBtn: { flexDirection: "row", alignItems: "center" },
    backTxt: { color: c.text, fontSize: 16 },
    h1: { color: c.text, fontSize: 22, fontWeight: "800" },
    sub: { color: c.sub, fontSize: 13, marginTop: 4, lineHeight: 19 },
    empty: { color: c.faint, fontSize: 14 },
    card: { backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: 16, padding: 14 },
    cardTop: { flexDirection: "row", alignItems: "center", gap: 10 },
    cardName: { color: c.text, fontSize: 16, fontWeight: "700" },
    cardMeta: { color: c.faint, fontSize: 12, marginTop: 1 },
    cardActions: { flexDirection: "row", gap: 10, marginTop: 12 },
    actionBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, backgroundColor: c.cardAlt },
    actionTxt: { color: c.sub, fontSize: 13, fontWeight: "600" },
    lbl: { color: c.sub, fontSize: 13, marginBottom: 6 },
    input: { backgroundColor: c.bg, borderWidth: 1, borderColor: c.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, color: c.text, fontSize: 15 },
    segment: { flexDirection: "row", gap: 8, marginBottom: 10 },
    segBtn: { flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: c.border },
    segTxt: { fontSize: 13, fontWeight: "600" },
    warn: { color: c.amber, fontSize: 12, lineHeight: 17, marginBottom: 4 },
    saveBtn: { flex: 1, backgroundColor: c.accent, borderRadius: 12, paddingVertical: 13, alignItems: "center" },
    saveTxt: { color: "#fff", fontWeight: "700", fontSize: 15 },
    addBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: 16, paddingVertical: 15 },
    addTxt: { color: c.accent, fontSize: 15, fontWeight: "700" },
  });
