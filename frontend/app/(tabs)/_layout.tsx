import React from "react";
import { Platform, StyleSheet, View } from "react-native";
import { Tabs } from "expo-router";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import { fonts, shadow, spacing } from "@/src/theme";
import { useTheme } from "@/src/context/ThemeContext";

export default function TabsLayout() {
  const { colors, isDark } = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brandPrimary,
        tabBarInactiveTintColor: colors.onSurfaceSecondary,
        tabBarLabelStyle: {
          fontFamily: fonts.semibold,
          fontSize: 10,
          letterSpacing: 0.5,
          marginTop: 2,
        },
        tabBarIconStyle: { marginTop: 6 },
        tabBarItemStyle: { alignSelf: "center", paddingVertical: 4 },
        tabBarStyle: {
          position: "absolute",
          borderTopWidth: isDark ? StyleSheet.hairlineWidth : 0,
          borderTopColor: colors.tabBarBorder,
          backgroundColor: Platform.OS === "android" ? colors.tabBar : "transparent",
          elevation: 0,
          height: Platform.OS === "web" ? 72 : 88,
          paddingBottom: Platform.OS === "web" ? spacing.sm : undefined,
          ...(isDark ? {} : {
            ...shadow.md,
            shadowOffset: { width: 0, height: -4 },
          }),
        },
        tabBarBackground: () =>
          Platform.OS === "ios" ? (
            <BlurView
              intensity={isDark ? 60 : 80}
              tint={isDark ? "dark" : "light"}
              style={StyleSheet.absoluteFill}
            />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.tabBar }]} />
          ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Início",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "home" : "home-outline"} size={focused ? 26 : 22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="workouts"
        options={{
          title: "Treino",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "barbell" : "barbell-outline"} size={focused ? 26 : 22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="health"
        options={{
          title: "Saúde",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "heart" : "heart-outline"} size={focused ? 26 : 22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="nutrition"
        options={{
          title: "Nutrição",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "restaurant" : "restaurant-outline"} size={focused ? 26 : 22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="coach"
        options={{
          title: "Coach",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "chatbubble-ellipses" : "chatbubble-ellipses-outline"} size={focused ? 26 : 22} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
