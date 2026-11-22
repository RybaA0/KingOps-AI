import { type ReactNode, useMemo, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { login, register } from "../api";
import { useAuth } from "../auth";
import { type Colors, useTheme } from "../theme";

export default function AuthScreen() {
  const { c } = useTheme();
  const s = useMemo(() => makeStyles(c), [c]);
  const { setUser } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const submit = async () => {
    setError(""); setInfo(""); setBusy(true);
    try {
      if (mode === "login") {
        const r = await login(email, password);
        if (r.ok) setUser(r.user);
        else setError(r.message);
      } else {
        if (password !== confirm) { setError("Hasła się różnią."); return; }
        const r = await register({ name, email, password, confirm });
        if (r.ok) { setInfo("Konto utworzone. Potwierdź e-mail (link w wiadomości), potem zaloguj się."); setMode("login"); }
        else setError(r.message ?? "Nie udało się założyć konta.");
      }
    } finally { setBusy(false); }
  };

  const Field = ({ label, children }: { label: string; children: ReactNode }) => (
    <View style={{ width: "100%", marginBottom: 12 }}><Text style={s.lbl}>{label}</Text>{children}</View>
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={s.wrap} keyboardShouldPersistTaps="handled">
        <Text style={s.logo}>King<Text style={{ color: c.accent }}>Ai</Text></Text>
        <Text style={s.sub}>Asystent AI od KingOps</Text>

        <View style={s.switch}>
          {(["login", "register"] as const).map((m) => (
            <Pressable key={m} style={[s.switchBtn, mode === m && s.switchOn]} onPress={() => { setMode(m); setError(""); setInfo(""); }}>
              <Text style={[s.switchTxt, { color: mode === m ? c.text : c.sub }]}>{m === "login" ? "Logowanie" : "Rejestracja"}</Text>
            </Pressable>
          ))}
        </View>

        {mode === "register" && (
          <Field label="Imię lub nick (opcjonalnie)">
            <TextInput style={s.input} value={name} onChangeText={setName} placeholder="Jan" placeholderTextColor={c.faint} autoCapitalize="words" />
          </Field>
        )}
        <Field label="E-mail">
          <TextInput style={s.input} value={email} onChangeText={setEmail} placeholder="ty@przyklad.pl" placeholderTextColor={c.faint} autoCapitalize="none" keyboardType="email-address" autoCorrect={false} />
        </Field>
        <Field label="Hasło">
          <TextInput style={s.input} value={password} onChangeText={setPassword} placeholder="••••••••" placeholderTextColor={c.faint} secureTextEntry />
        </Field>
        {mode === "register" && (
          <Field label="Powtórz hasło">
            <TextInput style={s.input} value={confirm} onChangeText={setConfirm} placeholder="••••••••" placeholderTextColor={c.faint} secureTextEntry />
          </Field>
        )}

        {!!error && <Text style={s.error}>{error}</Text>}
        {!!info && <Text style={s.info}>{info}</Text>}

        <Pressable style={[s.primary, busy && { opacity: 0.6 }]} onPress={submit} disabled={busy}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryTxt}>{mode === "login" ? "Zaloguj" : "Załóż konto"}</Text>}
        </Pressable>

        <Text style={s.footer}>To samo konto co na ai.kingops.eu — historia rozmów jest wspólna.</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    wrap: { flexGrow: 1, justifyContent: "center", alignItems: "center", padding: 24, gap: 4 },
    logo: { fontSize: 34, fontWeight: "800", color: c.text, marginTop: 24 },
    sub: { color: c.sub, marginBottom: 20 },
    switch: { flexDirection: "row", backgroundColor: c.card, borderRadius: 12, padding: 4, marginBottom: 16, width: "100%" },
    switchBtn: { flex: 1, paddingVertical: 10, borderRadius: 9, alignItems: "center" },
    switchOn: { backgroundColor: c.accentSoft },
    switchTxt: { fontWeight: "600" },
    lbl: { color: c.sub, fontSize: 13, marginBottom: 6 },
    input: { backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, color: c.text, fontSize: 16 },
    error: { color: c.red, alignSelf: "flex-start", marginBottom: 4 },
    info: { color: c.emerald, alignSelf: "flex-start", marginBottom: 4 },
    primary: { backgroundColor: c.accent, borderRadius: 14, paddingVertical: 15, alignItems: "center", width: "100%", marginTop: 8 },
    primaryTxt: { color: "#fff", fontWeight: "700", fontSize: 16 },
    footer: { color: c.faint, fontSize: 12, textAlign: "center", marginTop: 20 },
  });
