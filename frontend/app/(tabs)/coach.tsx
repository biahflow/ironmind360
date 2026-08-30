import React, { useCallback, useRef, useState } from "react";
import {
  View, Text, StyleSheet, TextInput, Pressable, FlatList, ActivityIndicator,
} from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { spacing, radius, fonts, type, shadow } from "@/src/theme";
import { useTheme } from "@/src/context/ThemeContext";
import { api } from "@/src/lib/api";

const AVATAR = "https://images.unsplash.com/photo-1581889470536-467bdbe30cd0?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NTYxODh8MHwxfHNlYXJjaHwyfHxkYXJrJTIwZ3JpdHR5JTIwcnVubmluZyUyMG1hcmF0aG9uJTIwdG91Z2glMjBmaXRuZXNzfGVufDB8fHx8MTc4ODAyNzc2N3ww&ixlib=rb-4.1.0&q=85";

const GREETING = {
  role: "assistant",
  content: "Você abriu esse chat por um motivo. Não veio aqui pra ser paparicado. Me diz: o que você fez HOJE pra sair do sedentarismo? E não me venha com desculpa de trabalho. Stay hard.",
  created_at: "",
};

export default function Coach() {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<any[]>([GREETING]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingReport, setLoadingReport] = useState(false);
  const [report, setReport] = useState<string | null>(null);
  const [showReport, setShowReport] = useState(false);
  const listRef = useRef<FlatList>(null);

  const load = useCallback(async () => {
    try {
      const d = await api.get("/coach/history");
      if (d.messages?.length) setMessages(d.messages);
      else setMessages([GREETING]);
    } catch {}
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const scrollEnd = () => setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const userMsg = { role: "user", content: text, created_at: new Date().toISOString() };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setSending(true);
    scrollEnd();
    try {
      const res = await api.post("/coach/chat", { message: text });
      setMessages((m) => [...m, { role: "assistant", content: res.reply, created_at: new Date().toISOString() }]);
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: "Conexão perdida. Mas isso não é desculpa pra parar. Tenta de novo.", created_at: "" }]);
    } finally {
      setSending(false);
      scrollEnd();
    }
  };

  const generateReport = async () => {
    setLoadingReport(true);
    setShowReport(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const res = await api.post("/coach/weekly-report");
      setReport(res.report);
    } catch {
      setReport("Não consegui gerar o relatório agora. Registre mais dados na semana e tente de novo.");
    } finally {
      setLoadingReport(false);
    }
  };

  const renderItem = ({ item }: any) => {
    const isCoach = item.role === "assistant";
    return (
      <View style={[s.msgRow, isCoach ? s.rowLeft : s.rowRight]}>
        {isCoach && <Image source={{ uri: AVATAR }} style={s.msgAvatar} contentFit="cover" />}
        <View style={[
          s.bubble,
          isCoach
            ? [s.coachBubble, { backgroundColor: colors.cardBackground, ...(isDark ? {} : shadow.sm) }]
            : [s.userBubble, { backgroundColor: colors.brandPrimary, ...shadow.glow(colors.brandPrimary) }],
        ]}>
          {isCoach && <Text style={[s.coachName, { color: colors.brandPrimary }]}>Coach IA</Text>}
          <Text style={[s.msgText, { color: isCoach ? colors.onSurface : colors.onBrandPrimary }]}>{item.content}</Text>
        </View>
      </View>
    );
  };

  return (
    <View style={[s.root, { backgroundColor: colors.surface }]}>
      <View style={[s.header, { paddingTop: insets.top + spacing.md, ...(isDark ? {} : shadow.sm) }]}>
        <Image source={{ uri: AVATAR }} style={[s.headerAvatar, { borderColor: colors.brandPrimary }]} contentFit="cover" />
        <View style={{ flex: 1 }}>
          <Text style={[s.headerName, { color: colors.onSurface }]}>Coach IA</Text>
          <Text style={[s.headerSub, { color: colors.onSurfaceSecondary }]}>Seu assistente de treino e saúde</Text>
        </View>
        <Pressable testID="weekly-report-button" style={[s.reportBtn, { backgroundColor: colors.brandTertiary }]} onPress={generateReport}>
          <Ionicons name="document-text-outline" size={16} color={colors.brandPrimary} />
          <Text style={[s.reportBtnText, { color: colors.brandPrimary }]}>Relatório</Text>
        </Pressable>
      </View>

      {showReport && (
        <View style={[s.reportCard, { backgroundColor: colors.cardBackground, ...(isDark ? {} : shadow.md) }]} testID="weekly-report-card">
          <View style={s.reportHead}>
            <Text style={[s.reportKicker, { color: colors.brandPrimary }]}>Relatório semanal · 7 dias</Text>
            <Pressable testID="dismiss-report" onPress={() => setShowReport(false)} hitSlop={8}>
              <Ionicons name="close" size={18} color={colors.onSurfaceSecondary} />
            </Pressable>
          </View>
          {loadingReport ? (
            <ActivityIndicator color={colors.brandPrimary} style={{ marginVertical: spacing.lg }} />
          ) : (
            <Text style={[s.reportText, { color: colors.onSurface }]}>{report}</Text>
          )}
        </View>
      )}

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior="translate-with-padding"
        keyboardVerticalOffset={0}
      >
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
              <Image source={{ uri: AVATAR }} style={s.msgAvatar} contentFit="cover" />
              <View style={[s.bubble, s.coachBubble, { backgroundColor: colors.cardBackground, ...(isDark ? {} : shadow.sm) }]}>
                <Text style={[s.typing, { color: colors.onSurfaceSecondary }]}>escrevendo...</Text>
              </View>
            </View>
          ) : null}
        />

        <View style={[s.inputBar, { paddingBottom: insets.bottom + 64 + spacing.sm, backgroundColor: colors.surface }]}>
          <TextInput
            testID="coach-input"
            style={[s.input, { backgroundColor: colors.inputBackground, color: colors.onSurface, ...(isDark ? {} : shadow.sm) }]}
            placeholder="Digite sua mensagem..."
            placeholderTextColor={colors.onSurfaceSecondary}
            value={input}
            onChangeText={setInput}
            multiline
            onSubmitEditing={send}
          />
          <Pressable testID="coach-send-button" style={[s.sendBtn, { backgroundColor: colors.brandPrimary, ...shadow.glow(colors.brandPrimary) }]} onPress={send} disabled={sending || !input.trim()}>
            <Ionicons name="arrow-up" size={22} color={colors.onBrandPrimary} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    paddingHorizontal: spacing.xl, paddingBottom: spacing.lg,
  },
  headerAvatar: { width: 48, height: 48, borderRadius: radius.pill, borderWidth: 2 },
  headerName: { fontFamily: fonts.display, fontSize: type.xl, letterSpacing: 1 },
  headerSub: { fontFamily: fonts.text, fontSize: type.sm },
  reportBtn: { flexDirection: "row", alignItems: "center", gap: spacing.xs, paddingHorizontal: spacing.lg, height: 40, borderRadius: radius.pill },
  reportBtnText: { fontFamily: fonts.semibold, fontSize: type.sm },

  reportCard: { marginHorizontal: spacing.xl, marginTop: spacing.md, borderRadius: radius.xl, padding: spacing.xl },
  reportHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.md },
  reportKicker: { fontFamily: fonts.bold, fontSize: type.sm, letterSpacing: 1 },
  reportText: { fontFamily: fonts.text, fontSize: type.base, lineHeight: 22 },

  msgRow: { flexDirection: "row", gap: spacing.sm, maxWidth: "100%" },
  rowLeft: { justifyContent: "flex-start" },
  rowRight: { justifyContent: "flex-end" },
  msgAvatar: { width: 36, height: 36, borderRadius: radius.pill, marginTop: 2 },
  bubble: { maxWidth: "80%", padding: spacing.lg, borderRadius: radius.lg },
  coachBubble: {},
  userBubble: {},
  coachName: { fontFamily: fonts.bold, fontSize: 10, letterSpacing: 1, marginBottom: 4 },
  msgText: { fontFamily: fonts.text, fontSize: type.base, lineHeight: 22 },
  typing: { fontFamily: fonts.mono, fontSize: type.sm },

  inputBar: {
    flexDirection: "row", alignItems: "flex-end", gap: spacing.sm,
    paddingHorizontal: spacing.xl, paddingTop: spacing.md,
  },
  input: {
    flex: 1, borderRadius: radius.xl,
    fontFamily: fonts.text, fontSize: type.lg,
    paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.lg,
    maxHeight: 120, minHeight: 52,
  },
  sendBtn: { width: 52, height: 52, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
});
