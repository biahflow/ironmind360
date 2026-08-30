import React, { useCallback, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator,
  Modal, Linking, RefreshControl, TextInput,
} from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";

import { spacing, radius, fonts, type, shadow } from "@/src/theme";
import { useTheme } from "@/src/context/ThemeContext";
import { api, authHeaders, fileUrl } from "@/src/lib/api";
import DonutChart from "@/src/components/DonutChart";

const MACRO_COLORS = { protein: "#4ECDC4", carbs: "#FFD93D", fat: "#FF6B6B" };

type SubTab = "today" | "week" | "favorites" | "recipes";

const MEAL_TYPES = [
  { value: "breakfast", label: "Café da manhã" },
  { value: "morning_snack", label: "Lanche da manhã" },
  { value: "lunch", label: "Almoço" },
  { value: "afternoon_snack", label: "Lanche da tarde" },
  { value: "dinner", label: "Jantar" },
  { value: "supper", label: "Ceia" },
  { value: "pre_workout", label: "Pré-treino" },
  { value: "post_workout", label: "Pós-treino" },
  { value: "meal", label: "Refeição" },
];

function mealTypeLabel(v: string) {
  return MEAL_TYPES.find((t) => t.value === v)?.label || "Refeição";
}

interface MealItem {
  name: string;
  quantity: number;
  unit: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  sodium_mg: number;
  sugar_g: number;
}

function emptyItem(): MealItem {
  return { name: "", quantity: 0, unit: "g", calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0, sodium_mg: 0, sugar_g: 0 };
}

function sumItems(items: MealItem[]) {
  const keys: (keyof MealItem)[] = ["calories", "protein_g", "carbs_g", "fat_g", "fiber_g", "sodium_mg", "sugar_g"];
  const totals: Record<string, number> = {};
  for (const k of keys) totals[k as string] = items.reduce((s, i) => s + (Number(i[k]) || 0), 0);
  return totals;
}

export default function Nutrition() {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<SubTab>("today");
  const [meals, setMeals] = useState<any[]>([]);
  const [totals, setTotals] = useState<any>({});
  const [goals, setGoals] = useState<any>({});
  const [weekly, setWeekly] = useState<any[]>([]);
  const [favorites, setFavorites] = useState<any[]>([]);
  const [recipes, setRecipes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [picker, setPicker] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [permMsg, setPermMsg] = useState("");
  const [imageHeaders, setImageHeaders] = useState<Record<string, string>>({});
  const [manualModal, setManualModal] = useState(false);
  const [editModal, setEditModal] = useState<any>(null);
  const [favModal, setFavModal] = useState(false);
  const [recipeModal, setRecipeModal] = useState(false);
  const tabBarPad = 64 + insets.bottom + 90;

  const loadToday = useCallback(async () => {
    try {
      const d = await api.get("/nutrition");
      setMeals(d.meals || []);
      setTotals(d.totals || {});
      setGoals(d.goals || {});
      setImageHeaders(await authHeaders());
    } catch {}
    setLoading(false);
  }, []);

  const loadWeekly = useCallback(async () => {
    try {
      const d = await api.get("/nutrition/weekly");
      setWeekly(d.days || []);
    } catch {}
  }, []);

  const loadFavorites = useCallback(async () => {
    try {
      const d = await api.get("/nutrition/favorites");
      setFavorites(d.favorites || []);
    } catch {}
  }, []);

  const loadRecipes = useCallback(async () => {
    try {
      const d = await api.get("/nutrition/recipes");
      setRecipes(d.recipes || []);
    } catch {}
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([loadToday(), loadWeekly(), loadFavorites(), loadRecipes()]);
    setLoading(false);
  }, [loadToday, loadWeekly, loadFavorites, loadRecipes]);

  useFocusEffect(useCallback(() => { loadAll(); }, [loadAll]));

  const handleImage = async (uri: string) => {
    setPicker(false);
    setAnalyzing(true);
    try {
      const result = await api.uploadPhoto("/nutrition/analyze", uri, "meal");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (result.ai_failed) {
        setEditModal(result);
      }
      await loadAll();
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
      setPermMsg(perm.canAskAgain ? "Precisamos da câmera para fotografar seu prato." : "Acesso à câmera bloqueado. Abra as configurações para liberar.");
      return;
    }
    const res = await ImagePicker.launchCameraAsync({ quality: 0.6, mediaTypes: ["images"] });
    if (!res.canceled && res.assets?.[0]) handleImage(res.assets[0].uri);
  };

  const openGallery = async () => {
    setPermMsg("");
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setPermMsg(perm.canAskAgain ? "Precisamos da galeria para escolher a foto." : "Acesso à galeria bloqueado. Abra as configurações para liberar.");
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({ quality: 0.6, mediaTypes: ["images"] });
    if (!res.canceled && res.assets?.[0]) handleImage(res.assets[0].uri);
  };

  const removeMeal = async (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setMeals((m) => m.filter((x) => x.id !== id));
    try { await api.del(`/nutrition/${id}`); await loadAll(); } catch {}
  };

  const applyFavorite = async (id: string) => {
    try {
      await api.post(`/nutrition/favorites/${id}/use`);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTab("today");
      await loadAll();
    } catch {}
  };

  const deleteFavorite = async (id: string) => {
    try {
      await api.del(`/nutrition/favorites/${id}`);
      await loadFavorites();
    } catch {}
  };

  const applyRecipe = async (id: string) => {
    try {
      await api.post(`/nutrition/recipes/${id}/use?servings=1`);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTab("today");
      await loadAll();
    } catch {}
  };

  const deleteRecipe = async (id: string) => {
    try {
      await api.del(`/nutrition/recipes/${id}`);
      await loadRecipes();
    } catch {}
  };

  const protG = Math.round(totals.protein_g || 0);
  const carbG = Math.round(totals.carbs_g || 0);
  const fatG = Math.round(totals.fat_g || 0);
  const totalMacroG = protG + carbG + fatG || 1;
  const segments = [
    { value: protG, color: MACRO_COLORS.protein, label: "Proteína" },
    { value: carbG, color: MACRO_COLORS.carbs, label: "Carboidrato" },
    { value: fatG, color: MACRO_COLORS.fat, label: "Gordura" },
  ];

  const SUB_TABS: { key: SubTab; label: string; icon: string }[] = [
    { key: "today", label: "Hoje", icon: "today-outline" },
    { key: "week", label: "Semana", icon: "calendar-outline" },
    { key: "favorites", label: "Favoritos", icon: "heart-outline" },
    { key: "recipes", label: "Receitas", icon: "book-outline" },
  ];

  return (
    <View style={[s.root, { backgroundColor: colors.surface }]}>
      <View style={[s.header, { paddingTop: insets.top + spacing.md, backgroundColor: colors.surface, borderBottomColor: colors.divider }]}>
        <Text style={[s.title, { color: colors.onSurface }]}>Nutrição</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tabRow}>
          {SUB_TABS.map((t) => (
            <Pressable
              key={t.key}
              onPress={() => setTab(t.key)}
              style={[s.subTab, tab === t.key && { backgroundColor: colors.brandTertiary }]}
            >
              <Ionicons name={t.icon as any} size={16} color={tab === t.key ? colors.brandPrimary : colors.onSurfaceSecondary} />
              <Text style={[s.subTabText, { color: tab === t.key ? colors.brandPrimary : colors.onSurfaceSecondary }]}>{t.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator color={colors.brandPrimary} /></View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: tabBarPad }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={false} onRefresh={loadAll} tintColor={colors.brandPrimary} />}
        >
          {tab === "today" && <TodayView {...{ meals, totals, goals, segments, protG, carbG, fatG, totalMacroG, colors, isDark, imageHeaders, permMsg, removeMeal, setEditModal }} />}
          {tab === "week" && <WeekView days={weekly} goals={goals} colors={colors} isDark={isDark} />}
          {tab === "favorites" && <FavoritesView favorites={favorites} colors={colors} isDark={isDark} applyFavorite={applyFavorite} deleteFavorite={deleteFavorite} setFavModal={setFavModal} />}
          {tab === "recipes" && <RecipesView recipes={recipes} colors={colors} isDark={isDark} applyRecipe={applyRecipe} deleteRecipe={deleteRecipe} setRecipeModal={setRecipeModal} />}
        </ScrollView>
      )}

      {tab === "today" && (
        <Pressable
          testID="camera-log-fab"
          style={[s.fab, { bottom: insets.bottom + 64 + spacing.lg, backgroundColor: colors.brandPrimary, ...shadow.glow(colors.brandPrimary) }]}
          onPress={() => setPicker(true)}
          disabled={analyzing}
        >
          {analyzing ? <ActivityIndicator color={colors.onBrandPrimary} /> : <Ionicons name="add" size={28} color={colors.onBrandPrimary} />}
        </Pressable>
      )}

      {/* Add meal picker */}
      <Modal visible={picker} transparent animationType="slide" onRequestClose={() => setPicker(false)}>
        <Pressable style={s.backdrop} onPress={() => setPicker(false)}>
          <View style={[s.sheet, { paddingBottom: insets.bottom + spacing.lg, backgroundColor: colors.surfaceElevated, ...shadow.lg }]}>
            <View style={[s.sheetHandle, { backgroundColor: colors.borderStrong }]} />
            <Text style={[s.sheetTitle, { color: colors.onSurfaceSecondary }]}>REGISTRAR REFEIÇÃO</Text>
            <Pressable testID="take-photo-button" style={[s.sheetBtn, { backgroundColor: colors.surfaceTertiary }]} onPress={openCamera}>
              <Ionicons name="camera" size={22} color={colors.onSurface} />
              <Text style={[s.sheetBtnText, { color: colors.onSurface }]}>Tirar foto do prato</Text>
            </Pressable>
            <Pressable testID="pick-photo-button" style={[s.sheetBtn, { backgroundColor: colors.surfaceTertiary }]} onPress={openGallery}>
              <Ionicons name="images" size={22} color={colors.onSurface} />
              <Text style={[s.sheetBtnText, { color: colors.onSurface }]}>Escolher da galeria</Text>
            </Pressable>
            <Pressable testID="manual-entry-button" style={[s.sheetBtn, { backgroundColor: colors.surfaceTertiary }]} onPress={() => { setPicker(false); setManualModal(true); }}>
              <Ionicons name="create-outline" size={22} color={colors.onSurface} />
              <Text style={[s.sheetBtnText, { color: colors.onSurface }]}>Entrada manual</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* Manual entry modal */}
      <ManualEntryModal
        visible={manualModal}
        onClose={() => setManualModal(false)}
        onSave={async (data: any) => {
          await api.post("/nutrition/manual", data);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setManualModal(false);
          await loadAll();
        }}
        colors={colors}
        isDark={isDark}
        insets={insets}
      />

      {/* Edit meal modal */}
      {editModal && (
        <EditMealModal
          meal={editModal}
          onClose={() => setEditModal(null)}
          onSave={async (data: any) => {
            await api.put(`/nutrition/${editModal.id}`, data);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setEditModal(null);
            await loadAll();
          }}
          colors={colors}
          isDark={isDark}
          insets={insets}
        />
      )}

      {/* Favorite modal */}
      <FavoriteModal
        visible={favModal}
        onClose={() => setFavModal(false)}
        onSave={async (data: any) => {
          await api.post("/nutrition/favorites", data);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setFavModal(false);
          await loadFavorites();
        }}
        colors={colors}
        isDark={isDark}
        insets={insets}
      />

      {/* Recipe modal */}
      <RecipeModal
        visible={recipeModal}
        onClose={() => setRecipeModal(false)}
        onSave={async (data: any) => {
          await api.post("/nutrition/recipes", data);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setRecipeModal(false);
          await loadRecipes();
        }}
        colors={colors}
        isDark={isDark}
        insets={insets}
      />

      {analyzing && (
        <View style={[s.analyzeOverlay, { backgroundColor: colors.overlay }]} testID="analyzing-overlay">
          <ActivityIndicator color={colors.brandPrimary} size="large" />
          <Text style={[s.analyzeText, { color: colors.onSurface }]}>Analisando seu prato...</Text>
        </View>
      )}
    </View>
  );
}

// ─── Today View ────────────────────────────────────────────────

function TodayView({ meals, totals, goals, segments, protG, carbG, fatG, totalMacroG, colors, isDark, imageHeaders, permMsg, removeMeal, setEditModal }: any) {
  return (
    <>
      <View style={[s.donutSection, { backgroundColor: colors.cardBackground, ...(isDark ? {} : shadow.md) }]}>
        <DonutChart size={180} strokeWidth={16} segments={segments} centerValue={`${Math.round(totals.calories || 0)}`} centerLabel="kcal" />
        <View style={s.macroLegend}>
          <MacroChip label="Proteína" value={`${protG}g`} pct={Math.round((protG / totalMacroG) * 100)} color={MACRO_COLORS.protein} textColor={colors.onSurface} subColor={colors.onSurfaceSecondary} />
          <MacroChip label="Carbo" value={`${carbG}g`} pct={Math.round((carbG / totalMacroG) * 100)} color={MACRO_COLORS.carbs} textColor={colors.onSurface} subColor={colors.onSurfaceSecondary} />
          <MacroChip label="Gordura" value={`${fatG}g`} pct={Math.round((fatG / totalMacroG) * 100)} color={MACRO_COLORS.fat} textColor={colors.onSurface} subColor={colors.onSurfaceSecondary} />
        </View>
        {(totals.fiber_g > 0 || totals.sodium_mg > 0) && (
          <View style={[s.microRow, { borderTopColor: colors.divider }]}>
            {totals.fiber_g > 0 && <Text style={[s.microText, { color: colors.onSurfaceSecondary }]}>Fibra {Math.round(totals.fiber_g)}g</Text>}
            {totals.sugar_g > 0 && <Text style={[s.microText, { color: colors.onSurfaceSecondary }]}>Açúcar {Math.round(totals.sugar_g)}g</Text>}
            {totals.sodium_mg > 0 && <Text style={[s.microText, { color: colors.onSurfaceSecondary }]}>Sódio {Math.round(totals.sodium_mg)}mg</Text>}
          </View>
        )}
        {goals.calories && (
          <Text style={[s.goalText, { color: colors.onSurfaceSecondary }]}>Meta: {goals.calories} kcal · P {goals.protein}g</Text>
        )}
      </View>

      {permMsg ? (
        <View style={[s.permBox, { backgroundColor: colors.brandTertiary }]}>
          <Text style={[s.permText, { color: colors.onSurface }]}>{permMsg}</Text>
          {permMsg.includes("bloqueado") && (
            <Pressable testID="open-settings-button" onPress={() => Linking.openSettings()} style={[s.permBtn, { backgroundColor: colors.brandPrimary }]}>
              <Text style={[s.permBtnText, { color: colors.onBrandPrimary }]}>Abrir Configurações</Text>
            </Pressable>
          )}
        </View>
      ) : null}

      <Text style={[s.sectionTitle, { color: colors.onSurfaceSecondary }]}>Refeições</Text>
      {meals.length === 0 ? (
        <View style={s.empty}>
          <Ionicons name="restaurant-outline" size={48} color={colors.onSurfaceSecondary} />
          <Text style={[s.emptyTitle, { color: colors.onSurface }]}>Nenhuma refeição</Text>
          <Text style={[s.emptyText, { color: colors.onSurfaceSecondary }]}>Fotografe seu prato, adicione manualmente ou use um favorito.</Text>
        </View>
      ) : (
        meals.map((m: any) => (
          <Pressable key={m.id} onPress={() => setEditModal(m)} style={[s.meal, { backgroundColor: colors.cardBackground, ...(isDark ? {} : shadow.sm) }]} testID={`meal-${m.id}`}>
            {m.photo_url ? (
              <Image source={{ uri: fileUrl(m.photo_url), headers: imageHeaders }} style={[s.mealImg, { backgroundColor: colors.surfaceTertiary }]} contentFit="cover" />
            ) : (
              <View style={[s.mealImg, { backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center" }]}>
                <Ionicons name={m.source === "favorite" ? "heart" : m.source === "recipe" ? "book" : "create"} size={24} color={colors.onSurfaceSecondary} />
              </View>
            )}
            <View style={{ flex: 1 }}>
              <View style={s.mealHead}>
                <View style={{ flex: 1 }}>
                  <Text style={[s.mealTitle, { color: colors.onSurface }]} numberOfLines={1}>{m.title}</Text>
                  <Text style={[s.mealTypeLabel, { color: colors.onSurfaceTertiary }]}>{mealTypeLabel(m.meal_type)}</Text>
                </View>
                <Pressable testID={`delete-meal-${m.id}`} onPress={(e) => { e.stopPropagation?.(); removeMeal(m.id); }} hitSlop={8}>
                  <Ionicons name="trash-outline" size={16} color={colors.onSurfaceSecondary} />
                </Pressable>
              </View>
              <Text style={[s.mealCal, { color: colors.brandPrimary }]}>{Math.round(m.calories)} kcal</Text>
              <Text style={[s.mealMacros, { color: colors.onSurfaceSecondary }]}>P {Math.round(m.protein_g)}g · C {Math.round(m.carbs_g)}g · G {Math.round(m.fat_g)}g</Text>
              {m.ai_failed && <Text style={[s.aiFailed, { color: colors.warning }]}>IA indisponível — edite manualmente</Text>}
              {m.coach_note ? <Text style={[s.mealNote, { color: colors.onSurfaceTertiary }]}>&ldquo;{m.coach_note}&rdquo;</Text> : null}
            </View>
          </Pressable>
        ))
      )}
    </>
  );
}

// ─── Week View ─────────────────────────────────────────────────

function WeekView({ days, goals, colors, isDark }: any) {
  const maxCal = Math.max(...days.map((d: any) => d.calories || 0), goals.calories || 2000);
  return (
    <>
      <Text style={[s.sectionTitle, { color: colors.onSurfaceSecondary }]}>Últimos 7 dias</Text>
      {days.map((d: any) => {
        const pct = maxCal > 0 ? Math.min((d.calories / maxCal) * 100, 100) : 0;
        const dayLabel = new Date(d.date + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit" });
        return (
          <View key={d.date} style={[s.weekRow, { backgroundColor: colors.cardBackground, ...(isDark ? {} : shadow.sm) }]}>
            <Text style={[s.weekDay, { color: colors.onSurface }]}>{dayLabel}</Text>
            <View style={s.weekBarBg}>
              <View style={[s.weekBar, { width: `${pct}%`, backgroundColor: colors.brandPrimary }]} />
            </View>
            <View style={s.weekNums}>
              <Text style={[s.weekCal, { color: colors.onSurface }]}>{Math.round(d.calories)}</Text>
              <Text style={[s.weekMacro, { color: colors.onSurfaceSecondary }]}>P{Math.round(d.protein_g)} C{Math.round(d.carbs_g)} G{Math.round(d.fat_g)}</Text>
            </View>
            {d.meal_count > 0 && <Text style={[s.weekCount, { color: colors.onSurfaceTertiary }]}>{d.meal_count}×</Text>}
          </View>
        );
      })}
    </>
  );
}

// ─── Favorites View ────────────────────────────────────────────

function FavoritesView({ favorites, colors, isDark, applyFavorite, deleteFavorite, setFavModal }: any) {
  return (
    <>
      <View style={s.sectionHeader}>
        <Text style={[s.sectionTitle, { color: colors.onSurfaceSecondary }]}>Favoritos</Text>
        <Pressable onPress={() => setFavModal(true)} hitSlop={8}>
          <Ionicons name="add-circle-outline" size={24} color={colors.brandPrimary} />
        </Pressable>
      </View>
      {favorites.length === 0 ? (
        <View style={s.empty}>
          <Ionicons name="heart-outline" size={48} color={colors.onSurfaceSecondary} />
          <Text style={[s.emptyTitle, { color: colors.onSurface }]}>Sem favoritos</Text>
          <Text style={[s.emptyText, { color: colors.onSurfaceSecondary }]}>Salve refeições frequentes para registrar com um toque.</Text>
        </View>
      ) : (
        favorites.map((f: any) => {
          const t = sumItems(f.items);
          return (
            <View key={f.id} style={[s.favCard, { backgroundColor: colors.cardBackground, ...(isDark ? {} : shadow.sm) }]}>
              <View style={{ flex: 1 }}>
                <Text style={[s.favName, { color: colors.onSurface }]}>{f.name}</Text>
                <Text style={[s.favMacro, { color: colors.onSurfaceSecondary }]}>{Math.round(t.calories)} kcal · P{Math.round(t.protein_g)}g C{Math.round(t.carbs_g)}g G{Math.round(t.fat_g)}g</Text>
                <Text style={[s.favItems, { color: colors.onSurfaceTertiary }]}>{f.items.map((i: any) => i.name).join(", ")}</Text>
              </View>
              <View style={s.favActions}>
                <Pressable onPress={() => applyFavorite(f.id)} style={[s.favUseBtn, { backgroundColor: colors.brandPrimary }]}>
                  <Ionicons name="add" size={18} color={colors.onBrandPrimary} />
                </Pressable>
                <Pressable onPress={() => deleteFavorite(f.id)} hitSlop={8}>
                  <Ionicons name="trash-outline" size={16} color={colors.onSurfaceSecondary} />
                </Pressable>
              </View>
            </View>
          );
        })
      )}
    </>
  );
}

// ─── Recipes View ──────────────────────────────────────────────

function RecipesView({ recipes, colors, isDark, applyRecipe, deleteRecipe, setRecipeModal }: any) {
  return (
    <>
      <View style={s.sectionHeader}>
        <Text style={[s.sectionTitle, { color: colors.onSurfaceSecondary }]}>Receitas</Text>
        <Pressable onPress={() => setRecipeModal(true)} hitSlop={8}>
          <Ionicons name="add-circle-outline" size={24} color={colors.brandPrimary} />
        </Pressable>
      </View>
      {recipes.length === 0 ? (
        <View style={s.empty}>
          <Ionicons name="book-outline" size={48} color={colors.onSurfaceSecondary} />
          <Text style={[s.emptyTitle, { color: colors.onSurface }]}>Sem receitas</Text>
          <Text style={[s.emptyText, { color: colors.onSurfaceSecondary }]}>Crie receitas com ingredientes e porções para registrar facilmente.</Text>
        </View>
      ) : (
        recipes.map((r: any) => (
          <View key={r.id} style={[s.favCard, { backgroundColor: colors.cardBackground, ...(isDark ? {} : shadow.sm) }]}>
            <View style={{ flex: 1 }}>
              <Text style={[s.favName, { color: colors.onSurface }]}>{r.name}</Text>
              <Text style={[s.favMacro, { color: colors.onSurfaceSecondary }]}>
                {Math.round(r.totals_per_serving?.calories || 0)} kcal/porção · {r.servings} porções
              </Text>
              <Text style={[s.favItems, { color: colors.onSurfaceTertiary }]}>{r.items.map((i: any) => i.name).join(", ")}</Text>
            </View>
            <View style={s.favActions}>
              <Pressable onPress={() => applyRecipe(r.id)} style={[s.favUseBtn, { backgroundColor: colors.brandPrimary }]}>
                <Ionicons name="add" size={18} color={colors.onBrandPrimary} />
              </Pressable>
              <Pressable onPress={() => deleteRecipe(r.id)} hitSlop={8}>
                <Ionicons name="trash-outline" size={16} color={colors.onSurfaceSecondary} />
              </Pressable>
            </View>
          </View>
        ))
      )}
    </>
  );
}

// ─── Item Editor (shared by Manual, Edit, Favorite, Recipe) ──

function ItemEditor({ items, setItems, colors }: { items: MealItem[]; setItems: (items: MealItem[]) => void; colors: any }) {
  const update = (idx: number, field: keyof MealItem, value: string) => {
    const next = [...items];
    if (field === "name" || field === "unit") {
      (next[idx] as any)[field] = value;
    } else {
      (next[idx] as any)[field] = parseFloat(value) || 0;
    }
    setItems(next);
  };

  return (
    <>
      {items.map((item, idx) => (
        <View key={idx} style={[s.itemCard, { backgroundColor: colors.surfaceTertiary }]}>
          <View style={s.itemRow}>
            <TextInput
              style={[s.itemInput, s.itemName, { color: colors.onSurface, borderColor: colors.border }]}
              value={item.name}
              onChangeText={(v) => update(idx, "name", v)}
              placeholder="Nome do alimento"
              placeholderTextColor={colors.onSurfaceTertiary}
            />
            <Pressable onPress={() => setItems(items.filter((_, i) => i !== idx))} hitSlop={8}>
              <Ionicons name="close-circle" size={20} color={colors.error} />
            </Pressable>
          </View>
          <View style={s.itemRow}>
            <NumInput label="Qtd" value={item.quantity} onChange={(v) => update(idx, "quantity", v)} colors={colors} />
            <TextInput
              style={[s.itemInput, s.itemUnit, { color: colors.onSurface, borderColor: colors.border }]}
              value={item.unit}
              onChangeText={(v) => update(idx, "unit", v)}
              placeholder="un"
              placeholderTextColor={colors.onSurfaceTertiary}
            />
            <NumInput label="kcal" value={item.calories} onChange={(v) => update(idx, "calories", v)} colors={colors} />
          </View>
          <View style={s.itemRow}>
            <NumInput label="P(g)" value={item.protein_g} onChange={(v) => update(idx, "protein_g", v)} colors={colors} />
            <NumInput label="C(g)" value={item.carbs_g} onChange={(v) => update(idx, "carbs_g", v)} colors={colors} />
            <NumInput label="G(g)" value={item.fat_g} onChange={(v) => update(idx, "fat_g", v)} colors={colors} />
          </View>
          <View style={s.itemRow}>
            <NumInput label="Fibra" value={item.fiber_g} onChange={(v) => update(idx, "fiber_g", v)} colors={colors} />
            <NumInput label="Açúcar" value={item.sugar_g} onChange={(v) => update(idx, "sugar_g", v)} colors={colors} />
            <NumInput label="Na(mg)" value={item.sodium_mg} onChange={(v) => update(idx, "sodium_mg", v)} colors={colors} />
          </View>
        </View>
      ))}
      <Pressable onPress={() => setItems([...items, emptyItem()])} style={[s.addItemBtn, { borderColor: colors.brandPrimary }]}>
        <Ionicons name="add" size={18} color={colors.brandPrimary} />
        <Text style={[s.addItemText, { color: colors.brandPrimary }]}>Adicionar item</Text>
      </Pressable>
    </>
  );
}

function NumInput({ label, value, onChange, colors }: { label: string; value: number; onChange: (v: string) => void; colors: any }) {
  return (
    <View style={s.numWrap}>
      <Text style={[s.numLabel, { color: colors.onSurfaceSecondary }]}>{label}</Text>
      <TextInput
        style={[s.itemInput, s.numInput, { color: colors.onSurface, borderColor: colors.border }]}
        value={value ? String(value) : ""}
        onChangeText={onChange}
        keyboardType="numeric"
        placeholderTextColor={colors.onSurfaceTertiary}
        placeholder="0"
      />
    </View>
  );
}

// ─── Manual Entry Modal ────────────────────────────────────────

function ManualEntryModal({ visible, onClose, onSave, colors, isDark, insets }: any) {
  const [title, setTitle] = useState("");
  const [mealType, setMealType] = useState("meal");
  const [items, setItems] = useState<MealItem[]>([emptyItem()]);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      await onSave({ title: title.trim(), meal_type: mealType, items, notes: notes.trim() });
      setTitle(""); setMealType("meal"); setItems([emptyItem()]); setNotes("");
    } catch {} finally { setSaving(false); }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[s.modalRoot, { backgroundColor: colors.surface, paddingTop: insets.top }]}>
        <View style={s.modalHeader}>
          <Pressable onPress={onClose}><Ionicons name="close" size={24} color={colors.onSurface} /></Pressable>
          <Text style={[s.modalTitle, { color: colors.onSurface }]}>Entrada manual</Text>
          <Pressable onPress={save} disabled={saving || !title.trim()}>
            {saving ? <ActivityIndicator color={colors.brandPrimary} size="small" /> : <Text style={[s.saveBtn, { color: title.trim() ? colors.brandPrimary : colors.onSurfaceTertiary }]}>Salvar</Text>}
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={s.modalBody} keyboardShouldPersistTaps="handled">
          <Text style={[s.fieldLabel, { color: colors.onSurfaceSecondary }]}>Título</Text>
          <TextInput style={[s.textInput, { color: colors.onSurface, backgroundColor: colors.inputBackground, borderColor: colors.border }]} value={title} onChangeText={setTitle} placeholder="Ex: Almoço" placeholderTextColor={colors.onSurfaceTertiary} />

          <Text style={[s.fieldLabel, { color: colors.onSurfaceSecondary }]}>Tipo</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.lg }}>
            {MEAL_TYPES.map((t) => (
              <Pressable key={t.value} onPress={() => setMealType(t.value)} style={[s.typeChip, { backgroundColor: mealType === t.value ? colors.brandPrimary : colors.surfaceTertiary }]}>
                <Text style={[s.typeChipText, { color: mealType === t.value ? colors.onBrandPrimary : colors.onSurface }]}>{t.label}</Text>
              </Pressable>
            ))}
          </ScrollView>

          <Text style={[s.fieldLabel, { color: colors.onSurfaceSecondary }]}>Itens</Text>
          <ItemEditor items={items} setItems={setItems} colors={colors} />

          <Text style={[s.fieldLabel, { color: colors.onSurfaceSecondary, marginTop: spacing.lg }]}>Notas</Text>
          <TextInput style={[s.textInput, s.notesInput, { color: colors.onSurface, backgroundColor: colors.inputBackground, borderColor: colors.border }]} value={notes} onChangeText={setNotes} placeholder="Observações (opcional)" placeholderTextColor={colors.onSurfaceTertiary} multiline />
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── Edit Meal Modal ───────────────────────────────────────────

function EditMealModal({ meal, onClose, onSave, colors, isDark, insets }: any) {
  const [title, setTitle] = useState(meal.title || "");
  const [mealType, setMealType] = useState(meal.meal_type || "meal");
  const [items, setItems] = useState<MealItem[]>(
    (meal.items || []).map((i: any) => ({
      name: i.name || "", quantity: i.quantity || 0, unit: i.unit || "g",
      calories: i.calories || 0, protein_g: i.protein_g || 0, carbs_g: i.carbs_g || 0,
      fat_g: i.fat_g || 0, fiber_g: i.fiber_g || 0, sodium_mg: i.sodium_mg || 0, sugar_g: i.sugar_g || 0,
    }))
  );
  const [notes, setNotes] = useState(meal.notes || "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await onSave({ title: title.trim(), meal_type: mealType, items, notes: notes.trim() });
    } catch {} finally { setSaving(false); }
  };

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={[s.modalRoot, { backgroundColor: colors.surface, paddingTop: insets.top }]}>
        <View style={s.modalHeader}>
          <Pressable onPress={onClose}><Ionicons name="close" size={24} color={colors.onSurface} /></Pressable>
          <Text style={[s.modalTitle, { color: colors.onSurface }]}>Editar refeição</Text>
          <Pressable onPress={save} disabled={saving}>
            {saving ? <ActivityIndicator color={colors.brandPrimary} size="small" /> : <Text style={[s.saveBtn, { color: colors.brandPrimary }]}>Salvar</Text>}
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={s.modalBody} keyboardShouldPersistTaps="handled">
          <Text style={[s.fieldLabel, { color: colors.onSurfaceSecondary }]}>Título</Text>
          <TextInput style={[s.textInput, { color: colors.onSurface, backgroundColor: colors.inputBackground, borderColor: colors.border }]} value={title} onChangeText={setTitle} />

          <Text style={[s.fieldLabel, { color: colors.onSurfaceSecondary }]}>Tipo</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.lg }}>
            {MEAL_TYPES.map((t) => (
              <Pressable key={t.value} onPress={() => setMealType(t.value)} style={[s.typeChip, { backgroundColor: mealType === t.value ? colors.brandPrimary : colors.surfaceTertiary }]}>
                <Text style={[s.typeChipText, { color: mealType === t.value ? colors.onBrandPrimary : colors.onSurface }]}>{t.label}</Text>
              </Pressable>
            ))}
          </ScrollView>

          <Text style={[s.fieldLabel, { color: colors.onSurfaceSecondary }]}>Itens</Text>
          <ItemEditor items={items} setItems={setItems} colors={colors} />

          {meal.ai_failed && (
            <View style={[s.aiWarning, { backgroundColor: "rgba(245,166,35,0.15)" }]}>
              <Ionicons name="warning" size={18} color={colors.warning} />
              <Text style={[s.aiWarningText, { color: colors.warning }]}>A IA não conseguiu analisar esta foto. Preencha os itens manualmente.</Text>
            </View>
          )}

          <Text style={[s.fieldLabel, { color: colors.onSurfaceSecondary, marginTop: spacing.lg }]}>Notas</Text>
          <TextInput style={[s.textInput, s.notesInput, { color: colors.onSurface, backgroundColor: colors.inputBackground, borderColor: colors.border }]} value={notes} onChangeText={setNotes} multiline />
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── Favorite Modal ────────────────────────────────────────────

function FavoriteModal({ visible, onClose, onSave, colors, isDark, insets }: any) {
  const [name, setName] = useState("");
  const [mealType, setMealType] = useState("meal");
  const [items, setItems] = useState<MealItem[]>([emptyItem()]);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name.trim() || items.length === 0) return;
    setSaving(true);
    try {
      await onSave({ name: name.trim(), meal_type: mealType, items });
      setName(""); setMealType("meal"); setItems([emptyItem()]);
    } catch {} finally { setSaving(false); }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[s.modalRoot, { backgroundColor: colors.surface, paddingTop: insets.top }]}>
        <View style={s.modalHeader}>
          <Pressable onPress={onClose}><Ionicons name="close" size={24} color={colors.onSurface} /></Pressable>
          <Text style={[s.modalTitle, { color: colors.onSurface }]}>Novo favorito</Text>
          <Pressable onPress={save} disabled={saving || !name.trim()}>
            {saving ? <ActivityIndicator color={colors.brandPrimary} size="small" /> : <Text style={[s.saveBtn, { color: name.trim() ? colors.brandPrimary : colors.onSurfaceTertiary }]}>Salvar</Text>}
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={s.modalBody} keyboardShouldPersistTaps="handled">
          <Text style={[s.fieldLabel, { color: colors.onSurfaceSecondary }]}>Nome</Text>
          <TextInput style={[s.textInput, { color: colors.onSurface, backgroundColor: colors.inputBackground, borderColor: colors.border }]} value={name} onChangeText={setName} placeholder="Ex: Café da manhã padrão" placeholderTextColor={colors.onSurfaceTertiary} />

          <Text style={[s.fieldLabel, { color: colors.onSurfaceSecondary }]}>Tipo</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.lg }}>
            {MEAL_TYPES.map((t) => (
              <Pressable key={t.value} onPress={() => setMealType(t.value)} style={[s.typeChip, { backgroundColor: mealType === t.value ? colors.brandPrimary : colors.surfaceTertiary }]}>
                <Text style={[s.typeChipText, { color: mealType === t.value ? colors.onBrandPrimary : colors.onSurface }]}>{t.label}</Text>
              </Pressable>
            ))}
          </ScrollView>

          <Text style={[s.fieldLabel, { color: colors.onSurfaceSecondary }]}>Itens</Text>
          <ItemEditor items={items} setItems={setItems} colors={colors} />
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── Recipe Modal ──────────────────────────────────────────────

function RecipeModal({ visible, onClose, onSave, colors, isDark, insets }: any) {
  const [name, setName] = useState("");
  const [servings, setServings] = useState("1");
  const [items, setItems] = useState<MealItem[]>([emptyItem()]);
  const [instructions, setInstructions] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name.trim() || items.length === 0) return;
    setSaving(true);
    try {
      await onSave({ name: name.trim(), servings: parseInt(servings) || 1, items, instructions: instructions.trim() });
      setName(""); setServings("1"); setItems([emptyItem()]); setInstructions("");
    } catch {} finally { setSaving(false); }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[s.modalRoot, { backgroundColor: colors.surface, paddingTop: insets.top }]}>
        <View style={s.modalHeader}>
          <Pressable onPress={onClose}><Ionicons name="close" size={24} color={colors.onSurface} /></Pressable>
          <Text style={[s.modalTitle, { color: colors.onSurface }]}>Nova receita</Text>
          <Pressable onPress={save} disabled={saving || !name.trim()}>
            {saving ? <ActivityIndicator color={colors.brandPrimary} size="small" /> : <Text style={[s.saveBtn, { color: name.trim() ? colors.brandPrimary : colors.onSurfaceTertiary }]}>Salvar</Text>}
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={s.modalBody} keyboardShouldPersistTaps="handled">
          <Text style={[s.fieldLabel, { color: colors.onSurfaceSecondary }]}>Nome</Text>
          <TextInput style={[s.textInput, { color: colors.onSurface, backgroundColor: colors.inputBackground, borderColor: colors.border }]} value={name} onChangeText={setName} placeholder="Ex: Vitamina proteica" placeholderTextColor={colors.onSurfaceTertiary} />

          <Text style={[s.fieldLabel, { color: colors.onSurfaceSecondary }]}>Porções</Text>
          <TextInput style={[s.textInput, { color: colors.onSurface, backgroundColor: colors.inputBackground, borderColor: colors.border, width: 80 }]} value={servings} onChangeText={setServings} keyboardType="numeric" />

          <Text style={[s.fieldLabel, { color: colors.onSurfaceSecondary }]}>Ingredientes</Text>
          <ItemEditor items={items} setItems={setItems} colors={colors} />

          <Text style={[s.fieldLabel, { color: colors.onSurfaceSecondary, marginTop: spacing.lg }]}>Modo de preparo</Text>
          <TextInput style={[s.textInput, s.notesInput, { color: colors.onSurface, backgroundColor: colors.inputBackground, borderColor: colors.border }]} value={instructions} onChangeText={setInstructions} placeholder="(opcional)" placeholderTextColor={colors.onSurfaceTertiary} multiline />
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── MacroChip ─────────────────────────────────────────────────

function MacroChip({ label, value, pct, color, textColor, subColor }: any) {
  return (
    <View style={s.macroChip}>
      <View style={[s.macroDot, { backgroundColor: color }]} />
      <View>
        <Text style={[s.macroValue, { color: textColor }]}>{value}</Text>
        <Text style={[s.macroLabel, { color: subColor }]}>{label} · {pct}%</Text>
      </View>
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: {
    paddingHorizontal: spacing.lg, paddingBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { fontFamily: fonts.display, fontSize: type["3xl"], letterSpacing: 1 },
  tabRow: { flexDirection: "row", gap: spacing.sm, paddingTop: spacing.sm },
  subTab: {
    flexDirection: "row", alignItems: "center", gap: spacing.xs,
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.pill,
  },
  subTabText: { fontFamily: fonts.semibold, fontSize: type.sm },

  donutSection: { borderRadius: radius.xl, padding: spacing.xl, alignItems: "center" },
  macroLegend: { flexDirection: "row", gap: spacing.xl, marginTop: spacing.lg },
  macroChip: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  macroDot: { width: 10, height: 10, borderRadius: 5 },
  macroValue: { fontFamily: fonts.bold, fontSize: type.base },
  macroLabel: { fontFamily: fonts.text, fontSize: type.xs },
  goalText: { fontFamily: fonts.text, fontSize: type.sm, marginTop: spacing.md },

  microRow: {
    flexDirection: "row", gap: spacing.xl, marginTop: spacing.md,
    paddingTop: spacing.md, borderTopWidth: StyleSheet.hairlineWidth,
  },
  microText: { fontFamily: fonts.mono, fontSize: type.xs },

  sectionTitle: {
    fontFamily: fonts.semibold, fontSize: type.sm, letterSpacing: 1,
    textTransform: "uppercase", marginTop: spacing.xl, marginBottom: spacing.md,
  },
  sectionHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    marginTop: spacing.xl, marginBottom: spacing.md,
  },

  empty: { alignItems: "center", paddingTop: 60, gap: spacing.md },
  emptyTitle: { fontFamily: fonts.display, fontSize: type["2xl"], letterSpacing: 1, marginTop: spacing.sm },
  emptyText: { fontFamily: fonts.text, fontSize: type.base, textAlign: "center", paddingHorizontal: spacing.xl, lineHeight: 22 },

  meal: {
    flexDirection: "row", gap: spacing.lg, borderRadius: radius.lg,
    padding: spacing.xl, marginBottom: spacing.lg,
  },
  mealImg: { width: 80, height: 80, borderRadius: radius.md },
  mealHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  mealTitle: { fontFamily: fonts.semibold, fontSize: type.lg, marginRight: spacing.sm },
  mealTypeLabel: { fontFamily: fonts.text, fontSize: type.xs, marginTop: 2 },
  mealCal: { fontFamily: fonts.display, fontSize: type.xl, marginTop: 2 },
  mealMacros: { fontFamily: fonts.mono, fontSize: type.sm, marginTop: 2 },
  mealNote: { fontFamily: fonts.text, fontSize: type.sm, fontStyle: "italic", marginTop: spacing.xs },
  aiFailed: { fontFamily: fonts.medium, fontSize: type.xs, marginTop: spacing.xs },

  fab: {
    position: "absolute", right: spacing.xl, width: 64, height: 64, borderRadius: radius.pill,
    alignItems: "center", justifyContent: "center",
  },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  sheet: {
    borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
    padding: spacing.xl, gap: spacing.md,
  },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: spacing.sm },
  sheetTitle: { fontFamily: fonts.bold, fontSize: type.sm, letterSpacing: 2, marginBottom: spacing.xs },
  sheetBtn: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    padding: spacing.xl, borderRadius: radius.lg,
  },
  sheetBtnText: { fontFamily: fonts.semibold, fontSize: type.lg },

  permBox: { borderRadius: radius.lg, padding: spacing.xl, marginBottom: spacing.lg },
  permText: { fontFamily: fonts.medium, fontSize: type.base },
  permBtn: { marginTop: spacing.md, height: 48, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  permBtnText: { fontFamily: fonts.bold, fontSize: type.base },

  analyzeOverlay: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", gap: spacing.lg },
  analyzeText: { fontFamily: fonts.bold, fontSize: type.lg, letterSpacing: 1 },

  // Week
  weekRow: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    padding: spacing.lg, borderRadius: radius.lg, marginBottom: spacing.sm,
  },
  weekDay: { fontFamily: fonts.semibold, fontSize: type.sm, width: 50 },
  weekBarBg: { flex: 1, height: 8, borderRadius: 4, backgroundColor: "rgba(160,217,50,0.12)", overflow: "hidden" },
  weekBar: { height: 8, borderRadius: 4 },
  weekNums: { alignItems: "flex-end", minWidth: 70 },
  weekCal: { fontFamily: fonts.bold, fontSize: type.base },
  weekMacro: { fontFamily: fonts.mono, fontSize: type.xs },
  weekCount: { fontFamily: fonts.mono, fontSize: type.xs, minWidth: 24, textAlign: "right" },

  // Favorites/Recipes
  favCard: {
    flexDirection: "row", gap: spacing.lg, padding: spacing.xl,
    borderRadius: radius.lg, marginBottom: spacing.md,
  },
  favName: { fontFamily: fonts.semibold, fontSize: type.lg },
  favMacro: { fontFamily: fonts.mono, fontSize: type.sm, marginTop: 2 },
  favItems: { fontFamily: fonts.text, fontSize: type.xs, marginTop: spacing.xs },
  favActions: { alignItems: "center", gap: spacing.md, justifyContent: "center" },
  favUseBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },

  // Modal
  modalRoot: { flex: 1 },
  modalHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
  },
  modalTitle: { fontFamily: fonts.display, fontSize: type["2xl"], letterSpacing: 1 },
  saveBtn: { fontFamily: fonts.bold, fontSize: type.lg },
  modalBody: { padding: spacing.lg, paddingBottom: 120 },

  fieldLabel: { fontFamily: fonts.semibold, fontSize: type.sm, letterSpacing: 0.5, marginBottom: spacing.sm, marginTop: spacing.md },
  textInput: {
    fontFamily: fonts.text, fontSize: type.base, borderWidth: 1,
    borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm,
  },
  notesInput: { height: 80, textAlignVertical: "top" },

  typeChip: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
    borderRadius: radius.pill, marginRight: spacing.sm,
  },
  typeChipText: { fontFamily: fonts.semibold, fontSize: type.xs },

  // Item editor
  itemCard: { borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md },
  itemRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.xs, alignItems: "center" },
  itemInput: {
    fontFamily: fonts.text, fontSize: type.sm, borderWidth: 1,
    borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs,
  },
  itemName: { flex: 1 },
  itemUnit: { width: 50, textAlign: "center" },
  numWrap: { flex: 1 },
  numLabel: { fontFamily: fonts.mono, fontSize: 9, marginBottom: 2 },
  numInput: { textAlign: "center" },
  addItemBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: spacing.sm, padding: spacing.md, borderWidth: 1,
    borderStyle: "dashed", borderRadius: radius.md, marginTop: spacing.sm,
  },
  addItemText: { fontFamily: fonts.semibold, fontSize: type.sm },

  aiWarning: {
    flexDirection: "row", gap: spacing.sm, alignItems: "center",
    padding: spacing.md, borderRadius: radius.md, marginTop: spacing.md,
  },
  aiWarningText: { fontFamily: fonts.text, fontSize: type.sm, flex: 1 },
});
