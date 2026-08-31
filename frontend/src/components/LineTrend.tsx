import React from "react";
import Svg, { Circle, Polyline } from "react-native-svg";

/**
 * Mini gráfico de linha (sparkline) para séries temporais curtas.
 * Normaliza os valores entre min/max e destaca o último ponto.
 * Compartilhado entre a aba Analytics e o modal de histórico de wearable na Home.
 */
export function LineTrend({
  points,
  colors,
  height = 110,
}: {
  points: { date: string; value: number }[];
  colors: any;
  height?: number;
}) {
  const W = 300;
  const H = height;
  const pad = 10;
  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const stepX = points.length > 1 ? (W - pad * 2) / (points.length - 1) : 0;
  const coords = points.map((p, i) => ({
    x: pad + i * stepX,
    y: pad + (1 - (p.value - min) / range) * (H - pad * 2),
  }));
  const poly = coords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ");
  const last = coords[coords.length - 1];
  return (
    <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
      <Polyline
        points={poly}
        fill="none"
        stroke={colors.accent}
        strokeWidth={2.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {last ? <Circle cx={last.x} cy={last.y} r={4} fill={colors.accent} /> : null}
    </Svg>
  );
}
