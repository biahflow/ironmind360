import React from "react";
import { View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { useTheme } from "@/src/context/ThemeContext";

type Props = {
  size?: number;
  strokeWidth?: number;
  progress: number;
  color?: string;
  trackColor?: string;
  children?: React.ReactNode;
};

export default function ProgressRing({
  size = 180,
  strokeWidth = 14,
  progress,
  color,
  trackColor,
  children,
}: Props) {
  const { colors } = useTheme();
  const stroke = color ?? colors.brandPrimary;
  const track = trackColor ?? colors.border;
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(1, progress));
  const offset = c * (1 - clamped);

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} style={{ position: "absolute" }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={strokeWidth} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={stroke}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      {children}
    </View>
  );
}
