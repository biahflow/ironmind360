import React from "react";
import { Platform, StyleSheet, View } from "react-native";
import { Tabs } from "expo-router";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "@/src/theme";

// Note: NativeTabs (iOS 26 liquid glass) could be gated here; we use the classic
// styled Tabs everywhere for a consistent tactical glass bar across platforms.

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brandPrimary,
        tabBarInactiveTintColor: colors.onSurfaceSecondary,
        tabBarLabelStyle: { fontFamily: fonts.semibold, fontSize: 10, letterSpacing: 0.5 },
        tabBarItemStyle: { alignSelf: "center" },
        tabBarStyle: {
          position: "absolute",
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.border,
          backgroundColor: Platform.OS === "android" ? colors.surfaceSecondary : "transparent",
          elevation: 0,
          ...(Platform.OS === "web" ? { height: 64 } : {}),
        },
        tabBarBackground: () =>
          Platform.OS === "ios" ? (
            <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.surfaceSecondary }]} />
          ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Comando",
          tabBarIcon: ({ color, size }) => <Ionicons name="flame" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="workouts"
        options={{
          title: "Treinos",
          tabBarIcon: ({ color, size }) => <Ionicons name="bicycle" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="nutrition"
        options={{
          title: "Nutrição",
          tabBarIcon: ({ color, size }) => <Ionicons name="restaurant" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="coach"
        options={{
          title: "Coach",
          tabBarIcon: ({ color, size }) => <Ionicons name="skull" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
