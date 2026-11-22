import { type ComponentRef, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { AudioModule, RecordingPresets, setAudioModeAsync, useAudioRecorder } from "expo-audio";
import * as Speech from "expo-speech";
import * as ImagePicker from "expo-image-picker";
import { getConversation, getConversations, getModels, streamChat, transcribe, type ChatEvent, type Conversation, type Message, type Model } from "../api";
import { C } from "../theme";

async function uriToBase64(uri: string): Promise<string> {
  const res = await fetch(uri);
  const blob = await res.blob();
  return await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result)); // data:audio/...;base64,XXXX (server strips the prefix)
    r.onerror = () => reject(new Error("read failed"));
    r.readAsDataURL(blob);
  });
}

const AUTO: Model = { id: "auto", label: "Auto (dobiera model)", provider: "cloud", vision: true, tools: true, reasoning: false };

export default function ChatScreen() {
  const [models, setModels] = useState<Model[]>([]);
  const [model, setModel] = useState<string>("auto");
  const [convs, setConvs] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [pickModel, setPickModel] = useState(false);
  const [recState, setRecState] = useState<"idle" | "recording" | "transcribing">("idle");
  const [speaking, setSpeaking] = useState<number | null>(null);
  const [voiceMode, setVoiceMode] = useState(false);
  const [attachments, setAttachments] = useState<string[]>([]);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const abortRef = useRef<{ abort: () => void } | null>(null);
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const voiceModeRef = useRef(false);
  voiceModeRef.current = voiceMode;

  const allModels = models.length > 1 ? [AUTO, ...models] : models;
  const current = allModels.find((m) => m.id === model) ?? allModels[0];

  const refreshConvs = () => getConversations().then(setConvs).catch(() => {});
  useEffect(() => { getModels().then(setModels).catch(() => {}); refreshConvs(); }, []);
  useEffect(() => { const t = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50); return () => clearTimeout(t); }, [msgs]);

  const openConv = async (id: string) => {
    abortRef.current?.abort();
    setDrawer(false); setActiveId(id); setMsgs([]); setBusy(false);
    const c = await getConversation(id);
    if (c.model && allModels.some((m) => m.id === c.model)) setModel(c.model);
    setMsgs(c.messages);
  };
  const newChat = () => { abortRef.current?.abort(); setActiveId(null); setMsgs([]); setDrawer(false); };

  const patchLast = (f: (m: Message) => Message) => setMsgs((prev) => { const c = [...prev]; c[c.length - 1] = f(c[c.length - 1]); return c; });

  const send = (override?: string) => {
    const text = (override ?? input).trim();
    const imgs = override ? [] : attachments;
    if ((!text && imgs.length === 0) || busy) return;
    if (imgs.length > 0 && current && current.id !== "auto" && !current.vision) {
      Alert.alert("Model bez obrazów", "Wybrany model nie obsługuje zdjęć. Wybierz model z obsługą obrazów.");
      return;
    }
    const asstIdx = msgs.length + 1; // index of the assistant bubble we are about to add
    setMsgs((m) => [...m, { role: "user", content: text, images: imgs.length ? imgs : undefined }, { role: "assistant", content: "" }]);
    if (!override) { setInput(""); setAttachments([]); }
    setBusy(true);
    let gotText = false; let acc = "";
    abortRef.current = streamChat({ conversationId: activeId ?? undefined, message: text, model, images: imgs.length ? imgs : undefined }, (ev: ChatEvent) => {
      if (ev.type === "meta") {
        if (!activeId && typeof ev.conversationId === "string") {
          setActiveId(ev.conversationId);
          setConvs((c) => [{ id: ev.conversationId as string, title: String(ev.title ?? "Rozmowa"), updatedAt: new Date().toISOString() }, ...c]);
        }
        if (typeof ev.model === "string") patchLast((m) => ({ ...m, model: ev.model as string }));
      } else if (ev.type === "delta" && typeof ev.text === "string") {
        const txt = ev.text;
        const first = !gotText; gotText = true;
        acc = first ? txt.replace(/^\s+/, "") : acc + txt;
        patchLast((m) => ({ ...m, content: first ? txt.replace(/^\s+/, "") : m.content + txt }));
      } else if (ev.type === "done") {
        if (typeof ev.messageId === "string") patchLast((m) => ({ ...m, id: ev.messageId as string }));
        setBusy(false); abortRef.current = null; refreshConvs();
        if (voiceModeRef.current && acc.trim()) speakThenListen(acc, asstIdx);
      } else if (ev.type === "error") {
        patchLast((m) => ({ ...m, content: m.content || `⚠️ ${String(ev.message ?? "Błąd.")}` }));
        setBusy(false); abortRef.current = null;
      }
    });
  };
  const stop = () => { abortRef.current?.abort(); abortRef.current = null; setBusy(false); };

  // Voice dictation: record on-device, transcribe via the self-hosted Whisper, insert into the input.
  const startRec = async () => {
    try {
      const perm = await AudioModule.requestRecordingPermissionsAsync();
      if (!perm.granted) return;
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setRecState("recording");
    } catch { setRecState("idle"); }
  };
  const stopRec = async () => {
    try {
      await recorder.stop();
      const uri = recorder.uri;
      if (!uri) { setRecState("idle"); return; }
      setRecState("transcribing");
      const dataUrl = await uriToBase64(uri);
      const mime = dataUrl.slice(5, dataUrl.indexOf(";")) || "audio/m4a";
      const text = await transcribe(dataUrl, mime);
      if (text) { if (voiceModeRef.current) send(text); else setInput((v) => (v ? v.trimEnd() + " " : "") + text); }
    } catch { /* ignore */ } finally { setRecState("idle"); }
  };
  const toggleMic = () => { if (recState === "recording") stopRec(); else if (recState === "idle") startRec(); };

  // Read a reply aloud with the iOS system voice.
  const readAloud = (idx: number, text: string) => {
    if (speaking === idx) { Speech.stop(); setSpeaking(null); return; }
    Speech.stop();
    setSpeaking(idx);
    const clear = () => setSpeaking((s) => (s === idx ? null : s));
    Speech.speak(text, { language: "pl-PL", onDone: clear, onStopped: clear, onError: clear });
  };
  // Voice conversation mode: read the reply, then start listening for the next message automatically.
  const speakThenListen = (text: string, idx: number) => {
    Speech.stop();
    setSpeaking(idx);
    const clear = () => setSpeaking((s) => (s === idx ? null : s));
    Speech.speak(text, { language: "pl-PL", onStopped: clear, onError: clear, onDone: () => { clear(); if (voiceModeRef.current) startRec(); } });
  };
  const toggleVoiceMode = () => setVoiceMode((v) => {
    const nv = !v;
    if (!nv) { Speech.stop(); setSpeaking(null); if (recState === "recording") stopRec(); }
    return nv;
  });
  useEffect(() => () => { Speech.stop(); }, []);

  // Attach a photo from the camera or gallery (as a compressed JPEG data URL for vision models).
  const addImage = async (fromCamera: boolean) => {
    try {
      const perm = fromCamera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) { Alert.alert("Brak dostępu", fromCamera ? "Zezwól na aparat w ustawieniach." : "Zezwól na dostęp do zdjęć w ustawieniach."); return; }
      const res = fromCamera
        ? await ImagePicker.launchCameraAsync({ quality: 0.4, base64: true })
        : await ImagePicker.launchImageLibraryAsync({ quality: 0.4, base64: true, allowsMultipleSelection: false });
      if (res.canceled) return;
      const b64 = res.assets?.[0]?.base64;
      if (!b64) return;
      const dataUrl = `data:image/jpeg;base64,${b64}`;
      setAttachments((a) => (a.length >= 4 ? a : [...a, dataUrl]));
    } catch { /* cancelled / unavailable */ }
  };
  const pickImage = () => Alert.alert("Dołącz zdjęcie", undefined, [
    { text: "Aparat", onPress: () => addImage(true) },
    { text: "Galeria", onPress: () => addImage(false) },
    { text: "Anuluj", style: "cancel" },
  ]);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={56}>
      <View style={styles.header}>
        <Pressable onPress={() => setDrawer(true)} hitSlop={10}><Text style={styles.headerIcon}>☰</Text></Pressable>
        <Pressable style={styles.modelBtn} onPress={() => setPickModel(true)}>
          <Text style={styles.modelTxt} numberOfLines={1}>{current?.label ?? "Model"} ▾</Text>
        </Pressable>
        <Pressable onPress={toggleVoiceMode} hitSlop={8}><Text style={[styles.headerIcon, { opacity: voiceMode ? 1 : 0.45 }]}>🎙️</Text></Pressable>
        <Pressable onPress={newChat} hitSlop={8}><Text style={styles.headerIcon}>＋</Text></Pressable>
      </View>
      {voiceMode && <Text style={styles.voiceHint}>{recState === "recording" ? "Słucham… dotknij ⏺ aby wysłać" : speaking !== null ? "Czytam odpowiedź…" : "Tryb rozmowy głosowej — odpowiem i zacznę słuchać"}</Text>}

      <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={{ padding: 14, gap: 12 }}>
        {msgs.length === 0 && <Text style={styles.empty}>Napisz wiadomość, aby zacząć.</Text>}
        {msgs.map((m, i) => (
          <View key={i} style={[styles.row, m.role === "user" ? styles.rowUser : null]}>
            <View style={{ maxWidth: "85%" }}>
              <View style={[styles.bubble, m.role === "user" ? styles.bubbleUser : styles.bubbleAsst]}>
                {m.images?.length ? (
                  <View style={styles.thumbRow}>
                    {m.images.map((src, k) => <Image key={k} source={{ uri: src }} style={styles.thumb} />)}
                  </View>
                ) : null}
                {m.content ? <Text style={styles.msgTxt}>{m.content}</Text> : (m.role === "assistant" ? <ActivityIndicator color={C.violet} /> : null)}
              </View>
              {m.role === "assistant" && !!m.content && (
                <Pressable onPress={() => readAloud(i, m.content)} hitSlop={8} style={styles.speak}>
                  <Text style={{ color: speaking === i ? C.violet : C.faint, fontSize: 13 }}>{speaking === i ? "⏹ Zatrzymaj" : "🔊 Przeczytaj"}</Text>
                </Pressable>
              )}
            </View>
          </View>
        ))}
      </ScrollView>

      {attachments.length > 0 && (
        <View style={styles.attachRow}>
          {attachments.map((src, i) => (
            <View key={i} style={styles.attachItem}>
              <Image source={{ uri: src }} style={styles.attachThumb} />
              <Pressable style={styles.attachX} onPress={() => setAttachments((a) => a.filter((_, k) => k !== i))}><Text style={{ color: "#fff", fontSize: 12 }}>×</Text></Pressable>
            </View>
          ))}
        </View>
      )}
      <View style={styles.inputBar}>
        <Pressable style={styles.micBtn} onPress={pickImage}><Text style={{ fontSize: 18 }}>📎</Text></Pressable>
        <Pressable style={[styles.micBtn, recState === "recording" && { backgroundColor: "rgba(248,113,113,0.2)" }]} onPress={toggleMic} disabled={recState === "transcribing"}>
          {recState === "transcribing" ? <ActivityIndicator color={C.sub} /> : <Text style={{ fontSize: 18 }}>{recState === "recording" ? "⏺" : "🎤"}</Text>}
        </Pressable>
        <TextInput style={styles.input} value={input} onChangeText={setInput} placeholder={recState === "recording" ? "Nagrywam… dotknij ⏺ aby zakończyć" : "Napisz wiadomość…"} placeholderTextColor={C.faint} multiline />
        {busy ? (
          <Pressable style={[styles.sendBtn, { backgroundColor: C.card }]} onPress={stop}><Text style={styles.sendTxt}>■</Text></Pressable>
        ) : (
          <Pressable style={[styles.sendBtn, { opacity: input.trim() || attachments.length ? 1 : 0.4 }]} onPress={() => send()} disabled={!input.trim() && attachments.length === 0}><Text style={styles.sendTxt}>↑</Text></Pressable>
        )}
      </View>

      {/* History drawer */}
      <Modal visible={drawer} animationType="slide" transparent onRequestClose={() => setDrawer(false)}>
        <Pressable style={styles.backdrop} onPress={() => setDrawer(false)}>
          <Pressable style={styles.drawer} onPress={() => {}}>
            <Pressable style={styles.newBtn} onPress={newChat}><Text style={styles.newTxt}>＋ Nowa rozmowa</Text></Pressable>
            <Text style={styles.drawerHead}>HISTORIA</Text>
            <FlatList
              data={convs}
              keyExtractor={(c) => c.id}
              ListEmptyComponent={<Text style={styles.empty}>Brak rozmów.</Text>}
              renderItem={({ item }) => (
                <Pressable style={[styles.conv, item.id === activeId && { backgroundColor: C.violetSoft }]} onPress={() => openConv(item.id)}>
                  <Text style={styles.convTitle} numberOfLines={1}>{item.title}</Text>
                </Pressable>
              )}
            />
          </Pressable>
        </Pressable>
      </Modal>

      {/* Model picker */}
      <Modal visible={pickModel} animationType="fade" transparent onRequestClose={() => setPickModel(false)}>
        <Pressable style={styles.center} onPress={() => setPickModel(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.drawerHead}>MODEL</Text>
            <FlatList
              data={allModels}
              keyExtractor={(m) => m.id}
              renderItem={({ item }) => (
                <Pressable style={[styles.conv, item.id === model && { backgroundColor: C.violetSoft }]} onPress={() => { setModel(item.id); setPickModel(false); }}>
                  <Text style={styles.convTitle}>{item.label}</Text>
                  <Text style={styles.modelMeta}>{item.id === "auto" ? "dobiera model automatycznie" : [item.provider === "local" ? "serwer" : "chmura", item.vision ? "obrazy" : null, item.tools ? "narzędzia" : null, item.reasoning ? "myśli" : null].filter(Boolean).join(" · ")}</Text>
                </Pressable>
              )}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border },
  headerIcon: { color: C.text, fontSize: 22 },
  modelBtn: { flex: 1 },
  modelTxt: { color: C.sub, fontSize: 14 },
  empty: { color: C.faint, textAlign: "center", marginTop: 24 },
  row: { flexDirection: "row" },
  rowUser: { justifyContent: "flex-end" },
  bubble: { maxWidth: "85%", borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleUser: { backgroundColor: C.violetSoft },
  bubbleAsst: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border },
  msgTxt: { color: C.text, fontSize: 15, lineHeight: 21 },
  voiceHint: { color: C.violet, fontSize: 12, textAlign: "center", paddingVertical: 4, backgroundColor: C.violetSoft },
  thumbRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 6 },
  thumb: { width: 120, height: 120, borderRadius: 10, backgroundColor: C.border },
  attachRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 10, paddingTop: 8 },
  attachItem: { width: 60, height: 60 },
  attachThumb: { width: 60, height: 60, borderRadius: 8, borderWidth: 1, borderColor: C.border },
  attachX: { position: "absolute", top: -6, right: -6, width: 20, height: 20, borderRadius: 10, backgroundColor: "rgba(0,0,0,0.75)", alignItems: "center", justifyContent: "center" },
  speak: { paddingTop: 4, paddingHorizontal: 4 },
  micBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, alignItems: "center", justifyContent: "center" },
  inputBar: { flexDirection: "row", alignItems: "flex-end", gap: 8, padding: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border, backgroundColor: C.panel },
  input: { flex: 1, maxHeight: 120, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10, color: C.text, fontSize: 15 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.violet, alignItems: "center", justifyContent: "center" },
  sendTxt: { color: "#fff", fontSize: 20, fontWeight: "700" },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", flexDirection: "row" },
  drawer: { width: "78%", backgroundColor: C.panel, padding: 14, borderRightWidth: 1, borderRightColor: C.border },
  newBtn: { backgroundColor: C.violet, borderRadius: 12, paddingVertical: 12, alignItems: "center", marginTop: 40, marginBottom: 12 },
  newTxt: { color: "#fff", fontWeight: "700" },
  drawerHead: { color: C.faint, fontSize: 11, fontWeight: "700", letterSpacing: 1, marginBottom: 8 },
  conv: { paddingVertical: 11, paddingHorizontal: 10, borderRadius: 10 },
  convTitle: { color: C.text, fontSize: 15 },
  modelMeta: { color: C.faint, fontSize: 12, marginTop: 2 },
  center: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "center", padding: 24 },
  sheet: { backgroundColor: C.panel, borderRadius: 16, borderWidth: 1, borderColor: C.border, padding: 14, maxHeight: "70%" },
});
