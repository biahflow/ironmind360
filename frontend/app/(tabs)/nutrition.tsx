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

import { spacing, radius, fonts, type } from "@/src/theme";
import { useTheme } from "@/src/context/ThemeContext";
import { api, authHeaders, fileUrl } from "@/src/lib/api";
import DonutChart from "@/src/components/DonutChart";
import { Screen, ScreenHeader, EmptyState, layout } from "@/src/components/ui";

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
  const { colors } = useTheme();
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
  const tabBarPad = layout.tabBarPad(insets.bottom) + 72;

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
    { value: protG, color: colors.macroProtein, label: "Proteína" },
    { value: carbG, color: colors.macroCarbs, label: "Carboidrato" },
    { value: fatG, color: colors.macroFat, label: "Gordura" },
  ];

  const SUB_TABS: { key: SubTab; label: string; icon: string }[] = [
    { key: "today", label: "Hoje", icon: "today-outline" },
    { key: "week", label: "Semana", icon: "calendar-outline" },
    { key: "favorites", label: "Favoritos", icon: "heart-outline" },
    { key: "recipes", label: "Receitas", icon: "book-outline" },
  ];

  return (
    <Screen>
      <ScreenHeader title="Nutrição" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tabRow}>
        {SUB_TABS.map((t) => {
          const active = tab === t.key;
          return (
            <Pressable
              key={t.key}
              onPress={() => setTab(t.key)}
              style={[
                s.subTab,
                {
                  backgroundColor: active ? colors.accent : colors.surface,
                  borderColor: active ? colors.accent : colors.border,
                },
              ]}
            >
              <Ionicons name={t.icon as any} size={16} color={active ? colors.onAccent : colors.textSecondary} />
              <Text style={[s.subTabText, { color: active ? colors.onAccent : colors.textSecondary }]}>{t.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {loading ? (
        <View style={s.center}><ActivityIndicator color={colors.accent} /></View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingTop: spacing.sm, paddingBottom: tabBarPad }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={false} onRefresh={loadAll} tintColor={colors.accent} />}
        >
          {tab === "today" && <TodayView {...{ meals, totals, goals, segments, protG, carbG, fatG, totalMacroG, colors, imageHeaders, permMsg, removeMeal, setEditModal }} />}
          {tab === "week" && <WeekView days={weekly} goals={goals} colors={colors} />}
          {tab === "favorites" && <FavoritesView favorites={favorites} colors={colors} applyFavorite={applyFavorite} deleteFavorite={deleteFavorite} setFavModal={setFavModal} />}
          {tab === "recipes" && <RecipesView recipes={recipes} colors={colors} applyRecipe={applyRecipe} deleteRecipe={deleteRecipe} setRecipeModal={setRecipeModal} />}
        </ScrollView>
      )}

      {tab === "today" && (
        <Pressable
          testID="camera-log-fab"
          style={[s.fab, { bottom: insets.bottom + 64 + spacing.lg, backgroundColor: colors.accent }]}
          onPress={() => setPicker(true)}
          disabled={analyzing}
        >
          {analyzing ? <ActivityIndicator color={colors.onAccent} /> : <Ionicons name="add" size={28} color={colors.onAccent} />}
        </Pressable>
      )}

      {/* Add meal picker */}
      <Modal visible={picker} transparent animationType="slide" onRequestClose={() => setPicker(false)}>
        <Pressable style={[s.backdrop, { backgroundColor: colors.overlay }]} onPress={() => setPicker(false)}>
          <View style={[s.sheet, { paddingBottom: insets.bottom + spacing.lg, backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[s.sheetHandle, { backgroundColor: colors.border }]} />
            <Text style={[s.sheetTitle, { color: colors.textSecondary }]}>REGISTRAR REFEIÇÃO</Text>
            <Pressable testID="take-photo-button" style={[s.sheetBtn, { backgroundColor: colors.elevated, borderColor: colors.border }]} onPress={openCamera}>
              <Ionicons name="camera" size={22} color={colors.text} />
              <Text style={[s.sheetBtnText, { color: colors.text }]}>Tirar foto do prato</Text>
            </Pressable>
            <Pressable testID="pick-photo-button" style={[s.sheetBtn, { backgroundColor: colors.elevated, borderColor: colors.border }]} onPress={openGallery}>
              <Ionicons name="images" size={22} color={colors.text} />
              <Text style={[s.sheetBtnText, { color: colors.text }]}>Escolher da galeria</Text>
            </Pressable>
            <Pressable testID="manual-entry-button" style={[s.sheetBtn, { backgroundColor: colors.elevated, borderColor: colors.border }]} onPress={() => { setPicker(false); setManualModal(true); }}>
              <Ionicons name="create-outline" size={22} color={colors.text} />
              <Text style={[s.sheetBtnText, { color: colors.text }]}>Entrada manual</Text>
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
        insets={insets}
      />

      {analyzing && (
        <View style={[s.analyzeOverlay, { backgroundColor: colors.overlay }]} testID="analyzing-overlay">
          <ActivityIndicator color={colors.accent} size="large" />
          <Text style={[s.analyzeText, { color: colors.text }]}>Analisando seu prato...</Text>
        </View>
      )}
    </Screen>
  );
}

// ─── Today View ────────────────────────────────────────────────

function TodayView({ meals, totals, goals, segments, protG, carbG, fatG, totalMacroG, colors, imageHeaders, permMsg, removeMeal, setEditModal }: any) {
  return (
    <>
      <View style={[s.donutSection, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <DonutChart size={180} strokeWidth={16} segments={segments} centerValue={`${Math.round(totals.calories || 0)}`} centerLabel="kcal" />
        <View style={s.macroLegend}>
          <MacroChip label="Proteína" value={`${protG}g`} pct={Math.round((protG / totalMacroG) * 100)} color={colors.macroProtein} textColor={colors.text} subColor={colors.textSecondary} />
          <MacroChip label="Carbo" value={`${carbG}g`} pct={Math.round((carbG / totalMacroG) * 100)} color={colors.macroCarbs} textColor={colors.text} subColor={colors.textSecondary} />
          <MacroChip label="Gordura" value={`${fatG}g`} pct={Math.round((fatG / totalMacroG) * 100)} color={colors.macroFat} textColor={colors.text} subColor={colors.textSecondary} />
        </View>
        {(totals.fiber_g > 0 || totals.sodium_mg > 0) && (
          <View style={[s.microRow, { borderTopColor: colors.border }]}>
            {totals.fiber_g > 0 && <Text style={[s.microText, { color: colors.textSecondary }]}>Fibra {Math.round(totals.fiber_g)}g</Text>}
            {totals.sugar_g > 0 && <Text style={[s.microText, { color: colors.textSecondary }]}>Açúcar {Math.round(totals.sugar_g)}g</Text>}
            {totals.sodium_mg > 0 && <Text style={[s.microText, { color: colors.textSecondary }]}>Sódio {Math.round(totals.sodium_mg)}mg</Text>}
          </View>
        )}
        {goals.calories && (
          <Text style={[s.goalText, { color: colors.textSecondary }]}>Meta: {goals.calories} kcal · P {goals.protein}g</Text>
        )}
      </View>

      {permMsg ? (
        <View style={[s.permBox, { backgroundColor: colors.accentMuted }]}>
          <Text style={[s.permText, { color: colors.text }]}>{permMsg}</Text>
          {permMsg.includes("bloqueado") && (
            <Pressable testID="open-settings-button" onPress={() => Linking.openSettings()} style={[s.permBtn, { backgroundColor: colors.accent }]}>
              <Text style={[s.permBtnText, { color: colors.onAccent }]}>Abrir Configurações</Text>
            </Pressable>
          )}
        </View>
      ) : null}

      <Text style={[s.sectionTitle, { color: colors.text }]}>Refeições</Text>
      {meals.length === 0 ? (
        <EmptyState
          icon="restaurant-outline"
          title="Nenhuma refeição"
          text="Fotografe seu prato, adicione manualmente ou use um favorito."
        />
      ) : (
        meals.map((m: any) => (
          <Pressable key={m.id} onPress={() => setEditModal(m)} style={[s.meal, { backgroundColor: colors.surface, borderColor: colors.border }]} testID={`meal-${m.id}`}>
            {m.photo_url ? (
              <Image source={{ uri: fileUrl(m.photo_url), headers: imageHeaders }} style={[s.mealImg, { backgroundColor: colors.elevated }]} contentFit="cover" />
            ) : (
              <View style={[s.mealImg, { backgroundColor: colors.elevated, alignItems: "center", justifyContent: "center" }]}>
                <Ionicons name={m.source === "favorite" ? "heart" : m.source === "recipe" ? "book" : "create"} size={24} color={colors.textSecondary} />
              </View>
            )}
            <View style={{ flex: 1 }}>
              <View style={s.mealHead}>
                <View style={{ flex: 1 }}>
                  <Text style={[s.mealTitle, { color: colors.text }]} numberOfLines={1}>{m.title}</Text>
                  <Text style={[s.mealTypeLabel, { color: colors.textSecondary }]}>{mealTypeLabel(m.meal_type)}</Text>
                </View>
                <Pressable testID={`delete-meal-${m.id}`} onPress={(e) => { e.stopPropagation?.(); removeMeal(m.id); }} hitSlop={8}>
                  <Ionicons name="trash-outline" size={16} color={colors.textSecondary} />
                </Pressable>
              </View>
              <Text style={[s.mealCal, { color: colors.accent }]}>{Math.round(m.calories)} kcal</Text>
              <Text style={[s.mealMacros, { color: colors.textSecondary }]}>P {Math.round(m.protein_g)}g · C {Math.round(m.carbs_g)}g · G {Math.round(m.fat_g)}g</Text>
              {m.ai_failed && <Text style={[s.aiFailed, { color: colors.warning }]}>IA indisponível — edite manualmente</Text>}
              {m.coach_note ? <Text style={[s.mealNote, { color: colors.textSecondary }]}>&ldquo;{m.coach_note}&rdquo;</Text> : null}
            </View>
          </Pressable>
        ))
      )}
    </>
  );
}

// ─── Week View ─────────────────────────────────────────────────

function WeekView({ days, goals, colors }: any) {
  const maxCal = Math.max(...days.map((d: any) => d.calories || 0), goals.calories || 2000);
  return (
    <>
      <Text style={[s.sectionTitle, { color: colors.text }]}>Últimos 7 dias</Text>
      {days.map((d: any) => {
        const pct = maxCal > 0 ? Math.min((d.calories / maxCal) * 100, 100) : 0;
        const dayLabel = new Date(d.date + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit" });
        return (
          <View key={d.date} style={[s.weekRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[s.weekDay, { color: colors.text }]}>{dayLabel}</Text>
            <View style={[s.weekBarBg, { backgroundColor: colors.accentMuted }]}>
              <View style={[s.weekBar, { width: `${pct}%`, backgroundColor: colors.accent }]} />
            </View>
            <View style={s.weekNums}>
              <Text style={[s.weekCal, { color: colors.text }]}>{Math.round(d.calories)}</Text>
              <Text style={[s.weekMacro, { color: colors.textSecondary }]}>P{Math.round(d.protein_g)} C{Math.round(d.carbs_g)} G{Math.round(d.fat_g)}</Text>
            </View>
            {d.meal_count > 0 && <Text style={[s.weekCount, { color: colors.textSecondary }]}>{d.meal_count}×</Text>}
          </View>
        );
      })}
    </>
  );
}

// ─── Favorites View ────────────────────────────────────────────

function FavoritesView({ favorites, colors, applyFavorite, deleteFavorite, setFavModal }: any) {
  return (
    <>
      <View style={s.sectionHeader}>
        <Text style={[s.sectionTitle, s.sectionTitleInline, { color: colors.text }]}>Favoritos</Text>
        <Pressable onPress={() => setFavModal(true)} hitSlop={8}>
          <Ionicons name="add-circle-outline" size={24} color={colors.accent} />
        </Pressable>
      </View>
      {favorites.length === 0 ? (
        <EmptyState
          icon="heart-outline"
          title="Sem favoritos"
          text="Salve refeições frequentes para registrar com um toque."
        />
      ) : (
        favorites.map((f: any) => {
          const t = sumItems(f.items);
          return (
            <View key={f.id} style={[s.favCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={[s.favName, { color: colors.text }]}>{f.name}</Text>
                <Text style={[s.favMacro, { color: colors.textSecondary }]}>{Math.round(t.calories)} kcal · P{Math.round(t.protein_g)}g C{Math.round(t.carbs_g)}g G{Math.round(t.fat_g)}g</Text>
                <Text style={[s.favItems, { color: colors.textSecondary }]}>{f.items.map((i: any) => i.name).join(", ")}</Text>
              </View>
              <View style={s.favActions}>
                <Pressable onPress={() => applyFavorite(f.id)} style={[s.favUseBtn, { backgroundColor: colors.accent }]}>
                  <Ionicons name="add" size={18} color={colors.onAccent} />
                </Pressable>
                <Pressable onPress={() => deleteFavorite(f.id)} hitSlop={8}>
                  <Ionicons name="trash-outline" size={16} color={colors.textSecondary} />
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

function RecipesView({ recipes, colors, applyRecipe, deleteRecipe, setRecipeModal }: any) {
  return (
    <>
      <View style={s.sectionHeader}>
        <Text style={[s.sectionTitle, s.sectionTitleInline, { color: colors.text }]}>Receitas</Text>
        <Pressable onPress={() => setRecipeModal(true)} hitSlop={8}>
          <Ionicons name="add-circle-outline" size={24} color={colors.accent} />
        </Pressable>
      </View>
      {recipes.length === 0 ? (
        <EmptyState
          icon="book-outline"
          title="Sem receitas"
          text="Crie receitas com ingredientes e porções para registrar facilmente."
        />
      ) : (
        recipes.map((r: any) => (
          <View key={r.id} style={[s.favCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={[s.favName, { color: colors.text }]}>{r.name}</Text>
              <Text style={[s.favMacro, { color: colors.textSecondary }]}>
                {Math.round(r.totals_per_serving?.calories || 0)} kcal/porção · {r.servings} porções
              </Text>
              <Text style={[s.favItems, { color: colors.textSecondary }]}>{r.items.map((i: any) => i.name).join(", ")}</Text>
            </View>
            <View style={s.favActions}>
              <Pressable onPress={() => applyRecipe(r.id)} style={[s.favUseBtn, { backgroundColor: colors.accent }]}>
                <Ionicons name="add" size={18} color={colors.onAccent} />
              </Pressable>
              <Pressable onPress={() => deleteRecipe(r.id)} hitSlop={8}>
                <Ionicons name="trash-outline" size={16} color={colors.textSecondary} />
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
        <View key={idx} style={[s.itemCard, { backgroundColor: colors.elevated, borderColor: colors.border }]}>
          <View style={s.itemRow}>
            <TextInput
              style={[s.itemInput, s.itemName, { color: colors.text, backgroundColor: colors.inputBackground, borderColor: colors.border }]}
              value={item.name}
              onChangeText={(v) => update(idx, "name", v)}
              placeholder="Nome do alimento"
              placeholderTextColor={colors.textSecondary}
            />
            <Pressable onPress={() => setItems(items.filter((_, i) => i !== idx))} hitSlop={8}>
              <Ionicons name="close-circle" size={20} color={colors.error} />
            </Pressable>
          </View>
          <View style={s.itemRow}>
            <NumInput label="Qtd" value={item.quantity} onChange={(v) => update(idx, "quantity", v)} colors={colors} />
            <TextInput
              style={[s.itemInput, s.itemUnit, { color: colors.text, backgroundColor: colors.inputBackground, borderColor: colors.border }]}
              value={item.unit}
              onChangeText={(v) => update(idx, "unit", v)}
              placeholder="un"
              placeholderTextColor={colors.textSecondary}
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
      <Pressable onPress={() => setItems([...items, emptyItem()])} style={[s.addItemBtn, { borderColor: colors.accent }]}>
        <Ionicons name="add" size={18} color={colors.accent} />
        <Text style={[s.addItemText, { color: colors.accent }]}>Adicionar item</Text>
      </Pressable>
    </>
  );
}

function NumInput({ label, value, onChange, colors }: { label: string; value: number; onChange: (v: string) => void; colors: any }) {
  return (
    <View style={s.numWrap}>
      <Text style={[s.numLabel, { color: colors.textSecondary }]}>{label}</Text>
      <TextInput
        style={[s.itemInput, s.numInput, { color: colors.text, backgroundColor: colors.inputBackground, borderColor: colors.border }]}
        value={value ? String(value) : ""}
        onChangeText={onChange}
        keyboardType="numeric"
        placeholderTextColor={colors.textSecondary}
        placeholder="0"
      />
    </View>
  );
}

// ─── Manual Entry Modal ────────────────────────────────────────

function ManualEntryModal({ visible, onClose, onSave, colors, insets }: any) {
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
      <View style={[s.modalRoot, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
        <View style={s.modalHeader}>
          <Pressable onPress={onClose}><Ionicons name="close" size={24} color={colors.text} /></Pressable>
          <Text style={[s.modalTitle, { color: colors.text }]}>Entrada manual</Text>
          <Pressable onPress={save} disabled={saving || !title.trim()}>
            {saving ? <ActivityIndicator color={colors.accent} size="small" /> : <Text style={[s.saveBtn, { color: title.trim() ? colors.accent : colors.textSecondary }]}>Salvar</Text>}
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={s.modalBody} keyboardShouldPersistTaps="handled">
          <Text style={[s.fieldLabel, { color: colors.textSecondary }]}>Título</Text>
          <TextInput style={[s.textInput, { color: colors.text, backgroundColor: colors.inputBackground, borderColor: colors.border }]} value={title} onChangeText={setTitle} placeholder="Ex: Almoço" placeholderTextColor={colors.textSecondary} />

          <Text style={[s.fieldLabel, { color: colors.textSecondary }]}>Tipo</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.lg }}>
            {MEAL_TYPES.map((t) => {
              const active = mealType === t.value;
              return (
                <Pressable key={t.value} onPress={() => setMealType(t.value)} style={[s.typeChip, { backgroundColor: active ? colors.accent : colors.surface, borderColor: active ? colors.accent : colors.border }]}>
                  <Text style={[s.typeChipText, { color: active ? colors.onAccent : colors.textSecondary }]}>{t.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <Text style={[s.fieldLabel, { color: colors.textSecondary }]}>Itens</Text>
          <ItemEditor items={items} setItems={setItems} colors={colors} />

          <Text style={[s.fieldLabel, { color: colors.textSecondary, marginTop: spacing.lg }]}>Notas</Text>
          <TextInput style={[s.textInput, s.notesInput, { color: colors.text, backgroundColor: colors.inputBackground, borderColor: colors.border }]} value={notes} onChangeText={setNotes} placeholder="Observações (opcional)" placeholderTextColor={colors.textSecondary} multiline />
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── Edit Meal Modal ───────────────────────────────────────────

function EditMealModal({ meal, onClose, onSave, colors, insets }: any) {
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
      <View style={[s.modalRoot, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
        <View style={s.modalHeader}>
          <Pressable onPress={onClose}><Ionicons name="close" size={24} color={colors.text} /></Pressable>
          <Text style={[s.modalTitle, { color: colors.text }]}>Editar refeição</Text>
          <Pressable onPress={save} disabled={saving}>
            {saving ? <ActivityIndicator color={colors.accent} size="small" /> : <Text style={[s.saveBtn, { color: colors.accent }]}>Salvar</Text>}
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={s.modalBody} keyboardShouldPersistTaps="handled">
          <Text style={[s.fieldLabel, { color: colors.textSecondary }]}>Título</Text>
          <TextInput style={[s.textInput, { color: colors.text, backgroundColor: colors.inputBackground, borderColor: colors.border }]} value={title} onChangeText={setTitle} />

          <Text style={[s.fieldLabel, { color: colors.textSecondary }]}>Tipo</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.lg }}>
            {MEAL_TYPES.map((t) => {
              const active = mealType === t.value;
              return (
                <Pressable key={t.value} onPress={() => setMealType(t.value)} style={[s.typeChip, { backgroundColor: active ? colors.accent : colors.surface, borderColor: active ? colors.accent : colors.border }]}>
                  <Text style={[s.typeChipText, { color: active ? colors.onAccent : colors.textSecondary }]}>{t.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <Text style={[s.fieldLabel, { color: colors.textSecondary }]}>Itens</Text>
          <ItemEditor items={items} setItems={setItems} colors={colors} />

          {meal.ai_failed && (
            <View style={[s.aiWarning, { backgroundColor: colors.warningMuted }]}>
              <Ionicons name="warning" size={18} color={colors.warning} />
              <Text style={[s.aiWarningText, { color: colors.warning }]}>A IA não conseguiu analisar esta foto. Preencha os itens manualmente.</Text>
            </View>
          )}

          <Text style={[s.fieldLabel, { color: colors.textSecondary, marginTop: spacing.lg }]}>Notas</Text>
          <TextInput style={[s.textInput, s.notesInput, { color: colors.text, backgroundColor: colors.inputBackground, borderColor: colors.border }]} value={notes} onChangeText={setNotes} multiline />
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── Favorite Modal ────────────────────────────────────────────

function FavoriteModal({ visible, onClose, onSave, colors, insets }: any) {
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
      <View style={[s.modalRoot, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
        <View style={s.modalHeader}>
          <Pressable onPress={onClose}><Ionicons name="close" size={24} color={colors.text} /></Pressable>
          <Text style={[s.modalTitle, { color: colors.text }]}>Novo favorito</Text>
          <Pressable onPress={save} disabled={saving || !name.trim()}>
            {saving ? <ActivityIndicator color={colors.accent} size="small" /> : <Text style={[s.saveBtn, { color: name.trim() ? colors.accent : colors.textSecondary }]}>Salvar</Text>}
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={s.modalBody} keyboardShouldPersistTaps="handled">
          <Text style={[s.fieldLabel, { color: colors.textSecondary }]}>Nome</Text>
          <TextInput style={[s.textInput, { color: colors.text, backgroundColor: colors.inputBackground, borderColor: colors.border }]} value={name} onChangeText={setName} placeholder="Ex: Café da manhã padrão" placeholderTextColor={colors.textSecondary} />

          <Text style={[s.fieldLabel, { color: colors.textSecondary }]}>Tipo</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.lg }}>
            {MEAL_TYPES.map((t) => {
              const active = mealType === t.value;
              return (
                <Pressable key={t.value} onPress={() => setMealType(t.value)} style={[s.typeChip, { backgroundColor: active ? colors.accent : colors.surface, borderColor: active ? colors.accent : colors.border }]}>
                  <Text style={[s.typeChipText, { color: active ? colors.onAccent : colors.textSecondary }]}>{t.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <Text style={[s.fieldLabel, { color: colors.textSecondary }]}>Itens</Text>
          <ItemEditor items={items} setItems={setItems} colors={colors} />
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── Recipe Modal ──────────────────────────────────────────────

function RecipeModal({ visible, onClose, onSave, colors, insets }: any) {
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
      <View style={[s.modalRoot, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
        <View style={s.modalHeader}>
          <Pressable onPress={onClose}><Ionicons name="close" size={24} color={colors.text} /></Pressable>
          <Text style={[s.modalTitle, { color: colors.text }]}>Nova receita</Text>
          <Pressable onPress={save} disabled={saving || !name.trim()}>
            {saving ? <ActivityIndicator color={colors.accent} size="small" /> : <Text style={[s.saveBtn, { color: name.trim() ? colors.accent : colors.textSecondary }]}>Salvar</Text>}
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={s.modalBody} keyboardShouldPersistTaps="handled">
          <Text style={[s.fieldLabel, { color: colors.textSecondary }]}>Nome</Text>
          <TextInput style={[s.textInput, { color: colors.text, backgroundColor: colors.inputBackground, borderColor: colors.border }]} value={name} onChangeText={setName} placeholder="Ex: Vitamina proteica" placeholderTextColor={colors.textSecondary} />

          <Text style={[s.fieldLabel, { color: colors.textSecondary }]}>Porções</Text>
          <TextInput style={[s.textInput, { color: colors.text, backgroundColor: colors.inputBackground, borderColor: colors.border, width: 80 }]} value={servings} onChangeText={setServings} keyboardType="numeric" />

          <Text style={[s.fieldLabel, { color: colors.textSecondary }]}>Ingredientes</Text>
          <ItemEditor items={items} setItems={setItems} colors={colors} />

          <Text style={[s.fieldLabel, { color: colors.textSecondary, marginTop: spacing.lg }]}>Modo de preparo</Text>
          <TextInput style={[s.textInput, s.notesInput, { color: colors.text, backgroundColor: colors.inputBackground, borderColor: colors.border }]} value={instructions} onChangeText={setInstructions} placeholder="(opcional)" placeholderTextColor={colors.textSecondary} multiline />
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
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  tabRow: {
    flexDirection: "row", gap: spacing.sm,
    paddingHorizontal: spacing.xl, paddingBottom: spacing.md,
  },
  subTab: {
    flexDirection: "row", alignItems: "center", gap: spacing.xs,
    paddingHorizontal: spacing.lg, height: 44,
    borderRadius: radius.pill, borderWidth: 1,
  },
  subTabText: { fontFamily: fonts.semibold, ...type.bodySmall },

  donutSection: { borderRadius: radius.cardLarge, padding: spacing.xl, alignItems: "center", borderWidth: 1 },
  macroLegend: { flexDirection: "row", gap: spacing.xl, marginTop: spacing.lg },
  macroChip: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  macroDot: { width: 10, height: 10, borderRadius: 5 },
  macroValue: { fontFamily: fonts.bold, ...type.bodySmall, fontVariant: ["tabular-nums"] },
  macroLabel: { fontFamily: fonts.text, ...type.caption },
  goalText: { fontFamily: fonts.text, ...type.bodySmall, marginTop: spacing.md },

  microRow: {
    flexDirection: "row", gap: spacing.xl, marginTop: spacing.md,
    paddingTop: spacing.md, borderTopWidth: 1,
  },
  microText: { fontFamily: fonts.text, ...type.caption },

  sectionTitle: {
    fontFamily: fonts.bold, ...type.h2,
    marginTop: spacing.xl, marginBottom: spacing.md,
  },
  sectionTitleInline: { marginTop: 0, marginBottom: 0 },
  sectionHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    marginTop: spacing.xl, marginBottom: spacing.md,
  },

  meal: {
    flexDirection: "row", gap: spacing.lg, borderRadius: radius.card,
    padding: spacing.xl, marginBottom: spacing.lg, borderWidth: 1,
  },
  mealImg: { width: 80, height: 80, borderRadius: radius.md },
  mealHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  mealTitle: { fontFamily: fonts.semibold, ...type.body, marginRight: spacing.sm },
  mealTypeLabel: { fontFamily: fonts.text, ...type.caption, marginTop: 2 },
  mealCal: { fontFamily: fonts.bold, ...type.h2, marginTop: 2, fontVariant: ["tabular-nums"] },
  mealMacros: { fontFamily: fonts.text, ...type.bodySmall, marginTop: 2 },
  mealNote: { fontFamily: fonts.text, ...type.bodySmall, fontStyle: "italic", marginTop: spacing.xs },
  aiFailed: { fontFamily: fonts.medium, ...type.caption, marginTop: spacing.xs },

  fab: {
    position: "absolute", right: spacing.xl, width: 64, height: 64, borderRadius: radius.pill,
    alignItems: "center", justifyContent: "center",
  },
  backdrop: { flex: 1, justifyContent: "flex-end" },
  sheet: {
    borderTopLeftRadius: radius.hero, borderTopRightRadius: radius.hero,
    padding: spacing.xl, gap: spacing.md, borderWidth: 1,
  },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: spacing.sm },
  sheetTitle: { fontFamily: fonts.bold, ...type.caption, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: spacing.xs },
  sheetBtn: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    padding: spacing.xl, borderRadius: radius.lg, borderWidth: 1,
  },
  sheetBtnText: { fontFamily: fonts.semibold, ...type.body },

  permBox: { borderRadius: radius.lg, padding: spacing.xl, marginBottom: spacing.lg },
  permText: { fontFamily: fonts.medium, ...type.body },
  permBtn: { marginTop: spacing.md, height: 48, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  permBtnText: { fontFamily: fonts.bold, ...type.bodySmall },

  analyzeOverlay: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", gap: spacing.lg },
  analyzeText: { fontFamily: fonts.bold, ...type.body },

  // Week
  weekRow: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    padding: spacing.lg, borderRadius: radius.card, marginBottom: spacing.sm, borderWidth: 1,
  },
  weekDay: { fontFamily: fonts.semibold, ...type.bodySmall, width: 50 },
  weekBarBg: { flex: 1, height: 8, borderRadius: 4, overflow: "hidden" },
  weekBar: { height: 8, borderRadius: 4 },
  weekNums: { alignItems: "flex-end", minWidth: 70 },
  weekCal: { fontFamily: fonts.bold, ...type.bodySmall, fontVariant: ["tabular-nums"] },
  weekMacro: { fontFamily: fonts.text, ...type.caption },
  weekCount: { fontFamily: fonts.text, ...type.caption, minWidth: 24, textAlign: "right" },

  // Favorites/Recipes
  favCard: {
    flexDirection: "row", gap: spacing.lg, padding: spacing.xl,
    borderRadius: radius.card, marginBottom: spacing.md, borderWidth: 1,
  },
  favName: { fontFamily: fonts.semibold, ...type.body },
  favMacro: { fontFamily: fonts.text, ...type.bodySmall, marginTop: 2 },
  favItems: { fontFamily: fonts.text, ...type.caption, marginTop: spacing.xs },
  favActions: { alignItems: "center", gap: spacing.md, justifyContent: "center" },
  favUseBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },

  // Modal
  modalRoot: { flex: 1 },
  modalHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
  },
  modalTitle: { fontFamily: fonts.bold, ...type.h2 },
  saveBtn: { fontFamily: fonts.bold, ...type.body },
  modalBody: { padding: spacing.lg, paddingBottom: 120 },

  fieldLabel: { fontFamily: fonts.semibold, ...type.bodySmall, marginBottom: spacing.sm, marginTop: spacing.md },
  textInput: {
    fontFamily: fonts.text, ...type.body, borderWidth: 1,
    borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm,
  },
  notesInput: { height: 80, textAlignVertical: "top" },

  typeChip: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: radius.pill, marginRight: spacing.sm, borderWidth: 1,
  },
  typeChipText: { fontFamily: fonts.semibold, ...type.caption },

  // Item editor
  itemCard: { borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1 },
  itemRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.xs, alignItems: "center" },
  itemInput: {
    fontFamily: fonts.text, ...type.bodySmall, borderWidth: 1,
    borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs,
  },
  itemName: { flex: 1 },
  itemUnit: { width: 50, textAlign: "center" },
  numWrap: { flex: 1 },
  numLabel: { fontFamily: fonts.medium, ...type.caption, marginBottom: 2 },
  numInput: { textAlign: "center" },
  addItemBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: spacing.sm, padding: spacing.md, borderWidth: 1,
    borderStyle: "dashed", borderRadius: radius.md, marginTop: spacing.sm,
  },
  addItemText: { fontFamily: fonts.semibold, ...type.bodySmall },

  aiWarning: {
    flexDirection: "row", gap: spacing.sm, alignItems: "center",
    padding: spacing.md, borderRadius: radius.md, marginTop: spacing.md,
  },
  aiWarningText: { fontFamily: fonts.text, ...type.bodySmall, flex: 1 },
});
