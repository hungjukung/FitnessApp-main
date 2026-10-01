/**
 * WeightBarChart — 體重長條圖（react-native-svg 版本）
 * Expo Go 相容，不需要 Skia 或 Worklets
 */
import { useState } from 'react';
import { View, Text, StyleSheet, LayoutChangeEvent } from 'react-native';
import Svg, {
  Rect,
  Line,
  Text as SvgText,
  G,
} from 'react-native-svg';
import { ChartDataPoint } from '../../types';
import { useTimeBasedTheme } from '../../stores/themeStore';
import { OkabeIto, Spacing } from '../../constants/theme';
import { ThemedText } from '../common/ThemedText';

interface WeightBarChartProps {
  data: ChartDataPoint[];
  height?: number;
}

const PAD = { top: 16, bottom: 36, left: 42, right: 8 };

export function WeightBarChart({ data, height = 220 }: WeightBarChartProps) {
  const theme = useTimeBasedTheme();
  const [svgWidth, setSvgWidth] = useState(320);

  const validData = data.filter((d) => d.weightValue !== null);

  if (validData.length === 0) {
    return (
      <View style={[styles.empty, { height }]}>
        <Text style={{ fontSize: 32 }}>📊</Text>
        <ThemedText variant="caption" color="tertiary" center>
          尚無足夠數據{'\n'}記錄更多天數後顯示圖表
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

  const weights = validData.map((d) => d.weightValue as number);
  const minW = Math.min(...weights);
  const maxW = Math.max(...weights);
  const wRange = Math.max(1, maxW - minW);
  const domainMin = minW - wRange * 0.15;
  const domainMax = maxW + wRange * 0.15;

  // Y-axis ticks
  const yTicks = 4;
  const showEvery = Math.max(1, Math.ceil(data.length / 8));
  const barPad = 2;
  const barW = Math.max(3, chartW / Math.max(1, data.length) - barPad);

  const toY = (val: number) =>
    PAD.top + chartH - ((val - domainMin) / (domainMax - domainMin)) * chartH;

  return (
    <View style={{ height }} onLayout={onLayout}>
      <Svg width={svgWidth} height={height}>
        {/* Y-axis grid lines */}
        {Array.from({ length: yTicks + 1 }).map((_, i) => {
          const frac = i / yTicks;
          const val = domainMin + frac * (domainMax - domainMin);
          const y = PAD.top + chartH * (1 - frac);
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
                fontSize={10}
                fill={theme.textTertiary}
              >
                {val.toFixed(1)}
              </SvgText>
            </G>
          );
        })}

        {/* Bars + X labels */}
        {data.map((d, i) => {
          const cx = PAD.left + (i + 0.5) * (chartW / data.length);
          const x = cx - barW / 2;

          return (
            <G key={i}>
              {d.weightValue !== null && (
                <Rect
                  x={x}
                  y={toY(d.weightValue)}
                  width={barW}
                  height={Math.max(2, chartH - (toY(d.weightValue) - PAD.top))}
                  fill={OkabeIto.skyBlue}
                  rx={2}
                  ry={2}
                  opacity={0.85}
                />
              )}
              {i % showEvery === 0 && (
                <SvgText
                  x={cx}
                  y={height - 6}
                  textAnchor="middle"
                  fontSize={9}
                  fill={theme.textTertiary}
                >
                  {d.timeLabel}
                </SvgText>
              )}
            </G>
          );
        })}

        {/* X bottom axis */}
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
