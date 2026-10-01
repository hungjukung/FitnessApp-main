import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { WorkoutSet } from '../../types';
import { useTimeBasedTheme } from '../../stores/themeStore';
import { Spacing, Radius, Typography } from '../../constants/theme';

interface SetInputRowProps {
  set: WorkoutSet;
  onChange: (updated: WorkoutSet) => void;
  onDelete: () => void;
}

export function SetInputRow({ set, onChange, onDelete }: SetInputRowProps) {
  const theme = useTimeBasedTheme();

  const handleRepsChange = (text: string) => {
    const reps = parseInt(text.replace(/[^0-9]/g, ''), 10);
    onChange({ ...set, reps: isNaN(reps) ? undefined : reps });
  };

  const handleWeightChange = (text: string) => {
    const clean = text.replace(',', '.').replace(/[^0-9.]/g, '');
    const weight = parseFloat(clean);
    onChange({ ...set, weight: isNaN(weight) ? undefined : weight });
  };

  return (
    <View style={styles.row}>
      {/* Set number badge */}
      <View style={[styles.setNum, { backgroundColor: theme.primary + '22' }]}>
        <Text style={[styles.setNumText, { color: theme.primary }]}>{set.setNumber}</Text>
      </View>

      {/* Weight input */}
      <View style={[styles.inputWrap, { borderColor: theme.border, backgroundColor: theme.surface }]}>
        <TextInput
          value={set.weight !== undefined ? String(set.weight) : ''}
          onChangeText={handleWeightChange}
          keyboardType="decimal-pad"
          placeholder="0"
          placeholderTextColor={theme.textTertiary}
          style={[styles.input, { color: theme.textPrimary }]}
          maxLength={6}
        />
        <Text style={[styles.unit, { color: theme.textSecondary }]}>kg</Text>
      </View>

      <Text style={[styles.cross, { color: theme.textTertiary }]}>×</Text>

      {/* Reps input */}
      <View style={[styles.inputWrap, { borderColor: theme.border, backgroundColor: theme.surface }]}>
        <TextInput
          value={set.reps !== undefined ? String(set.reps) : ''}
          onChangeText={handleRepsChange}
          keyboardType="number-pad"
          placeholder="0"
          placeholderTextColor={theme.textTertiary}
          style={[styles.input, { color: theme.textPrimary }]}
          maxLength={3}
        />
        <Text style={[styles.unit, { color: theme.textSecondary }]}>次</Text>
      </View>

      {/* Delete button */}
      <TouchableOpacity onPress={onDelete} style={styles.deleteBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Text style={{ color: theme.textTertiary, fontSize: 18 }}>✕</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  setNum: {
    width: 28,
    height: 28,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  setNumText: {
    fontSize: Typography.size.sm,
    fontWeight: Typography.weight.bold,
  },
  inputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    gap: 4,
  },
  input: {
    flex: 1,
    fontSize: Typography.size.md,
    fontWeight: Typography.weight.semibold,
    textAlign: 'right',
    minHeight: 32,
  },
  unit: {
    fontSize: Typography.size.sm,
  },
  cross: {
    fontSize: Typography.size.md,
  },
  deleteBtn: {
    padding: 4,
  },
});
