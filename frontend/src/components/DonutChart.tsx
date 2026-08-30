import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { fonts, type as tp } from "@/src/theme";
import { useTheme } from "@/src/context/ThemeContext";

type Segment = {
  value: number;
  color: string;
  label: string;
};

type Props = {
  size?: number;
  strokeWidth?: number;
  segments: Segment[];
  centerValue: string;
  centerLabel?: string;
};

export default function DonutChart({
  size = 160,
  strokeWidth = 14,
  segments,
  centerValue,
  centerLabel,
}: Props) {
  const { colors } = useTheme();
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  const total = segments.reduce((s, seg) => s + seg.value, 0) || 1;

  let accumulated = 0;
  const arcs = segments.map((seg) => {
    const pct = seg.value / total;
    const offset = c * (1 - pct);
    const rotation = -90 + (accumulated / total) * 360;
    accumulated += seg.value;
    return { ...seg, pct, offset, rotation };
  });

  return (
    <View style={{ alignItems: "center" }}>
      <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
        <Svg width={size} height={size} style={{ position: "absolute" }}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={colors.border}
            strokeWidth={strokeWidth}
            fill="none"
          />
          {arcs.map((arc, i) => (
            <Circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={r}
              stroke={arc.color}
              strokeWidth={strokeWidth}
              fill="none"
              strokeDasharray={c}
              strokeDashoffset={arc.offset}
              strokeLinecap="round"
              transform={`rotate(${arc.rotation} ${size / 2} ${size / 2})`}
            />
          ))}
        </Svg>
        <Text style={[styles.centerValue, { color: colors.onSurface }]}>{centerValue}</Text>
        {centerLabel && <Text style={[styles.centerLabel, { color: colors.onSurfaceSecondary }]}>{centerLabel}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  centerValue: {
    fontFamily: fonts.display,
    fontSize: tp["3xl"],
    lineHeight: tp["3xl"] + 2,
  },
  centerLabel: {
    fontFamily: fonts.medium,
    fontSize: tp.sm,
    marginTop: -2,
  },
});
