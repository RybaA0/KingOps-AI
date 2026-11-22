import { type ComponentRef, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Animated, Easing, FlatList, Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AudioModule, RecordingPresets, setAudioModeAsync, useAudioRecorder } from "expo-audio";
import * as Speech from "expo-speech";
import * as ImagePicker from "expo-image-picker";
import { getConversation, getConversations, getModels, getServers, streamChat, transcribe, type ChatEvent, type Conversation, type Message, type Model, type SshServer } from "../api";
import { usePrefs } from "../store";
import DrawerContent from "./DrawerContent";
import { type Colors, useTheme } from "../theme";

async function uriToBase64(uri: string): Promise<string> {
  const res = await fetch(uri);
  const blob = await res.blob();
  return await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("read failed"));
    r.readAsDataURL(blob);
  });
}

const AUTO: Model = { id: "auto", label: "Auto (dobiera model)", provider: "cloud", vision: true, tools: true, reasoning: false };

export default function ChatScreen() {
  const { c } = useTheme();
  const s = useMemo(() => makeStyles(c), [c]);
  const { voiceAutoSend } = usePrefs();

  const [models, setModels] = useState<Model[]>([]);
  const [model, setModel] = useState<string>("auto");
  const [servers, setServers] = useState<SshServer[]>([]);
  const [serverId, setServerId] = useState<string | null>(null);
  const [convs, setConvs] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [pickModel, setPickModel] = useState(false);
  const [pickServer, setPickServer] = useState(false);
  const [recState, setRecState] = useState<"idle" | "recording" | "transcribing">("idle");
  const [speaking, setSpeaking] = useState<number | null>(null);
  const [voiceMode, setVoiceMode] = useState(false);
  const [attachments, setAttachments] = useState<string[]>([]);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const abortRef = useRef<{ abort: () => void } | null>(null);
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const voiceModeRef = useRef(false);
  voiceModeRef.current = voiceMode;
  const autoSendRef = useRef(voiceAutoSend);
  autoSendRef.current = voiceAutoSend;

  const allModels = models.length > 1 ? [AUTO, ...models] : models;
  const current = allModels.find((m) => m.id === model) ?? allModels[0];
  const activeServer = servers.find((v) => v.id === serverId) ?? null;

  const refreshConvs = () => getConversations().then(setConvs).catch(() => {});
  useEffect(() => { getModels().then(setModels).catch(() => {}); getServers().then(setServers).catch(() => {}); refreshConvs(); }, []);
  useEffect(() => { const t = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50); return () => clearTimeout(t); }, [msgs]);

  const openConv = async (id: string) => {
    abortRef.current?.abort();
    setDrawer(false); setActiveId(id); setMsgs([]); setBusy(false);
    const conv = await getConversation(id);
    if (conv.model && allModels.some((m) => m.id === conv.model)) setModel(conv.model);
    setMsgs(conv.messages);
  };
  const newChat = () => { abortRef.current?.abort(); setActiveId(null); setMsgs([]); setDrawer(false); };

  const patchLast = (f: (m: Message) => Message) => setMsgs((prev) => { const copy = [...prev]; copy[copy.length - 1] = f(copy[copy.length - 1]); return copy; });

  const send = (override?: string) => {
    const text = (override ?? input).trim();
    const imgs = override ? [] : attachments;
    if ((!text && imgs.length === 0) || busy) return;
    if (imgs.length > 0 && current && current.id !== "auto" && !current.vision) {
      Alert.alert("Model bez obrazów", "Wybrany model nie obsługuje zdjęć. Wybierz model z obsługą obrazów.");
      return;
    }
    const asstIdx = msgs.length + 1;
    setMsgs((m) => [...m, { role: "user", content: text, images: imgs.length ? imgs : undefined }, { role: "assistant", content: "" }]);
    if (!override) { setInput(""); setAttachments([]); }
    setBusy(true);
    let gotText = false; let acc = "";
    abortRef.current = streamChat({ conversationId: activeId ?? undefined, message: text, model, images: imgs.length ? imgs : undefined, serverId: serverId ?? undefined }, (ev: ChatEvent) => {
      if (ev.type === "meta") {
        if (!activeId && typeof ev.conversationId === "string") {
          setActiveId(ev.conversationId);
          setConvs((cs) => [{ id: ev.conversationId as string, title: String(ev.title ?? "Rozmowa"), updatedAt: new Date().toISOString() }, ...cs]);
        }
        if (typeof ev.model === "string") patchLast((m) => ({ ...m, model: ev.model as string }));
      } else if (ev.type === "tool" && typeof ev.name === "string") {
        const q = String((ev as Record<string, unknown>).query ?? "");
        patchLast((m) => ({ ...m, tools: [...(m.tools ?? []), { name: ev.name as string, query: q }] }));
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
        patchLast((m) => ({ ...m, content: m.content || String(ev.message ?? "Wystąpił błąd.") }));
        setBusy(false); abortRef.current = null;
      }
    });
  };
  const stop = () => { abortRef.current?.abort(); abortRef.current = null; setBusy(false); };

  // Voice dictation: record on-device, transcribe via the self-hosted Whisper (Polish), insert into the input.
  const startRec = async () => {
    try {
      const perm = await AudioModule.requestRecordingPermissionsAsync();
      if (!perm.granted) { Alert.alert("Brak mikrofonu", "Zezwól na mikrofon w ustawieniach iOS."); return; }
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
      const text = await transcribe(dataUrl, mime, "pl");
      if (text) {
        if (voiceModeRef.current && autoSendRef.current) send(text);
        else setInput((v) => (v ? v.trimEnd() + " " : "") + text);
      } else if (voiceModeRef.current) {
        // nothing recognised — keep listening so the conversation doesn't stall
        startRec();
      }
    } catch { /* ignore */ } finally { setRecState((p) => (p === "transcribing" ? "idle" : p)); }
  };
  const toggleMic = () => { if (recState === "recording") stopRec(); else if (recState === "idle") startRec(); };

  const readAloud = (idx: number, text: string) => {
    if (speaking === idx) { Speech.stop(); setSpeaking(null); return; }
    Speech.stop();
    setSpeaking(idx);
    const clear = () => setSpeaking((sp) => (sp === idx ? null : sp));
    Speech.speak(text, { language: "pl-PL", onDone: clear, onStopped: clear, onError: clear });
  };
  const speakThenListen = (text: string, idx: number) => {
    Speech.stop();
    setSpeaking(idx);
    const clear = () => setSpeaking((sp) => (sp === idx ? null : sp));
    Speech.speak(text, { language: "pl-PL", onStopped: clear, onError: clear, onDone: () => { clear(); if (voiceModeRef.current) setTimeout(() => { if (voiceModeRef.current) startRec(); }, 250); } });
  };
  const openVoice = async () => { setVoiceMode(true); setTimeout(() => startRec(), 300); };
  const closeVoice = () => { setVoiceMode(false); Speech.stop(); setSpeaking(null); if (recState === "recording") recorder.stop().catch(() => {}); setRecState("idle"); };
  useEffect(() => () => { Speech.stop(); }, []);

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
      setAttachments((a) => (a.length >= 4 ? a : [...a, `data:image/jpeg;base64,${b64}`]));
    } catch { /* cancelled / unavailable */ }
  };
  const pickImage = () => Alert.alert("Dołącz zdjęcie", undefined, [
    { text: "Aparat", onPress: () => addImage(true) },
    { text: "Galeria", onPress: () => addImage(false) },
    { text: "Anuluj", style: "cancel" },
  ]);

  const toolLabel = (name: string) => name === "run_ssh" ? "serwer" : name === "open_page" ? "otwieram stronę" : "szukam w sieci";
  const toolIcon = (name: string): keyof typeof Ionicons.glyphMap => name === "run_ssh" ? "terminal-outline" : name === "open_page" ? "globe-outline" : "search";

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={56}>
      <View style={s.header}>
        <Pressable onPress={() => setDrawer(true)} hitSlop={10}><Ionicons name="menu" size={26} color={c.text} /></Pressable>
        <Pressable style={s.modelBtn} onPress={() => setPickModel(true)}>
          <Text style={s.modelTxt} numberOfLines={1}>{current?.label ?? "Model"}</Text>
          <Ionicons name="chevron-down" size={14} color={c.sub} />
        </Pressable>
        <Pressable onPress={() => setPickServer(true)} hitSlop={8}>
          <Ionicons name="terminal-outline" size={22} color={activeServer ? c.accent : c.faint} />
        </Pressable>
        <Pressable onPress={openVoice} hitSlop={8}><Ionicons name="radio-outline" size={23} color={c.faint} /></Pressable>
        <Pressable onPress={newChat} hitSlop={8}><Ionicons name="add" size={28} color={c.text} /></Pressable>
      </View>
      {activeServer && (
        <View style={s.serverBar}>
          <Ionicons name="terminal-outline" size={14} color={c.accent} />
          <Text style={s.serverBarTxt}>Pracuję na: {activeServer.name} ({activeServer.username}@{activeServer.host})</Text>
          <Pressable onPress={() => setServerId(null)} hitSlop={8}><Ionicons name="close" size={16} color={c.sub} /></Pressable>
        </View>
      )}

      <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={{ padding: 14, gap: 12 }} keyboardDismissMode="interactive">
        {msgs.length === 0 && (
          <View style={s.emptyWrap}>
            <Text style={s.emptyLogo}>King<Text style={{ color: c.accent }}>Ai</Text></Text>
            <Text style={s.empty}>Napisz wiadomość, aby zacząć.</Text>
          </View>
        )}
        {msgs.map((m, i) => {
          const isUser = m.role === "user";
          return (
            <View key={i} style={[s.row, isUser && s.rowUser]}>
              <View style={s.col}>
                {!!m.tools?.length && (
                  <View style={s.toolChips}>
                    {m.tools.map((t, k) => (
                      <View key={k} style={s.chip}>
                        <Ionicons name={toolIcon(t.name)} size={12} color={c.sub} />
                        <Text style={s.chipTxt} numberOfLines={1}>{toolLabel(t.name)}{t.query ? `: ${t.query}` : ""}</Text>
                      </View>
                    ))}
                  </View>
                )}
                <View style={[s.bubble, isUser ? s.bubbleUser : s.bubbleAsst]}>
                  {m.images?.length ? (
                    <View style={s.thumbRow}>{m.images.map((src, k) => <Image key={k} source={{ uri: src }} style={s.thumb} />)}</View>
                  ) : null}
                  {m.content ? <Text style={[s.msgTxt, isUser && s.msgTxtUser]}>{m.content}</Text> : (m.role === "assistant" && !m.tools?.length ? <ActivityIndicator color={c.accent} /> : null)}
                </View>
                {m.role === "assistant" && !!m.content && (
                  <Pressable onPress={() => readAloud(i, m.content)} hitSlop={8} style={s.speak}>
                    <Ionicons name={speaking === i ? "stop-circle" : "volume-high-outline"} size={15} color={speaking === i ? c.accent : c.faint} />
                    <Text style={{ color: speaking === i ? c.accent : c.faint, fontSize: 13 }}>{speaking === i ? "Zatrzymaj" : "Przeczytaj"}</Text>
                  </Pressable>
                )}
              </View>
            </View>
          );
        })}
      </ScrollView>

      {attachments.length > 0 && (
        <View style={s.attachRow}>
          {attachments.map((src, i) => (
            <View key={i} style={s.attachItem}>
              <Image source={{ uri: src }} style={s.attachThumb} />
              <Pressable style={s.attachX} onPress={() => setAttachments((a) => a.filter((_, k) => k !== i))}><Ionicons name="close" size={12} color="#fff" /></Pressable>
            </View>
          ))}
        </View>
      )}
      <View style={s.inputBar}>
        <Pressable style={s.iconBtn} onPress={pickImage}><Ionicons name="attach" size={21} color={c.sub} /></Pressable>
        <Pressable style={[s.iconBtn, recState === "recording" && { backgroundColor: c.accentSoft }]} onPress={toggleMic} disabled={recState === "transcribing"}>
          {recState === "transcribing" ? <ActivityIndicator color={c.sub} /> : <Ionicons name={recState === "recording" ? "stop" : "mic-outline"} size={20} color={recState === "recording" ? c.red : c.sub} />}
        </Pressable>
        <TextInput style={s.input} value={input} onChangeText={setInput} placeholder={recState === "recording" ? "Nagrywam… dotknij ⏹ aby zakończyć" : "Napisz wiadomość…"} placeholderTextColor={c.faint} multiline />
        {busy ? (
          <Pressable style={[s.sendBtn, { backgroundColor: c.card }]} onPress={stop}><Ionicons name="stop" size={18} color={c.text} /></Pressable>
        ) : (
          <Pressable style={[s.sendBtn, { opacity: input.trim() || attachments.length ? 1 : 0.4 }]} onPress={() => send()} disabled={!input.trim() && attachments.length === 0}><Ionicons name="arrow-up" size={22} color="#fff" /></Pressable>
        )}
      </View>

      {/* History / projects drawer */}
      <Modal visible={drawer} animationType="slide" transparent onRequestClose={() => setDrawer(false)}>
        <Pressable style={s.backdrop} onPress={() => setDrawer(false)}>
          <Pressable style={s.drawer} onPress={() => {}}>
            <DrawerContent convs={convs} activeId={activeId} onOpenConv={openConv} onNewChat={newChat} onClose={() => setDrawer(false)} />
          </Pressable>
        </Pressable>
      </Modal>

      {/* Model picker */}
      <Modal visible={pickModel} animationType="fade" transparent onRequestClose={() => setPickModel(false)}>
        <Pressable style={s.center} onPress={() => setPickModel(false)}>
          <Pressable style={s.sheet} onPress={() => {}}>
            <Text style={s.sheetHead}>MODEL</Text>
            <FlatList
              data={allModels}
              keyExtractor={(m) => m.id}
              renderItem={({ item }) => (
                <Pressable style={[s.conv, item.id === model && { backgroundColor: c.accentSoft }]} onPress={() => { setModel(item.id); setPickModel(false); }}>
                  <Text style={s.convTitle}>{item.label}</Text>
                  <Text style={s.meta}>{item.id === "auto" ? "dobiera model automatycznie" : [item.provider === "local" ? "serwer" : "chmura", item.vision ? "obrazy" : null, item.tools ? "narzędzia" : null, item.reasoning ? "myśli" : null].filter(Boolean).join(" · ")}</Text>
                </Pressable>
              )}
            />
          </Pressable>
        </Pressable>
      </Modal>

      {/* Server picker */}
      <Modal visible={pickServer} animationType="fade" transparent onRequestClose={() => setPickServer(false)}>
        <Pressable style={s.center} onPress={() => setPickServer(false)}>
          <Pressable style={s.sheet} onPress={() => {}}>
            <Text style={s.sheetHead}>PRACUJ NA SERWERZE (SSH)</Text>
            {servers.length === 0 && <Text style={s.meta}>Dodaj serwer w: Konto → Zdalne sterowanie.</Text>}
            <Pressable style={[s.conv, !serverId && { backgroundColor: c.accentSoft }]} onPress={() => { setServerId(null); setPickServer(false); }}>
              <Text style={s.convTitle}>Bez serwera</Text>
            </Pressable>
            {servers.map((v) => (
              <Pressable key={v.id} style={[s.conv, v.id === serverId && { backgroundColor: c.accentSoft }]} onPress={() => { setServerId(v.id); setPickServer(false); }}>
                <Text style={s.convTitle}>{v.name}</Text>
                <Text style={s.meta}>{v.username}@{v.host}:{v.port}</Text>
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Voice conversation overlay */}
      <VoiceOverlay
        visible={voiceMode} colors={c}
        state={recState === "recording" ? "listening" : recState === "transcribing" || busy ? "thinking" : speaking !== null ? "speaking" : "idle"}
        onOrb={toggleMic} onClose={closeVoice}
      />
    </KeyboardAvoidingView>
  );
}

function VoiceOverlay({ visible, colors, state, onOrb, onClose }: { visible: boolean; colors: Colors; state: "idle" | "listening" | "thinking" | "speaking"; onOrb: () => void; onClose: () => void }) {
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!visible) return;
    const anim = Animated.loop(Animated.sequence([
      Animated.timing(scale, { toValue: 1.12, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ]));
    anim.start();
    return () => anim.stop();
  }, [visible, scale]);
  const label = state === "listening" ? "Słucham…" : state === "thinking" ? "Myślę…" : state === "speaking" ? "Mówię…" : "Dotknij, aby mówić";
  const hint = state === "listening" ? "Dotknij kręgu, aby wysłać" : state === "idle" ? "Dotknij kręgu, aby zacząć" : "";
  const icon: keyof typeof Ionicons.glyphMap = state === "listening" ? "stop" : state === "speaking" ? "volume-high" : state === "thinking" ? "ellipsis-horizontal" : "mic";
  if (!visible) return null;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={[vs.wrap, { backgroundColor: colors.bg }]}>
        <Pressable style={vs.closeBtn} onPress={onClose} hitSlop={12}><Ionicons name="close" size={28} color={colors.text} /></Pressable>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 28 }}>
          <Pressable onPress={onOrb} disabled={state === "thinking"}>
            <Animated.View style={[vs.orb, { backgroundColor: colors.accentSoft, borderColor: colors.accent, transform: [{ scale }] }]}>
              {state === "thinking" ? <ActivityIndicator color={colors.accent} size="large" /> : <Ionicons name={icon} size={56} color={colors.accent} />}
            </Animated.View>
          </Pressable>
          <Text style={[vs.label, { color: colors.text }]}>{label}</Text>
          {!!hint && <Text style={[vs.hint, { color: colors.faint }]}>{hint}</Text>}
        </View>
        <Pressable style={[vs.end, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={onClose}>
          <Text style={{ color: colors.red, fontWeight: "700", fontSize: 15 }}>Zakończ rozmowę</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const vs = StyleSheet.create({
  wrap: { flex: 1, paddingTop: 60, paddingBottom: 40 },
  closeBtn: { position: "absolute", top: 56, right: 20, zIndex: 2 },
  orb: { width: 180, height: 180, borderRadius: 90, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  label: { fontSize: 22, fontWeight: "700" },
  hint: { fontSize: 14 },
  end: { marginHorizontal: 40, borderRadius: 16, borderWidth: 1, paddingVertical: 15, alignItems: "center" },
});

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    header: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border },
    modelBtn: { flex: 1, flexDirection: "row", alignItems: "center", gap: 4 },
    modelTxt: { color: c.sub, fontSize: 15, flexShrink: 1 },
    serverBar: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 6, backgroundColor: c.accentSoft },
    serverBarTxt: { color: c.sub, fontSize: 12, flex: 1 },
    emptyWrap: { alignItems: "center", marginTop: 90, gap: 8 },
    emptyLogo: { fontSize: 30, fontWeight: "800", color: c.text },
    empty: { color: c.faint, textAlign: "center" },
    row: { flexDirection: "row" },
    rowUser: { justifyContent: "flex-end" },
    col: { maxWidth: "85%" },
    bubble: { borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
    bubbleUser: { backgroundColor: c.accent },
    bubbleAsst: { backgroundColor: c.card, borderWidth: 1, borderColor: c.border },
    msgTxt: { color: c.text, fontSize: 15, lineHeight: 21 },
    msgTxtUser: { color: "#fff" },
    toolChips: { gap: 4, marginBottom: 6 },
    chip: { flexDirection: "row", alignItems: "center", gap: 5, alignSelf: "flex-start", backgroundColor: c.cardAlt, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, maxWidth: "100%" },
    chipTxt: { color: c.sub, fontSize: 12, flexShrink: 1 },
    thumbRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 6 },
    thumb: { width: 120, height: 120, borderRadius: 10, backgroundColor: c.border },
    attachRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 10, paddingTop: 8 },
    attachItem: { width: 60, height: 60 },
    attachThumb: { width: 60, height: 60, borderRadius: 8, borderWidth: 1, borderColor: c.border },
    attachX: { position: "absolute", top: -6, right: -6, width: 20, height: 20, borderRadius: 10, backgroundColor: "rgba(0,0,0,0.75)", alignItems: "center", justifyContent: "center" },
    speak: { flexDirection: "row", alignItems: "center", gap: 5, paddingTop: 5, paddingHorizontal: 2 },
    iconBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, alignItems: "center", justifyContent: "center" },
    inputBar: { flexDirection: "row", alignItems: "flex-end", gap: 8, padding: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border, backgroundColor: c.panel },
    input: { flex: 1, maxHeight: 120, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10, color: c.text, fontSize: 15 },
    sendBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: c.accent, alignItems: "center", justifyContent: "center" },
    backdrop: { flex: 1, backgroundColor: c.overlay, flexDirection: "row" },
    drawer: { width: "82%", maxWidth: 360 },
    center: { flex: 1, backgroundColor: c.overlay, justifyContent: "center", padding: 24 },
    sheet: { backgroundColor: c.panel, borderRadius: 16, borderWidth: 1, borderColor: c.border, padding: 14, maxHeight: "70%" },
    sheetHead: { color: c.faint, fontSize: 11, fontWeight: "700", letterSpacing: 1, marginBottom: 8 },
    conv: { paddingVertical: 11, paddingHorizontal: 10, borderRadius: 10 },
    convTitle: { color: c.text, fontSize: 15 },
    meta: { color: c.faint, fontSize: 12, marginTop: 2 },
  });
