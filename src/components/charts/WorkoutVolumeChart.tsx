import { useState } from 'react';
import { View, StyleSheet, LayoutChangeEvent } from 'react-native';
import Svg, { Rect, Line, Text as SvgText, G } from 'react-native-svg';
import { WorkoutChartPoint } from '../../types';
import { useTimeBasedTheme } from '../../stores/themeStore';
import { OkabeIto, Spacing } from '../../constants/theme';
import { ThemedText } from '../common/ThemedText';

interface WorkoutVolumeChartProps {
  data: WorkoutChartPoint[];
  height?: number;
}

const PAD = { top: 16, bottom: 36, left: 52, right: 8 };

export function WorkoutVolumeChart({ data, height = 200 }: WorkoutVolumeChartProps) {
  const theme = useTimeBasedTheme();
  const [svgWidth, setSvgWidth] = useState(320);

  const validData = data.filter((d) => d.volume > 0);

  if (validData.length === 0) {
    return (
      <View style={[styles.empty, { height }]}>
        <ThemedText variant="caption" color="tertiary" center>
          記錄訓練後顯示訓練量趨勢
        </ThemedText>
      </View>
    );
  }

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0) setSvgWidth(w);
  };

  const chartW = svgWidth - PAD.left - PAD.right;
  const chartH = height - PAD.top - PAD.bottom;

  const maxVolume = Math.max(...data.map((d) => d.volume));
  const domainMax = maxVolume * 1.15;
  const barPad = 4;
  const barW = Math.max(6, chartW / Math.max(1, data.length) - barPad);

  const toY = (val: number) =>
    PAD.top + chartH - (val / domainMax) * chartH;

  const yTicks = 4;

  return (
    <View style={{ height }} onLayout={onLayout}>
      <Svg width={svgWidth} height={height}>
        {/* Y-axis grid + labels */}
        {Array.from({ length: yTicks + 1 }).map((_, i) => {
          const frac = i / yTicks;
          const val = frac * domainMax;
          const y = PAD.top + chartH * (1 - frac);
          const label = val >= 1000 ? `${(val / 1000).toFixed(1)}k` : String(Math.round(val));
          return (
            <G key={i}>
              <Line
                x1={PAD.left}
                y1={y}
                x2={svgWidth - PAD.right}
                y2={y}
                stroke={theme.separator}
                strokeWidth={0.7}
              />
              <SvgText
                x={PAD.left - 4}
                y={y + 4}
                textAnchor="end"
                fontSize={9}
                fill={theme.textTertiary}
              >
                {label}
              </SvgText>
            </G>
          );
        })}

        {/* Bars */}
        {data.map((d, i) => {
          const cx = PAD.left + (i + 0.5) * (chartW / data.length);
          const x = cx - barW / 2;
          const barHeight = Math.max(2, (d.volume / domainMax) * chartH);

          return (
            <G key={i}>
              <Rect
                x={x}
                y={toY(d.volume)}
                width={barW}
                height={barHeight}
                fill={OkabeIto.vermillion}
                rx={2}
                ry={2}
                opacity={0.85}
              />
              <SvgText
                x={cx}
                y={height - 6}
                textAnchor="middle"
                fontSize={9}
                fill={theme.textTertiary}
              >
                {d.weekLabel}
              </SvgText>
            </G>
          );
        })}

        {/* X baseline */}
        <Line
          x1={PAD.left}
          y1={PAD.top + chartH}
          x2={svgWidth - PAD.right}
          y2={PAD.top + chartH}
          stroke={theme.border}
          strokeWidth={1}
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
});
