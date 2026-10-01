/**
 * WeeklyDeltaLine — 週體重變化折線圖（react-native-svg 版本）
 * Expo Go 相容，不需要 Skia 或 Worklets
 */
import { useState } from 'react';
import { View, Text, StyleSheet, LayoutChangeEvent } from 'react-native';
import Svg, {
  Polyline,
  Line,
  Circle,
  Text as SvgText,
  G,
  Defs,
  LinearGradient,
  Stop,
  Path,
} from 'react-native-svg';
import { ChartDataPoint } from '../../types';
import { useTimeBasedTheme } from '../../stores/themeStore';
import { OkabeIto, Spacing } from '../../constants/theme';
import { ThemedText } from '../common/ThemedText';

interface WeeklyDeltaLineProps {
  data: ChartDataPoint[];
  height?: number;
}

const PAD = { top: 20, bottom: 36, left: 46, right: 12 };

export function WeeklyDeltaLine({ data, height = 180 }: WeeklyDeltaLineProps) {
  const theme = useTimeBasedTheme();
  const [svgWidth, setSvgWidth] = useState(320);

  const hasDeltas = data.some((d) => d.weeklyDelta !== null);

  if (!hasDeltas || data.length < 2) {
    return (
      <View style={[styles.empty, { height }]}>
        <Text style={{ fontSize: 32 }}>📈</Text>
        <ThemedText variant="caption" color="tertiary" center>
          需要至少 2 週數據{'\n'}才能計算週變化趨勢
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

  const deltas = data
    .filter((d) => d.weeklyDelta !== null)
    .map((d) => d.weeklyDelta as number);

  const minD = Math.min(...deltas, -0.3);
  const maxD = Math.max(...deltas, 0.3);
  const dRange = Math.max(0.5, maxD - minD);
  const domainMin = minD - dRange * 0.2;
  const domainMax = maxD + dRange * 0.2;

  const toY = (val: number) =>
    PAD.top + chartH - ((val - domainMin) / (domainMax - domainMin)) * chartH;

  const zeroY = toY(0);

  const points = data
    .map((d, i) => {
      if (d.weeklyDelta === null) return null;
      const x = PAD.left + (i / Math.max(1, data.length - 1)) * chartW;
      const y = toY(d.weeklyDelta);
      return { x, y, delta: d.weeklyDelta, label: d.timeLabel };
    })
    .filter(Boolean) as Array<{ x: number; y: number; delta: number; label: string }>;

  const polylinePoints = points.map((p) => `${p.x},${p.y}`).join(' ');

  return (
    <View style={{ height }} onLayout={onLayout}>
      <Svg width={svgWidth} height={height}>
        {/* Y-axis ticks */}
        {[-1, -0.5, 0, 0.5, 1].map((val) => {
          if (val < domainMin || val > domainMax) return null;
          const y = toY(val);
          return (
            <G key={val}>
              <Line
                x1={PAD.left}
                y1={y}
                x2={svgWidth - PAD.right}
                y2={y}
                stroke={val === 0 ? theme.border : theme.separator}
                strokeWidth={val === 0 ? 1 : 0.5}
                strokeDasharray={val === 0 ? undefined : '3,3'}
              />
              <SvgText
                x={PAD.left - 4}
                y={y + 4}
                textAnchor="end"
                fontSize={10}
                fill={theme.textTertiary}
              >
                {val > 0 ? `+${val}` : val}
              </SvgText>
            </G>
          );
        })}

        {/* Line */}
        {points.length > 1 && (
          <Polyline
            points={polylinePoints}
            fill="none"
            stroke={OkabeIto.orange}
            strokeWidth={2.5}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}

        {/* Dots + labels */}
        {points.map((p, i) => (
          <G key={i}>
            <Circle
              cx={p.x}
              cy={p.y}
              r={4}
              fill={p.delta < 0 ? OkabeIto.bluishGreen : OkabeIto.orange}
              stroke={theme.sheetBackground}
              strokeWidth={1.5}
            />
            {/* X label */}
            <SvgText
              x={p.x}
              y={height - 6}
              textAnchor="middle"
              fontSize={9}
              fill={theme.textTertiary}
            >
              {p.label}
            </SvgText>
          </G>
        ))}
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
