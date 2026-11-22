import { useMemo, useState } from "react";
import { Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { type Conversation } from "../api";
import { useAuth } from "../auth";
import { useNav } from "../Tabs";
import { addProject, usePrefs } from "../store";
import { type Colors, useTheme } from "../theme";

export default function DrawerContent({
  convs, activeId, onOpenConv, onNewChat, onClose,
}: {
  convs: Conversation[];
  activeId: string | null;
  onOpenConv: (id: string) => void;
  onNewChat: () => void;
  onClose: () => void;
}) {
  const { c } = useTheme();
  const s = useMemo(() => makeStyles(c), [c]);
  const { user } = useAuth();
  const { setTab } = useNav();
  const { projects } = usePrefs();
  const [q, setQ] = useState("");
  const [openProj, setOpenProj] = useState<Record<string, boolean>>({});

  const convById = useMemo(() => new Map(convs.map((v) => [v.id, v])), [convs]);
  const filtered = q.trim() ? convs.filter((v) => v.title.toLowerCase().includes(q.trim().toLowerCase())) : convs;

  const newProject = () => {
    if (typeof Alert.prompt === "function") {
      Alert.prompt("Nowy projekt", "Nazwa projektu", (name) => { if (name?.trim()) addProject(name); });
    } else {
      const p = addProject("Nowy projekt");
      setOpenProj((o) => ({ ...o, [p.id]: true }));
    }
  };
  const openSettings = () => { onClose(); setTab("settings"); };

  return (
    <View style={s.wrap}>
      <View style={s.topRow}>
        <Text style={s.brand}>King<Text style={{ color: c.accent }}>Ai</Text></Text>
        <Pressable onPress={onClose} hitSlop={10} style={s.roundBtn}><Ionicons name="close" size={20} color={c.text} /></Pressable>
      </View>

      <View style={s.search}>
        <Ionicons name="search" size={16} color={c.faint} />
        <TextInput style={s.searchInput} value={q} onChangeText={setQ} placeholder="Szukaj rozmów" placeholderTextColor={c.faint} />
      </View>

      <Pressable style={s.navRow} onPress={onNewChat}>
        <Ionicons name="create-outline" size={20} color={c.text} />
        <Text style={s.navTxt}>Nowa rozmowa</Text>
      </Pressable>
      <Pressable style={s.navRow} onPress={() => { onClose(); setTab("models"); }}>
        <Ionicons name="apps-outline" size={20} color={c.text} />
        <Text style={s.navTxt}>Modele</Text>
      </Pressable>

      {/* Projects (expandable) */}
      <View style={s.sectionHead}>
        <Text style={s.sectionTxt}>PROJEKTY</Text>
        <Pressable onPress={newProject} hitSlop={10}><Ionicons name="add" size={20} color={c.sub} /></Pressable>
      </View>
      {projects.length === 0 && <Text style={s.hint}>Zgrupuj rozmowy w projekty — dotknij +.</Text>}
      {projects.map((p) => {
        const expanded = !!openProj[p.id];
        const items = p.convIds.map((id) => convById.get(id)).filter(Boolean) as Conversation[];
        return (
          <View key={p.id}>
            <Pressable style={s.navRow} onPress={() => setOpenProj((o) => ({ ...o, [p.id]: !expanded }))}>
              <Ionicons name={expanded ? "folder-open-outline" : "folder-outline"} size={20} color={c.text} />
              <Text style={s.navTxt} numberOfLines={1}>{p.name}</Text>
              <Text style={s.count}>{items.length}</Text>
              <Ionicons name={expanded ? "chevron-down" : "chevron-forward"} size={16} color={c.faint} />
            </Pressable>
            {expanded && (
              <View style={s.projChildren}>
                {items.length === 0 && <Text style={s.hintSmall}>Pusty projekt. Dodaj rozmowy przez „⋯” na rozmowie.</Text>}
                {items.map((it) => (
                  <Pressable key={it.id} style={[s.conv, it.id === activeId && { backgroundColor: c.accentSoft }]} onPress={() => onOpenConv(it.id)}>
                    <Text style={s.convTitle} numberOfLines={1}>{it.title}</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        );
      })}

      {/* History */}
      <Text style={[s.sectionTxt, { marginTop: 16, marginBottom: 4 }]}>HISTORIA</Text>
      <FlatList
        style={{ flex: 1 }}
        data={filtered}
        keyExtractor={(v) => v.id}
        ListEmptyComponent={<Text style={s.hint}>{q ? "Brak wyników." : "Brak rozmów."}</Text>}
        renderItem={({ item }) => (
          <Pressable style={[s.conv, item.id === activeId && { backgroundColor: c.accentSoft }]} onPress={() => onOpenConv(item.id)}>
            <Ionicons name="chatbubble-outline" size={15} color={c.faint} />
            <Text style={s.convTitle} numberOfLines={1}>{item.title}</Text>
          </Pressable>
        )}
      />

      {/* Account footer */}
      <Pressable style={s.footer} onPress={openSettings}>
        <View style={[s.avatar, { backgroundColor: c.accent }]}><Text style={s.avatarTxt}>{(user?.name || user?.email || "?").slice(0, 1).toUpperCase()}</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={s.footerName} numberOfLines={1}>{user?.name || user?.email?.split("@")[0]}</Text>
          <Text style={s.footerSub} numberOfLines={1}>{user?.email}</Text>
        </View>
        <Ionicons name="settings-outline" size={20} color={c.sub} />
      </Pressable>
    </View>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    wrap: { flex: 1, backgroundColor: c.panel, paddingTop: 54, paddingHorizontal: 12, paddingBottom: 10, borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: c.border },
    topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
    brand: { fontSize: 24, fontWeight: "800", color: c.text },
    roundBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: c.card, alignItems: "center", justifyContent: "center" },
    search: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: c.card, borderRadius: 12, paddingHorizontal: 12, height: 40, marginBottom: 10 },
    searchInput: { flex: 1, color: c.text, fontSize: 15, padding: 0 },
    navRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 11, paddingHorizontal: 8, borderRadius: 10 },
    navTxt: { color: c.text, fontSize: 15, fontWeight: "500", flex: 1 },
    count: { color: c.faint, fontSize: 12, marginRight: 4 },
    sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 14, marginBottom: 2, paddingHorizontal: 8 },
    sectionTxt: { color: c.faint, fontSize: 11, fontWeight: "700", letterSpacing: 1, paddingHorizontal: 8 },
    hint: { color: c.faint, fontSize: 13, paddingHorizontal: 8, paddingVertical: 6 },
    hintSmall: { color: c.faint, fontSize: 12, paddingHorizontal: 8, paddingVertical: 4 },
    projChildren: { paddingLeft: 16 },
    conv: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 10, paddingHorizontal: 10, borderRadius: 10 },
    convTitle: { color: c.text, fontSize: 14, flex: 1 },
    footer: { flexDirection: "row", alignItems: "center", gap: 10, paddingTop: 12, marginTop: 6, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border },
    avatar: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
    avatarTxt: { color: "#fff", fontWeight: "800", fontSize: 16 },
    footerName: { color: c.text, fontSize: 14, fontWeight: "600" },
    footerSub: { color: c.faint, fontSize: 12 },
  });
