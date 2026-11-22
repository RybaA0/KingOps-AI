import { type ReactNode, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { login, register } from "../api";
import { useAuth } from "../auth";
import { C } from "../theme";

export default function AuthScreen() {
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

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
        <Text style={styles.logo}>King<Text style={{ color: C.violet }}>Ai</Text></Text>
        <Text style={styles.sub}>Asystent AI od KingOps</Text>

        <View style={styles.switch}>
          {(["login", "register"] as const).map((m) => (
            <Pressable key={m} style={[styles.switchBtn, mode === m && styles.switchOn]} onPress={() => { setMode(m); setError(""); setInfo(""); }}>
              <Text style={[styles.switchTxt, { color: mode === m ? C.text : C.sub }]}>{m === "login" ? "Logowanie" : "Rejestracja"}</Text>
            </Pressable>
          ))}
        </View>

        {mode === "register" && (
          <Field label="Imię lub nick (opcjonalnie)">
            <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Jan" placeholderTextColor={C.faint} autoCapitalize="words" />
          </Field>
        )}
        <Field label="E-mail">
          <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="ty@przyklad.pl" placeholderTextColor={C.faint} autoCapitalize="none" keyboardType="email-address" autoCorrect={false} />
        </Field>
        <Field label="Hasło">
          <TextInput style={styles.input} value={password} onChangeText={setPassword} placeholder="••••••••" placeholderTextColor={C.faint} secureTextEntry />
        </Field>
        {mode === "register" && (
          <Field label="Powtórz hasło">
            <TextInput style={styles.input} value={confirm} onChangeText={setConfirm} placeholder="••••••••" placeholderTextColor={C.faint} secureTextEntry />
          </Field>
        )}

        {!!error && <Text style={styles.error}>{error}</Text>}
        {!!info && <Text style={styles.info}>{info}</Text>}

        <Pressable style={[styles.primary, busy && { opacity: 0.6 }]} onPress={submit} disabled={busy}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryTxt}>{mode === "login" ? "Zaloguj" : "Załóż konto"}</Text>}
        </Pressable>

        <Text style={styles.footer}>To samo konto co na ai.kingops.eu — historia rozmów jest wspólna.</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={{ width: "100%", marginBottom: 12 }}>
      <Text style={styles.lbl}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexGrow: 1, justifyContent: "center", alignItems: "center", padding: 24, gap: 4 },
  logo: { fontSize: 34, fontWeight: "800", color: C.text, marginTop: 24 },
  sub: { color: C.sub, marginBottom: 20 },
  switch: { flexDirection: "row", backgroundColor: C.card, borderRadius: 12, padding: 4, marginBottom: 16, width: "100%" },
  switchBtn: { flex: 1, paddingVertical: 10, borderRadius: 9, alignItems: "center" },
  switchOn: { backgroundColor: C.violetSoft },
  switchTxt: { fontWeight: "600" },
  lbl: { color: C.sub, fontSize: 13, marginBottom: 6 },
  input: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, color: C.text, fontSize: 16 },
  error: { color: C.red, alignSelf: "flex-start", marginBottom: 4 },
  info: { color: C.emerald, alignSelf: "flex-start", marginBottom: 4 },
  primary: { backgroundColor: C.violet, borderRadius: 14, paddingVertical: 15, alignItems: "center", width: "100%", marginTop: 8 },
  primaryTxt: { color: "#fff", fontWeight: "700", fontSize: 16 },
  footer: { color: C.faint, fontSize: 12, textAlign: "center", marginTop: 20 },
});
