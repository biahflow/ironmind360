import React, { useCallback, useRef, useState } from "react";
import {
  View, Text, StyleSheet, TextInput, Pressable, FlatList, ActivityIndicator,
  ScrollView, Modal, Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { spacing, radius, fonts, type } from "@/src/theme";
import { useTheme } from "@/src/context/ThemeContext";
import { api } from "@/src/lib/api";
import {
  Screen, ScreenHeader, Card, PillTabs, Overline, PrimaryButton,
  SecondaryButton, EmptyState, SectionTitle,
} from "@/src/components/ui";

const TONE_LABELS: Record<string, string> = {
  direct: "Direto",
  balanced: "Equilibrado",
  supportive: "Acolhedor",
};

const TONE_ICONS: Record<string, string> = {
  direct: "flame-outline",
  balanced: "options-outline",
  supportive: "heart-outline",
};

const GREETING: Record<string, { role: string; content: string }> = {
  direct: {
    role: "assistant",
    content: "Você abriu esse chat por um motivo. Me diz: o que você fez HOJE? Sem desculpas.",
  },
  balanced: {
    role: "assistant",
    content: "Fala, atleta. Vamos olhar seu treino e planejar o próximo passo juntos.",
  },
  supportive: {
    role: "assistant",
    content: "Que bom ter você aqui! Conta como está se sentindo — cada passo conta.",
  },
};

type Tab = "chat" | "wellness" | "reports";

function CoachAvatar() {
  const { colors } = useTheme();
  return (
    <View style={[s.msgAvatar, { backgroundColor: colors.accentMuted }]}>
      <Ionicons name="chatbubble-ellipses" size={18} color={colors.accent} />
    </View>
  );
}

export default function Coach() {
  const [tab, setTab] = useState<Tab>("chat");

  return (
    <Screen>
      <ScreenHeader title="Comandante" />
      <PillTabs
        tabs={[
          { key: "chat" as Tab, label: "Chat" },
          { key: "wellness" as Tab, label: "Bem-estar" },
          { key: "reports" as Tab, label: "Relatórios" },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === "chat" && <ChatTab />}
      {tab === "wellness" && <WellnessTab />}
      {tab === "reports" && <ReportsTab />}
    </Screen>
  );
}

// ── Chat Tab ──────────────────────────────────────────────────

function ChatTab() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<any[]>([]);
  const [showConvList, setShowConvList] = useState(false);
  const [tone, setTone] = useState("balanced");
  const [showTonePicker, setShowTonePicker] = useState(false);
  const listRef = useRef<FlatList>(null);

  const loadSettings = useCallback(async () => {
    try {
      const u = await api.get("/settings");
      if (u.coach_tone) setTone(u.coach_tone);
    } catch {}
  }, []);

  const loadConversations = useCallback(async () => {
    try {
      const d = await api.get("/coach/conversations");
      setConversations(d.conversations || []);
    } catch {}
  }, []);

  const loadHistory = useCallback(async (convId?: string) => {
    try {
      const url = convId ? `/coach/history?conversation_id=${convId}` : "/coach/history";
      const d = await api.get(url);
      if (d.messages?.length) setMessages(d.messages);
      else setMessages([GREETING[tone] || GREETING.balanced]);
    } catch {
      setMessages([GREETING[tone] || GREETING.balanced]);
    }
  }, [tone]);

  useFocusEffect(useCallback(() => {
    loadSettings();
    loadConversations();
    loadHistory();
  }, [loadSettings, loadConversations, loadHistory]));

  const scrollEnd = () => setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setMessages((m) => [...m, { role: "user", content: text, created_at: new Date().toISOString() }]);
    setInput("");
    setSending(true);
    scrollEnd();
    try {
      const res = await api.post("/coach/chat", {
        message: text,
        conversation_id: conversationId,
      });
      setMessages((m) => [...m, {
        role: "assistant", content: res.reply,
        created_at: new Date().toISOString(), sources: res.sources,
      }]);
      if (res.conversation_id && !conversationId) {
        setConversationId(res.conversation_id);
        loadConversations();
      }
    } catch {
      setMessages((m) => [...m, {
        role: "assistant",
        content: "Conexão perdida. Tente novamente.",
        created_at: "",
      }]);
    } finally {
      setSending(false);
      scrollEnd();
    }
  };

  const startNewConversation = () => {
    setConversationId(null);
    setMessages([GREETING[tone] || GREETING.balanced]);
    setShowConvList(false);
  };

  const openConversation = (conv: any) => {
    setConversationId(conv.id);
    loadHistory(conv.id);
    setShowConvList(false);
  };

  const deleteConversation = async (convId: string) => {
    try {
      await api.del(`/coach/conversations/${convId}`);
      loadConversations();
      if (conversationId === convId) startNewConversation();
    } catch {}
  };

  const changeTone = async (newTone: string) => {
    setTone(newTone);
    setShowTonePicker(false);
    try {
      await api.put("/settings", { coach_tone: newTone });
    } catch {}
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const renderItem = ({ item }: any) => {
    const isCoach = item.role === "assistant";
    return (
      <View style={[s.msgRow, isCoach ? s.rowLeft : s.rowRight]}>
        {isCoach && <CoachAvatar />}
        <View style={[
          s.bubble,
          isCoach
            ? { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }
            : { backgroundColor: colors.accent },
        ]}>
          {isCoach && <Text style={[s.coachName, { color: colors.accent }]}>Comandante</Text>}
          <Text style={[s.msgText, { color: isCoach ? colors.text : colors.onAccent }]}>{item.content}</Text>
          {isCoach && item.sources?.length > 0 && (
            <Text style={[s.sourcesText, { color: colors.textSecondary }]}>
              Dados: {item.sources.join(", ")}
            </Text>
          )}
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior="translate-with-padding" keyboardVerticalOffset={0}>
      {/* Toolbar */}
      <View style={[s.toolbar, { borderBottomColor: colors.border }]}>
        <Pressable
          style={[s.toolBtn, { backgroundColor: colors.accentMuted }]}
          onPress={() => setShowConvList(!showConvList)}
        >
          <Ionicons name="chatbubbles-outline" size={16} color={colors.accent} />
          <Text style={[s.toolBtnText, { color: colors.accent }]}>Conversas</Text>
        </Pressable>
        <Pressable
          style={[s.toolBtn, { backgroundColor: colors.accentMuted }]}
          onPress={() => setShowTonePicker(true)}
        >
          <Ionicons name={(TONE_ICONS[tone] || "options-outline") as any} size={16} color={colors.accent} />
          <Text style={[s.toolBtnText, { color: colors.accent }]}>{TONE_LABELS[tone] || "Tom"}</Text>
        </Pressable>
        <Pressable
          style={[s.toolBtn, { backgroundColor: colors.accentMuted }]}
          onPress={startNewConversation}
        >
          <Ionicons name="add-outline" size={16} color={colors.accent} />
          <Text style={[s.toolBtnText, { color: colors.accent }]}>Nova</Text>
        </Pressable>
      </View>

      {/* Conversation list */}
      {showConvList && (
        <View style={[s.convList, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <ScrollView style={{ maxHeight: 200 }}>
            {conversations.length === 0 && (
              <Text style={[s.convEmpty, { color: colors.textSecondary }]}>Nenhuma conversa ainda</Text>
            )}
            {conversations.map((c) => (
              <Pressable
                key={c.id}
                style={[s.convItem, conversationId === c.id && { backgroundColor: colors.accentMuted }]}
                onPress={() => openConversation(c)}
              >
                <Text style={[s.convTitle, { color: colors.text }]} numberOfLines={1}>
                  {c.title_auto || c.title}
                </Text>
                <Pressable onPress={() => deleteConversation(c.id)} hitSlop={8}>
                  <Ionicons name="trash-outline" size={14} color={colors.textSecondary} />
                </Pressable>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Tone picker modal */}
      <Modal visible={showTonePicker} transparent animationType="fade">
        <Pressable style={[s.modalOverlay, { backgroundColor: colors.overlay }]} onPress={() => setShowTonePicker(false)}>
          <View style={[s.modalContent, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[s.modalTitle, { color: colors.text }]}>Tom do Coach</Text>
            {Object.entries(TONE_LABELS).map(([key, label]) => (
              <Pressable
                key={key}
                style={[s.toneOption, tone === key && { backgroundColor: colors.accentMuted }]}
                onPress={() => changeTone(key)}
              >
                <Ionicons name={(TONE_ICONS[key] || "options-outline") as any} size={20} color={tone === key ? colors.accent : colors.textSecondary} />
                <View style={{ flex: 1 }}>
                  <Text style={[s.toneName, { color: colors.text }]}>{label}</Text>
                  <Text style={[s.toneDesc, { color: colors.textSecondary }]}>
                    {key === "direct" && "Firme e objetivo, cobra resultados"}
                    {key === "balanced" && "Técnico com encorajamento"}
                    {key === "supportive" && "Empático e acolhedor"}
                  </Text>
                </View>
                {tone === key && <Ionicons name="checkmark" size={20} color={colors.accent} />}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>

      {/* Messages */}
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(_, i) => String(i)}
        renderItem={renderItem}
        contentContainerStyle={{ padding: spacing.xl, gap: spacing.md, paddingBottom: spacing.xl }}
        onContentSizeChange={scrollEnd}
        showsVerticalScrollIndicator={false}
        ListFooterComponent={sending ? (
          <View style={[s.msgRow, s.rowLeft]}>
            <CoachAvatar />
            <View style={[s.bubble, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }]}>
              <Text style={[s.typing, { color: colors.textSecondary }]}>escrevendo...</Text>
            </View>
          </View>
        ) : null}
      />

      {/* Input bar */}
      <View style={[s.inputBar, { paddingBottom: insets.bottom + 64 + spacing.sm, backgroundColor: colors.bg }]}>
        <TextInput
          testID="coach-input"
          style={[s.input, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.text }]}
          placeholder="Digite sua mensagem..."
          placeholderTextColor={colors.textSecondary}
          value={input}
          onChangeText={setInput}
          multiline
          onSubmitEditing={send}
        />
        <Pressable testID="coach-send-button" style={[s.sendBtn, { backgroundColor: colors.accent }]} onPress={send} disabled={sending || !input.trim()}>
          <Ionicons name="arrow-up" size={22} color={colors.onAccent} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

// ── Wellness Tab ──────────────────────────────────────────────

function WellnessTab() {
  const [subTab, setSubTab] = useState<"diary" | "breathing" | "reflections">("diary");

  return (
    <View style={{ flex: 1 }}>
      <PillTabs
        tabs={[
          { key: "diary" as const, label: "Diário" },
          { key: "breathing" as const, label: "Respiração" },
          { key: "reflections" as const, label: "Reflexões" },
        ]}
        value={subTab}
        onChange={setSubTab}
      />
      {subTab === "diary" && <DiarySection />}
      {subTab === "breathing" && <BreathingSection />}
      {subTab === "reflections" && <ReflectionsSection />}
    </View>
  );
}

function DiarySection() {
  const { colors } = useTheme();
  const [entries, setEntries] = useState<any[]>([]);
  const [text, setText] = useState("");
  const [mood, setMood] = useState(3);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await api.get("/coach/diary");
      setEntries(d.entries || []);
    } catch {}
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const save = async () => {
    if (!text.trim() || saving) return;
    setSaving(true);
    try {
      await api.post("/coach/diary", { content: text.trim(), mood, tags: [] });
      setText("");
      setMood(3);
      load();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {} finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await api.del(`/coach/diary/${id}`);
      load();
    } catch {}
  };

  const moodEmoji = ["", "😟", "😐", "🙂", "😊", "🤩"];

  return (
    <ScrollView contentContainerStyle={s.sectionContent}>
      <Card>
        <Overline color={colors.accent}>Como você está hoje?</Overline>
        <View style={s.moodRow}>
          {[1, 2, 3, 4, 5].map((v) => (
            <Pressable key={v} onPress={() => setMood(v)} style={[s.moodBtn, mood === v && { backgroundColor: colors.accentMuted }]}>
              <Text style={s.moodEmoji}>{moodEmoji[v]}</Text>
            </Pressable>
          ))}
        </View>
        <TextInput
          style={[s.diaryInput, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.text }]}
          placeholder="Escreva livremente sobre seu dia..."
          placeholderTextColor={colors.textSecondary}
          value={text}
          onChangeText={setText}
          multiline
          numberOfLines={4}
        />
        <PrimaryButton label={saving ? "Salvando..." : "Salvar"} onPress={save} disabled={!text.trim() || saving} />
      </Card>

      <Text style={[s.disclaimerText, { color: colors.textSecondary }]}>
        Este diário é privado e não substitui acompanhamento com psicólogo ou terapeuta.
      </Text>

      {entries.length === 0 ? (
        <EmptyState icon="book-outline" title="Nenhuma entrada ainda" />
      ) : (
        entries.map((e) => (
          <Card key={e.id}>
            <View style={s.entryHeader}>
              <Text style={[s.entryMood, { color: colors.text }]}>{moodEmoji[e.mood] || ""}</Text>
              <Text style={[s.entryDate, { color: colors.textSecondary }]}>
                {new Date(e.created_at).toLocaleDateString("pt-BR")}
              </Text>
              <Pressable onPress={() => remove(e.id)} hitSlop={8}>
                <Ionicons name="trash-outline" size={14} color={colors.textSecondary} />
              </Pressable>
            </View>
            <Text style={[s.entryText, { color: colors.text }]}>{e.content}</Text>
          </Card>
        ))
      )}
    </ScrollView>
  );
}

function BreathingSection() {
  const { colors } = useTheme();
  const [techniques, setTechniques] = useState<any[]>([]);
  const [active, setActive] = useState<any>(null);
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      const d = await api.get("/coach/breathing/techniques");
      setTechniques(d.techniques || []);
    } catch {}
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const start = (tech: any) => {
    setActive(tech);
    setElapsed(0);
    setRunning(true);
    intervalRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
  };

  const stop = async () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setRunning(false);
    if (active && elapsed > 0) {
      try {
        await api.post("/coach/breathing/log", {
          technique: active.key,
          duration_seconds: elapsed,
          completed: elapsed >= (active.recommended_minutes || 3) * 60,
        });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {}
    }
    setActive(null);
    setElapsed(0);
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s2 = secs % 60;
    return `${m}:${s2.toString().padStart(2, "0")}`;
  };

  if (running && active) {
    const cycle = active.inhale_s + active.hold_in_s + active.exhale_s + active.hold_out_s;
    const pos = elapsed % cycle;
    let phase = "Inspire";
    if (pos >= active.inhale_s && pos < active.inhale_s + active.hold_in_s) phase = "Segure";
    else if (pos >= active.inhale_s + active.hold_in_s && pos < active.inhale_s + active.hold_in_s + active.exhale_s) phase = "Expire";
    else if (pos >= active.inhale_s + active.hold_in_s + active.exhale_s) phase = "Pause";

    return (
      <View style={s.breathingActive}>
        <Text style={[s.breathingPhase, { color: colors.accent }]}>{phase}</Text>
        <Text style={[s.breathingTimer, { color: colors.text }]}>{formatTime(elapsed)}</Text>
        <Text style={[s.breathingName, { color: colors.textSecondary }]}>{active.name}</Text>
        <SecondaryButton label="Parar" onPress={stop} />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={s.sectionContent}>
      <Text style={[s.disclaimerText, { color: colors.textSecondary }]}>
        Exercícios de respiração para relaxamento e foco. Não substituem tratamento médico.
      </Text>
      {techniques.map((t) => (
        <Card key={t.key}>
          <Text style={[s.techName, { color: colors.text }]}>{t.name}</Text>
          <Text style={[s.techDesc, { color: colors.textSecondary }]}>{t.description}</Text>
          <View style={s.techMeta}>
            <Text style={[s.techCycle, { color: colors.accent }]}>
              {t.inhale_s}s-{t.hold_in_s}s-{t.exhale_s}s{t.hold_out_s ? `-${t.hold_out_s}s` : ""}
            </Text>
            <Text style={[s.techDur, { color: colors.textSecondary }]}>~{t.recommended_minutes} min</Text>
          </View>
          <PrimaryButton label="Iniciar" onPress={() => start(t)} />
        </Card>
      ))}
    </ScrollView>
  );
}

function ReflectionsSection() {
  const { colors } = useTheme();
  const [prompts, setPrompts] = useState<any[]>([]);
  const [reflections, setReflections] = useState<any[]>([]);
  const [selectedPrompt, setSelectedPrompt] = useState<any>(null);
  const [response, setResponse] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const [p, r] = await Promise.all([
        api.get("/coach/reflections/prompts"),
        api.get("/coach/reflections"),
      ]);
      setPrompts(p.prompts || []);
      setReflections(r.reflections || []);
    } catch {}
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const save = async () => {
    if (!response.trim() || !selectedPrompt || saving) return;
    setSaving(true);
    try {
      await api.post("/coach/reflections", {
        prompt_key: selectedPrompt.key,
        response: response.trim(),
      });
      setResponse("");
      setSelectedPrompt(null);
      load();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {} finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={s.sectionContent}>
      {!selectedPrompt ? (
        <>
          <SectionTitle>Escolha uma reflexão</SectionTitle>
          {prompts.map((p) => (
            <Pressable key={p.key} onPress={() => setSelectedPrompt(p)}>
              <Card>
                <Text style={[s.promptText, { color: colors.text }]}>{p.text}</Text>
              </Card>
            </Pressable>
          ))}
        </>
      ) : (
        <Card>
          <Overline color={colors.accent}>Reflexão</Overline>
          <Text style={[s.promptText, { color: colors.text }]}>{selectedPrompt.text}</Text>
          <TextInput
            style={[s.diaryInput, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.text }]}
            placeholder="Sua resposta..."
            placeholderTextColor={colors.textSecondary}
            value={response}
            onChangeText={setResponse}
            multiline
            numberOfLines={4}
          />
          <View style={s.reflBtns}>
            <SecondaryButton label="Cancelar" onPress={() => { setSelectedPrompt(null); setResponse(""); }} />
            <PrimaryButton label={saving ? "Salvando..." : "Salvar"} onPress={save} disabled={!response.trim() || saving} />
          </View>
        </Card>
      )}

      {reflections.length > 0 && (
        <>
          <SectionTitle style={{ marginTop: spacing.xl }}>Suas reflexões</SectionTitle>
          {reflections.map((r) => (
            <Card key={r.id}>
              <Overline color={colors.accent}>{r.prompt_text}</Overline>
              <Text style={[s.entryText, { color: colors.text }]}>{r.response}</Text>
              <Text style={[s.entryDate, { color: colors.textSecondary }]}>
                {new Date(r.created_at).toLocaleDateString("pt-BR")}
              </Text>
            </Card>
          ))}
        </>
      )}
    </ScrollView>
  );
}

// ── Reports Tab ───────────────────────────────────────────────

function ReportsTab() {
  const { colors } = useTheme();
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api.get("/coach/reports");
      setReports(d.reports || []);
    } catch {} finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const generate = async () => {
    setGenerating(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await api.post("/coach/weekly-report");
      load();
    } catch {
      Alert.alert("Erro", "Não foi possível gerar o relatório. Tente novamente.");
    } finally {
      setGenerating(false);
    }
  };

  const toggleAction = async (reportId: string, idx: number) => {
    try {
      const res = await api.put(`/coach/reports/${reportId}/actions/${idx}`);
      setReports((prev) =>
        prev.map((r) => (r.id === reportId ? { ...r, actions: res.actions } : r))
      );
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
  };

  return (
    <ScrollView contentContainerStyle={s.sectionContent}>
      <PrimaryButton
        label={generating ? "Gerando..." : "Gerar relatório semanal"}
        onPress={generate}
        disabled={generating}
      />

      {loading && <ActivityIndicator color={colors.accent} style={{ marginTop: spacing.xl }} />}

      {!loading && reports.length === 0 && (
        <EmptyState icon="document-text-outline" title="Nenhum relatório gerado" />
      )}

      {reports.map((r) => (
        <Card key={r.id}>
          <View style={s.reportHead}>
            <Overline color={colors.accent}>
              {new Date(r.created_at).toLocaleDateString("pt-BR")}
            </Overline>
            {r.sources?.length > 0 && (
              <Text style={[s.sourcesText, { color: colors.textSecondary }]}>
                Dados: {r.sources.join(", ")}
              </Text>
            )}
          </View>
          <Text style={[s.reportText, { color: colors.text }]}>{r.content}</Text>
          {r.actions?.length > 0 && (
            <View style={s.actionsSection}>
              <Overline color={colors.accent}>Ações</Overline>
              {r.actions.map((a: any, i: number) => (
                <Pressable key={i} style={s.actionRow} onPress={() => toggleAction(r.id, i)}>
                  <Ionicons
                    name={a.completed ? "checkmark-circle" : "ellipse-outline"}
                    size={20}
                    color={a.completed ? colors.accent : colors.textSecondary}
                  />
                  <Text style={[
                    s.actionText,
                    { color: colors.text },
                    a.completed && { textDecorationLine: "line-through", color: colors.textSecondary },
                  ]}>
                    {a.text}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </Card>
      ))}
    </ScrollView>
  );
}

// ── Styles ────────────────────────────────────────────────────

const s = StyleSheet.create({
  toolbar: {
    flexDirection: "row", gap: spacing.sm, paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm, borderBottomWidth: 1,
  },
  toolBtn: {
    flexDirection: "row", alignItems: "center", gap: spacing.xs,
    paddingHorizontal: spacing.md, height: 32, borderRadius: radius.pill,
  },
  toolBtnText: { fontFamily: fonts.semibold, ...type.caption },

  convList: {
    marginHorizontal: spacing.xl, marginTop: spacing.sm,
    borderRadius: radius.lg, borderWidth: 1, overflow: "hidden",
  },
  convItem: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
  },
  convTitle: { fontFamily: fonts.text, ...type.body, flex: 1, marginRight: spacing.sm },
  convEmpty: { fontFamily: fonts.text, ...type.bodySmall, padding: spacing.lg, textAlign: "center" },

  modalOverlay: {
    flex: 1, justifyContent: "center", alignItems: "center",
  },
  modalContent: {
    width: "85%", borderRadius: radius.hero, padding: spacing.xl, borderWidth: 1,
  },
  modalTitle: { fontFamily: fonts.bold, ...type.h2, marginBottom: spacing.lg },
  toneOption: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    paddingVertical: spacing.md, paddingHorizontal: spacing.md, borderRadius: radius.md,
    marginBottom: spacing.xs,
  },
  toneName: { fontFamily: fonts.semibold, ...type.body },
  toneDesc: { fontFamily: fonts.text, ...type.caption },

  msgRow: { flexDirection: "row", gap: spacing.sm, maxWidth: "100%" },
  rowLeft: { justifyContent: "flex-start" },
  rowRight: { justifyContent: "flex-end" },
  msgAvatar: {
    width: 36, height: 36, borderRadius: radius.pill, marginTop: 2,
    alignItems: "center", justifyContent: "center",
  },
  bubble: { maxWidth: "80%", padding: spacing.lg, borderRadius: radius.lg },
  coachName: { fontFamily: fonts.bold, ...type.caption, marginBottom: 4 },
  msgText: { fontFamily: fonts.text, ...type.body },
  sourcesText: { fontFamily: fonts.text, ...type.caption, marginTop: spacing.xs, fontStyle: "italic" },
  typing: { fontFamily: fonts.text, ...type.bodySmall },

  inputBar: {
    flexDirection: "row", alignItems: "flex-end", gap: spacing.sm,
    paddingHorizontal: spacing.xl, paddingTop: spacing.md,
  },
  input: {
    flex: 1, borderRadius: radius.xl, borderWidth: 1,
    fontFamily: fonts.text, ...type.body,
    paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.lg,
    maxHeight: 120, minHeight: 52,
  },
  sendBtn: {
    width: 52, height: 52, borderRadius: radius.pill,
    alignItems: "center", justifyContent: "center",
  },

  sectionContent: { padding: spacing.xl, gap: spacing.md, paddingBottom: 120 },

  moodRow: { flexDirection: "row", gap: spacing.sm, marginVertical: spacing.md },
  moodBtn: { width: 44, height: 44, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  moodEmoji: { fontSize: 22 },
  diaryInput: {
    borderRadius: radius.lg, borderWidth: 1, padding: spacing.lg,
    fontFamily: fonts.text, ...type.body, minHeight: 100, textAlignVertical: "top",
    marginBottom: spacing.md,
  },
  disclaimerText: {
    fontFamily: fonts.text, ...type.caption, fontStyle: "italic",
    textAlign: "center", paddingHorizontal: spacing.xl,
  },

  entryHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.xs },
  entryMood: { fontSize: 18 },
  entryDate: { fontFamily: fonts.text, ...type.caption, flex: 1 },
  entryText: { fontFamily: fonts.text, ...type.body },

  techName: { fontFamily: fonts.bold, ...type.body },
  techDesc: { fontFamily: fonts.text, ...type.body, marginTop: spacing.xs },
  techMeta: { flexDirection: "row", gap: spacing.lg, marginVertical: spacing.md },
  techCycle: { fontFamily: fonts.semibold, ...type.bodySmall },
  techDur: { fontFamily: fonts.text, ...type.bodySmall },

  promptText: { fontFamily: fonts.text, ...type.body, marginVertical: spacing.sm },
  reflBtns: { flexDirection: "row", gap: spacing.md, marginTop: spacing.sm },

  reportHead: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    marginBottom: spacing.md,
  },
  reportText: { fontFamily: fonts.text, ...type.body },
  actionsSection: { marginTop: spacing.lg },
  actionRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.xs },
  actionText: { fontFamily: fonts.text, ...type.body, flex: 1 },

  breathingActive: {
    flex: 1, justifyContent: "center", alignItems: "center", gap: spacing.lg, padding: spacing.xl,
  },
  breathingPhase: { fontFamily: fonts.bold, fontSize: 36 },
  breathingTimer: { fontFamily: fonts.text, fontSize: 48 },
  breathingName: { fontFamily: fonts.text, ...type.body },
});
