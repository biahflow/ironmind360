import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

import { spacing, radius, fonts, type } from "@/src/theme";
import { useTheme } from "@/src/context/ThemeContext";
import { api } from "@/src/lib/api";
import { Screen, ScreenHeader, Input, PrimaryButton, Overline } from "@/src/components/ui";

const ICON_CHOICES = [
  "ellipse-outline", "body-outline", "barbell-outline", "water-outline",
  "walk-outline", "bicycle-outline", "moon-outline", "sunny-outline",
  "heart-outline", "flame-outline", "leaf-outline", "book-outline",
];

const BUILTINS = [
  { name: "Meditar", icon: "leaf-outline" },
  { name: "Ler", icon: "book-outline" },
  { name: "Banho gelado", icon: "snow-outline" },
];

export default function ManageHabits() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [habits, setHabits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState(ICON_CHOICES[0]);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get("/custom-habits");
      setHabits(res.habits || []);
    } catch {} finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const add = async () => {
    if (!name.trim()) return;
    setSaving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await api.post("/custom-habits", { name: name.trim(), icon, kind: "boolean" });
      setName("");
      setIcon(ICON_CHOICES[0]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await load();
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await api.del(`/custom-habits/${id}`);
      await load();
    } catch {}
  };

  return (
    <Screen>
      <ScreenHeader title="Meus hábitos" onBack={() => router.back()} />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingBottom: insets.bottom + spacing["3xl"] }}
        showsVerticalScrollIndicator={false}
      >
        <Overline color={colors.textSecondary} style={{ marginTop: spacing.md }}>Fixos</Overline>
        <View style={[s.list, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {BUILTINS.map((b, i) => (
            <View key={b.name} style={[s.row, i > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}>
              <View style={[s.icon, { backgroundColor: colors.elevated }]}>
                <Ionicons name={b.icon as any} size={18} color={colors.textSecondary} />
              </View>
              <Text style={[s.name, { color: colors.text }]}>{b.name}</Text>
              <Text style={[s.fixedTag, { color: colors.textSecondary }]}>fixo</Text>
            </View>
          ))}
        </View>

        <Overline color={colors.textSecondary} style={{ marginTop: spacing.xl }}>Seus hábitos</Overline>
        {loading ? (
          <ActivityIndicator color={colors.accent} style={{ marginTop: spacing.xl }} />
        ) : habits.length === 0 ? (
          <Text style={[s.empty, { color: colors.textSecondary }]}>
            Você ainda não criou hábitos. Adicione abaixo.
          </Text>
        ) : (
          <View style={[s.list, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {habits.map((h, i) => (
              <View key={h.id} style={[s.row, i > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}>
                <View style={[s.icon, { backgroundColor: colors.elevated }]}>
                  <Ionicons name={(h.icon || "ellipse-outline") as any} size={18} color={colors.textSecondary} />
                </View>
                <Text style={[s.name, { color: colors.text }]} numberOfLines={1}>{h.name}</Text>
                <Pressable onPress={() => remove(h.id)} hitSlop={10} style={s.delBtn}>
                  <Ionicons name="trash-outline" size={18} color={colors.error} />
                </Pressable>
              </View>
            ))}
          </View>
        )}

        <Overline color={colors.textSecondary} style={{ marginTop: spacing.xl }}>Novo hábito</Overline>
        <Input
          placeholder="Nome do hábito (ex.: Alongar)"
          value={name}
          onChangeText={setName}
          maxLength={80}
          containerStyle={{ marginTop: spacing.md }}
        />
        <View style={s.iconGrid}>
          {ICON_CHOICES.map((ic) => {
            const active = ic === icon;
            return (
              <Pressable
                key={ic}
                onPress={() => setIcon(ic)}
                style={[
                  s.iconChoice,
                  {
                    backgroundColor: active ? colors.accent : colors.surface,
                    borderColor: active ? colors.accent : colors.border,
                  },
                ]}
              >
                <Ionicons name={ic as any} size={20} color={active ? colors.onAccent : colors.textSecondary} />
              </Pressable>
            );
          })}
        </View>
        <PrimaryButton
          label="Adicionar hábito"
          icon="add-circle-outline"
          onPress={add}
          loading={saving}
          style={{ marginTop: spacing.lg }}
        />
      </ScrollView>
    </Screen>
  );
}

const s = StyleSheet.create({
  list: { borderRadius: radius.card, borderWidth: 1, paddingHorizontal: spacing.lg, marginTop: spacing.md },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: spacing.md },
  icon: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  name: { flex: 1, marginLeft: spacing.md, fontFamily: fonts.semibold, ...type.bodySmall },
  fixedTag: { fontFamily: fonts.medium, ...type.caption },
  delBtn: { padding: spacing.xs },
  empty: { fontFamily: fonts.text, ...type.bodySmall, marginTop: spacing.md },
  iconGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.md },
  iconChoice: {
    width: 48, height: 48, borderRadius: 14, borderWidth: 1,
    alignItems: "center", justifyContent: "center",
  },
});
