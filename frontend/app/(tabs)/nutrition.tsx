import React, { useCallback, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Modal, Linking, RefreshControl,
} from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";

import { colors, spacing, radius, fonts, type } from "@/src/theme";
import { api, fileUrl } from "@/src/lib/api";

export default function Nutrition() {
  const insets = useSafeAreaInsets();
  const [meals, setMeals] = useState<any[]>([]);
  const [totals, setTotals] = useState<any>({ calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 });
  const [goals, setGoals] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [picker, setPicker] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [permMsg, setPermMsg] = useState("");
  const tabBarPad = 64 + insets.bottom + 90;

  const load = useCallback(async () => {
    try {
      const d = await api.get("/nutrition");
      setMeals(d.meals || []);
      setTotals(d.totals || {});
      setGoals(d.goals || {});
    } catch {}
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleImage = async (uri: string) => {
    setPicker(false);
    setAnalyzing(true);
    try {
      await api.uploadPhoto("/nutrition/analyze", uri, "meal");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await load();
    } catch (e: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setPermMsg(e.message || "Falha ao analisar a foto");
    } finally {
      setAnalyzing(false);
    }
  };

  const openCamera = async () => {
    setPermMsg("");
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      if (!perm.canAskAgain) {
        setPermMsg("Acesso à câmera bloqueado. Abra as configurações para liberar.");
      } else {
        setPermMsg("Precisamos da câmera para fotografar seu prato.");
      }
      return;
    }
    const res = await ImagePicker.launchCameraAsync({ quality: 0.6, mediaTypes: ["images"] });
    if (!res.canceled && res.assets?.[0]) handleImage(res.assets[0].uri);
  };

  const openGallery = async () => {
    setPermMsg("");
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      if (!perm.canAskAgain) {
        setPermMsg("Acesso à galeria bloqueado. Abra as configurações para liberar.");
      } else {
        setPermMsg("Precisamos da galeria para escolher a foto.");
      }
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({ quality: 0.6, mediaTypes: ["images"] });
    if (!res.canceled && res.assets?.[0]) handleImage(res.assets[0].uri);
  };

  const removeMeal = async (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setMeals((m) => m.filter((x) => x.id !== id));
    try { await api.del(`/nutrition/${id}`); await load(); } catch {}
  };

  const calPct = Math.min(1, (totals.calories || 0) / Math.max(goals.calories || 1, 1));

  return (
    <View style={styles.root}>
      {/* Sticky macro header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Text style={styles.kicker}>COMBUSTÍVEL DE HOJE</Text>
        <View style={styles.macroTop}>
          <Text style={styles.calNum} testID="calories-total">{Math.round(totals.calories || 0)}</Text>
          <Text style={styles.calUnit}>/ {goals.calories || 0} kcal</Text>
        </View>
        <View style={styles.calTrack}>
          <View style={[styles.calFill, { width: `${calPct * 100}%` }]} />
        </View>
        <View style={styles.macroRow}>
          <Macro label="PROT" value={`${Math.round(totals.protein_g || 0)}g`} />
          <Macro label="CARB" value={`${Math.round(totals.carbs_g || 0)}g`} />
          <Macro label="GORD" value={`${Math.round(totals.fat_g || 0)}g`} />
        </View>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.brandPrimary} /></View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: tabBarPad }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={colors.brandPrimary} />}
        >
          {permMsg ? (
            <View style={styles.permBox}>
              <Text style={styles.permText}>{permMsg}</Text>
              {permMsg.includes("bloqueado") && (
                <Pressable testID="open-settings-button" onPress={() => Linking.openSettings()} style={styles.permBtn}>
                  <Text style={styles.permBtnText}>Abrir Configurações</Text>
                </Pressable>
              )}
            </View>
          ) : null}

          {meals.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="restaurant-outline" size={48} color={colors.onSurfaceSecondary} />
              <Text style={styles.emptyTitle}>TANQUE VAZIO</Text>
              <Text style={styles.emptyText}>Fotografe seu prato. A IA estima calorias e macros na hora.</Text>
            </View>
          ) : (
            meals.map((m) => (
              <View key={m.id} style={styles.meal} testID={`meal-${m.id}`}>
                <Image source={{ uri: fileUrl(m.photo_url) }} style={styles.mealImg} contentFit="cover" />
                <View style={{ flex: 1 }}>
                  <View style={styles.mealHead}>
                    <Text style={styles.mealTitle} numberOfLines={1}>{m.title}</Text>
                    <Pressable testID={`delete-meal-${m.id}`} onPress={() => removeMeal(m.id)} hitSlop={8}>
                      <Ionicons name="trash-outline" size={16} color={colors.onSurfaceSecondary} />
                    </Pressable>
                  </View>
                  <Text style={styles.mealCal}>{Math.round(m.calories)} kcal</Text>
                  <Text style={styles.mealMacros}>P {Math.round(m.protein_g)}g · C {Math.round(m.carbs_g)}g · G {Math.round(m.fat_g)}g</Text>
                  {m.coach_note ? <Text style={styles.mealNote}>“{m.coach_note}”</Text> : null}
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}

      {/* FAB */}
      <Pressable
        testID="camera-log-fab"
        style={[styles.fab, { bottom: insets.bottom + 64 + spacing.lg }]}
        onPress={() => setPicker(true)}
        disabled={analyzing}
      >
        {analyzing ? <ActivityIndicator color={colors.onBrandPrimary} /> : <Ionicons name="camera" size={26} color={colors.onBrandPrimary} />}
      </Pressable>

      {/* Picker modal */}
      <Modal visible={picker} transparent animationType="slide" onRequestClose={() => setPicker(false)}>
        <Pressable style={styles.backdrop} onPress={() => setPicker(false)}>
          <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>REGISTRAR REFEIÇÃO</Text>
            <Pressable testID="take-photo-button" style={styles.sheetBtn} onPress={openCamera}>
              <Ionicons name="camera" size={22} color={colors.onSurface} />
              <Text style={styles.sheetBtnText}>Tirar foto do prato</Text>
            </Pressable>
            <Pressable testID="pick-photo-button" style={styles.sheetBtn} onPress={openGallery}>
              <Ionicons name="images" size={22} color={colors.onSurface} />
              <Text style={styles.sheetBtnText}>Escolher da galeria</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* Analyzing overlay */}
      {analyzing && (
        <View style={styles.analyzeOverlay} testID="analyzing-overlay">
          <ActivityIndicator color={colors.brandPrimary} size="large" />
          <Text style={styles.analyzeText}>ANALISANDO SEU PRATO...</Text>
        </View>
      )}
    </View>
  );
}

function Macro({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.macro}>
      <Text style={styles.macroValue}>{value}</Text>
      <Text style={styles.macroLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: {
    paddingHorizontal: spacing.lg, paddingBottom: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider,
    backgroundColor: colors.surfaceSecondary,
  },
  kicker: { fontFamily: fonts.medium, fontSize: type.sm, color: colors.brandSecondary, letterSpacing: 2 },
  macroTop: { flexDirection: "row", alignItems: "flex-end", gap: spacing.sm, marginTop: spacing.xs },
  calNum: { fontFamily: fonts.display, fontSize: type["5xl"], color: colors.onSurface, lineHeight: type["5xl"], fontVariant: ["tabular-nums"] },
  calUnit: { fontFamily: fonts.medium, fontSize: type.base, color: colors.onSurfaceSecondary, marginBottom: spacing.md },
  calTrack: { height: 8, borderRadius: radius.pill, backgroundColor: colors.surfaceTertiary, overflow: "hidden", marginTop: spacing.sm },
  calFill: { height: 8, borderRadius: radius.pill, backgroundColor: colors.brandPrimary },
  macroRow: { flexDirection: "row", gap: spacing.xl, marginTop: spacing.md },
  macro: {},
  macroValue: { fontFamily: fonts.display, fontSize: type.xl, color: colors.onSurface },
  macroLabel: { fontFamily: fonts.medium, fontSize: 9, color: colors.onSurfaceSecondary, letterSpacing: 1 },

  empty: { alignItems: "center", paddingTop: 60, gap: spacing.sm },
  emptyTitle: { fontFamily: fonts.display, fontSize: type["2xl"], color: colors.onSurface, letterSpacing: 1, marginTop: spacing.sm },
  emptyText: { fontFamily: fonts.text, fontSize: type.base, color: colors.onSurfaceSecondary, textAlign: "center", paddingHorizontal: spacing.xl, lineHeight: 22 },

  meal: { flexDirection: "row", gap: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md },
  mealImg: { width: 72, height: 72, borderRadius: radius.sm, backgroundColor: colors.surfaceTertiary },
  mealHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  mealTitle: { fontFamily: fonts.semibold, fontSize: type.lg, color: colors.onSurface, flex: 1, marginRight: spacing.sm },
  mealCal: { fontFamily: fonts.display, fontSize: type.xl, color: colors.brandSecondary, marginTop: 2 },
  mealMacros: { fontFamily: fonts.mono, fontSize: type.sm, color: colors.onSurfaceSecondary, marginTop: 2 },
  mealNote: { fontFamily: fonts.text, fontSize: type.sm, color: colors.onSurfaceTertiary, fontStyle: "italic", marginTop: spacing.xs },

  fab: {
    position: "absolute", right: spacing.lg, width: 60, height: 60, borderRadius: radius.pill,
    backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center",
    shadowColor: colors.brandPrimary, shadowOpacity: 0.5, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 8,
  },

  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  sheet: { backgroundColor: colors.surfaceSecondary, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.lg, gap: spacing.md, borderTopWidth: 1, borderColor: colors.border },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong, alignSelf: "center", marginBottom: spacing.sm },
  sheetTitle: { fontFamily: fonts.bold, fontSize: type.sm, color: colors.onSurfaceSecondary, letterSpacing: 2, marginBottom: spacing.xs },
  sheetBtn: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surfaceTertiary, padding: spacing.lg, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  sheetBtnText: { fontFamily: fonts.semibold, fontSize: type.lg, color: colors.onSurface },

  permBox: { backgroundColor: colors.brandTertiary, borderRadius: radius.md, padding: spacing.lg, marginBottom: spacing.lg, borderWidth: 1, borderColor: colors.brandPrimary },
  permText: { fontFamily: fonts.medium, fontSize: type.base, color: colors.onSurface },
  permBtn: { marginTop: spacing.md, backgroundColor: colors.brandPrimary, height: 44, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  permBtnText: { fontFamily: fonts.bold, fontSize: type.base, color: colors.onBrandPrimary },

  analyzeOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(7,7,9,0.85)", alignItems: "center", justifyContent: "center", gap: spacing.lg },
  analyzeText: { fontFamily: fonts.bold, fontSize: type.lg, color: colors.onSurface, letterSpacing: 2 },
});
