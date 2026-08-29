import React, { useCallback, useState } from "react";
import {
  View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator, RefreshControl,
} from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { colors, spacing, radius, fonts, type } from "@/src/theme";
import { api } from "@/src/lib/api";

const WORKOUT_HERO = "https://images.unsplash.com/photo-1632077804406-188472f1a810?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2NzR8MHwxfHNlYXJjaHwyfHxkYXJrJTIwZ3ltJTIwa2V0dGxlYmVsbCUyMGludGVuc2UlMjBsaWZ0aW5nfGVufDB8fHx8MTc4ODAyNzc2N3ww&ixlib=rb-4.1.0&q=85";

const TYPE_ICON: Record<string, any> = {
  Ride: "bicycle", VirtualRide: "bicycle", Run: "walk", Swim: "water",
  Workout: "barbell", WeightTraining: "barbell", Walk: "footsteps",
};

function fmtDuration(s: number) {
  if (!s) return "—";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h${m.toString().padStart(2, "0")}` : `${m}min`;
}
function fmtDate(iso: string) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

export default function Workouts() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [connected, setConnected] = useState(true);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const tabBarPad = 64 + insets.bottom + spacing.lg;

  const load = useCallback(async () => {
    try {
      const d = await api.get("/workouts");
      setItems(d.workouts || []);
      setConnected(d.connected);
    } catch {}
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const sync = async () => {
    if (!connected) {
      router.push("/settings");
      return;
    }
    setSyncing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await api.post("/intervals/sync");
      await load();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setSyncing(false);
    }
  };

  const renderItem = ({ item }: any) => (
    <View style={styles.card} testID={`workout-${item.id}`}>
      <View style={styles.cardIcon}>
        <Ionicons name={TYPE_ICON[item.type] || "fitness"} size={22} color={colors.brandPrimary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.cardTitle} numberOfLines={1}>{item.name || item.type || "Treino"}</Text>
        <Text style={styles.cardDate}>{fmtDate(item.start_date_local)} · {item.type}</Text>
        <View style={styles.metricsRow}>
          <Metric value={item.distance ? `${(item.distance / 1000).toFixed(1)}km` : "—"} label="DIST" />
          <Metric value={fmtDuration(item.moving_time)} label="TEMPO" />
          <Metric value={item.icu_training_load ? Math.round(item.icu_training_load) : "—"} label="CARGA" />
          <Metric value={item.average_heartrate ? Math.round(item.average_heartrate) : "—"} label="FC" />
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <View>
          <Text style={styles.kicker}>REGISTRO DE MISSÕES</Text>
          <Text style={styles.title}>TREINOS</Text>
        </View>
        <Pressable testID="sync-button" onPress={sync} style={styles.syncBtn} disabled={syncing}>
          {syncing ? <ActivityIndicator color={colors.onBrandPrimary} size="small" /> : (
            <>
              <Ionicons name="sync" size={16} color={colors.onBrandPrimary} />
              <Text style={styles.syncText}>Sincronizar</Text>
            </>
          )}
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.brandPrimary} /></View>
      ) : items.length === 0 ? (
        <View style={styles.empty}>
          <Image source={{ uri: WORKOUT_HERO }} style={styles.emptyImg} contentFit="cover" />
          <Text style={styles.emptyTitle}>NENHUMA MISSÃO REGISTRADA</Text>
          <Text style={styles.emptyText}>
            {connected
              ? "Sincronize com o intervals.icu para importar seus treinos."
              : "Conecte sua conta do intervals.icu nas configurações para importar seus treinos automaticamente."}
          </Text>
          <Pressable testID="empty-action-button" style={styles.emptyBtn} onPress={sync}>
            <Text style={styles.emptyBtnText}>{connected ? "SINCRONIZAR AGORA" : "CONECTAR INTERVALS.ICU"}</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: tabBarPad }}
          ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={colors.brandPrimary} />}
        />
      )}
    </View>
  );
}

function Metric({ value, label }: { value: any; label: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end",
    paddingHorizontal: spacing.lg, paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider,
  },
  kicker: { fontFamily: fonts.medium, fontSize: type.sm, color: colors.brandSecondary, letterSpacing: 2 },
  title: { fontFamily: fonts.display, fontSize: type["3xl"], color: colors.onSurface, letterSpacing: 1 },
  syncBtn: { flexDirection: "row", alignItems: "center", gap: spacing.xs, backgroundColor: colors.brandPrimary, paddingHorizontal: spacing.md, height: 40, borderRadius: radius.md, minWidth: 110, justifyContent: "center" },
  syncText: { fontFamily: fonts.bold, fontSize: type.base, color: colors.onBrandPrimary },

  card: { flexDirection: "row", gap: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  cardIcon: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  cardTitle: { fontFamily: fonts.semibold, fontSize: type.lg, color: colors.onSurface },
  cardDate: { fontFamily: fonts.mono, fontSize: type.sm, color: colors.onSurfaceSecondary, marginTop: 2 },
  metricsRow: { flexDirection: "row", gap: spacing.xl, marginTop: spacing.md },
  metric: {},
  metricValue: { fontFamily: fonts.display, fontSize: type.xl, color: colors.onSurface, fontVariant: ["tabular-nums"] },
  metricLabel: { fontFamily: fonts.medium, fontSize: 9, color: colors.onSurfaceSecondary, letterSpacing: 1 },

  empty: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.xl },
  emptyImg: { width: 120, height: 120, borderRadius: radius.lg, marginBottom: spacing.xl, opacity: 0.6 },
  emptyTitle: { fontFamily: fonts.display, fontSize: type["2xl"], color: colors.onSurface, letterSpacing: 1, textAlign: "center" },
  emptyText: { fontFamily: fonts.text, fontSize: type.base, color: colors.onSurfaceSecondary, textAlign: "center", marginTop: spacing.sm, lineHeight: 22 },
  emptyBtn: { backgroundColor: colors.brandPrimary, paddingHorizontal: spacing.xl, height: 52, borderRadius: radius.md, alignItems: "center", justifyContent: "center", marginTop: spacing.xl },
  emptyBtnText: { fontFamily: fonts.bold, fontSize: type.base, color: colors.onBrandPrimary, letterSpacing: 1 },
});
