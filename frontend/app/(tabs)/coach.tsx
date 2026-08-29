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

import { colors, spacing, radius, fonts, type } from "@/src/theme";
import { api } from "@/src/lib/api";

const AVATAR = "https://images.unsplash.com/photo-1581889470536-467bdbe30cd0?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NTYxODh8MHwxfHNlYXJjaHwyfHxkYXJrJTIwZ3JpdHR5JTIwcnVubmluZyUyMG1hcmF0aG9uJTIwdG91Z2glMjBmaXRuZXNzfGVufDB8fHx8MTc4ODAyNzc2N3ww&ixlib=rb-4.1.0&q=85";

const GREETING = {
  role: "assistant",
  content: "Você abriu esse chat por um motivo. Não veio aqui pra ser paparicado. Me diz: o que você fez HOJE pra sair do sedentarismo? E não me venha com desculpa de trabalho. Stay hard.",
  created_at: "",
};

export default function Coach() {
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
    } catch (e: any) {
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
      <View style={[styles.msgRow, isCoach ? styles.rowLeft : styles.rowRight]}>
        {isCoach && <Image source={{ uri: AVATAR }} style={styles.msgAvatar} contentFit="cover" />}
        <View style={[styles.bubble, isCoach ? styles.coachBubble : styles.userBubble]}>
          {isCoach && <Text style={styles.coachName}>O COMANDANTE</Text>}
          <Text style={[styles.msgText, !isCoach && styles.userText]}>{item.content}</Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Image source={{ uri: AVATAR }} style={styles.headerAvatar} contentFit="cover" />
        <View style={{ flex: 1 }}>
          <Text style={styles.headerName}>O COMANDANTE</Text>
          <Text style={styles.headerSub}>Coach mental · Modo Goggins</Text>
        </View>
        <Pressable testID="weekly-report-button" style={styles.reportBtn} onPress={generateReport}>
          <Ionicons name="document-text-outline" size={16} color={colors.brandSecondary} />
          <Text style={styles.reportBtnText}>Relatório</Text>
        </Pressable>
      </View>

      {showReport && (
        <View style={styles.reportCard} testID="weekly-report-card">
          <View style={styles.reportHead}>
            <Text style={styles.reportKicker}>AFTER ACTION REPORT · 7 DIAS</Text>
            <Pressable testID="dismiss-report" onPress={() => setShowReport(false)} hitSlop={8}>
              <Ionicons name="close" size={18} color={colors.onSurfaceSecondary} />
            </Pressable>
          </View>
          {loadingReport ? (
            <ActivityIndicator color={colors.brandPrimary} style={{ marginVertical: spacing.lg }} />
          ) : (
            <Text style={styles.reportText}>{report}</Text>
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
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.lg }}
          onContentSizeChange={scrollEnd}
          showsVerticalScrollIndicator={false}
          ListFooterComponent={sending ? (
            <View style={[styles.msgRow, styles.rowLeft]}>
              <Image source={{ uri: AVATAR }} style={styles.msgAvatar} contentFit="cover" />
              <View style={[styles.bubble, styles.coachBubble]}>
                <Text style={styles.typing}>escrevendo...</Text>
              </View>
            </View>
          ) : null}
        />

        <View style={[styles.inputBar, { paddingBottom: insets.bottom + 64 + spacing.sm }]}>
          <TextInput
            testID="coach-input"
            style={styles.input}
            placeholder="Fale com o Comandante..."
            placeholderTextColor={colors.onSurfaceSecondary}
            value={input}
            onChangeText={setInput}
            multiline
            onSubmitEditing={send}
          />
          <Pressable testID="coach-send-button" style={styles.sendBtn} onPress={send} disabled={sending || !input.trim()}>
            <Ionicons name="arrow-up" size={22} color={colors.onBrandPrimary} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    paddingHorizontal: spacing.lg, paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider,
  },
  headerAvatar: { width: 44, height: 44, borderRadius: radius.pill, borderWidth: 2, borderColor: colors.brandPrimary },
  headerName: { fontFamily: fonts.display, fontSize: type.xl, color: colors.onSurface, letterSpacing: 1 },
  headerSub: { fontFamily: fonts.text, fontSize: type.sm, color: colors.onSurfaceSecondary },
  reportBtn: { flexDirection: "row", alignItems: "center", gap: spacing.xs, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, height: 36, borderRadius: radius.md },
  reportBtnText: { fontFamily: fonts.semibold, fontSize: type.sm, color: colors.brandSecondary },

  reportCard: { margin: spacing.lg, marginBottom: 0, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.lg, borderWidth: 1, borderColor: colors.brandPrimary },
  reportHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.sm },
  reportKicker: { fontFamily: fonts.bold, fontSize: type.sm, color: colors.brandSecondary, letterSpacing: 1 },
  reportText: { fontFamily: fonts.text, fontSize: type.base, color: colors.onSurface, lineHeight: 22 },

  msgRow: { flexDirection: "row", gap: spacing.sm, maxWidth: "100%" },
  rowLeft: { justifyContent: "flex-start" },
  rowRight: { justifyContent: "flex-end" },
  msgAvatar: { width: 32, height: 32, borderRadius: radius.pill, marginTop: 2 },
  bubble: { maxWidth: "80%", padding: spacing.md, borderRadius: radius.sm },
  coachBubble: { backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, borderLeftWidth: 3, borderLeftColor: colors.brandPrimary },
  userBubble: { backgroundColor: colors.brandPrimary },
  coachName: { fontFamily: fonts.bold, fontSize: 10, color: colors.brandSecondary, letterSpacing: 1, marginBottom: 4 },
  msgText: { fontFamily: fonts.text, fontSize: type.base, color: colors.onSurface, lineHeight: 22 },
  userText: { color: colors.onBrandPrimary },
  typing: { fontFamily: fonts.mono, fontSize: type.sm, color: colors.onSurfaceSecondary },

  inputBar: {
    flexDirection: "row", alignItems: "flex-end", gap: spacing.sm,
    paddingHorizontal: spacing.lg, paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider,
    backgroundColor: colors.surface,
  },
  input: {
    flex: 1, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border, color: colors.onSurface,
    fontFamily: fonts.text, fontSize: type.lg, paddingHorizontal: spacing.lg,
    paddingTop: spacing.md, paddingBottom: spacing.md, maxHeight: 120, minHeight: 48,
  },
  sendBtn: { width: 48, height: 48, borderRadius: radius.md, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
});
