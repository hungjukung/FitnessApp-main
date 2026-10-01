/**
 * Settings Tab — 設定、AI 授權與資料生命週期
 */
import { useMemo, useState, useEffect } from 'react';
import {
  View,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  TextInput,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card } from '../../src/components/common/Card';
import { PrimaryButton } from '../../src/components/common/PrimaryButton';
import { ThemedText } from '../../src/components/common/ThemedText';
import { useTimeBasedTheme, useThemeStore } from '../../src/stores/themeStore';
import {
  useUserStore,
  GenderLabels,
  FitnessGoalLabels,
  ExperienceLevelLabels,
} from '../../src/stores/userStore';
import { ExperienceLevel, FitnessGoal, Gender, ThemeMode } from '../../src/types';
import { Spacing, Radius, BusinessRules } from '../../src/constants/theme';
import { clearLocalDatabase } from '../../src/db/database';
import { clearAllPhotos } from '../../src/db/photoRepository';
import { clearAITemporaryFiles } from '../../src/services/ai/AIServiceRouter';
import { LOCAL_USER_ID } from '../../src/constants/localUser';

const EXPERIENCE_OPTIONS: ExperienceLevel[] = ['beginner', 'intermediate', 'advanced'];
const GOAL_OPTIONS: FitnessGoal[] = ['fat_loss', 'muscle_gain', 'maintenance'];
const GENDER_OPTIONS: Gender[] = ['male', 'female', 'prefer_not_to_say'];
const THEME_OPTIONS: Array<{ value: ThemeMode; label: string }> = [
  { value: 'auto', label: '自動' },
  { value: 'light', label: '淺色' },
  { value: 'dark', label: '深色' },
];

function SettingRow({
  label,
  value,
  onPress,
  danger,
}: {
  label: string;
  value?: string;
  onPress?: () => void;
  danger?: boolean;
}) {
  const theme = useTimeBasedTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={0.7}
      style={[styles.row, { borderBottomColor: theme.separator }]}
    >
      <ThemedText
        variant="body"
        color={danger ? 'error' : 'primary'}
        style={{ flex: 1 }}
      >
        {label}
      </ThemedText>
      {value && (
        <ThemedText variant="body" color="secondary">
          {value}
        </ThemedText>
      )}
      {onPress && (
        <ThemedText variant="body" color="tertiary">
          {'>'}
        </ThemedText>
      )}
    </TouchableOpacity>
  );
}

function OptionChips<T extends string>({
  value,
  options,
  labels,
  onChange,
}: {
  value: T;
  options: T[];
  labels: Record<T, string>;
  onChange: (value: T) => void;
}) {
  const theme = useTimeBasedTheme();
  return (
    <View style={styles.chipRow}>
      {options.map((option) => {
        const active = option === value;
        return (
          <TouchableOpacity
            key={option}
            onPress={() => onChange(option)}
            style={[
              styles.chip,
              {
                backgroundColor: active ? theme.primary : theme.surface,
                borderColor: active ? theme.primary : theme.border,
              },
            ]}
          >
            <ThemedText
              variant="caption"
              bold={active}
              style={{ color: active ? '#fff' : theme.textSecondary }}
            >
              {labels[option]}
            </ThemedText>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function NumberField({
  label,
  value,
  unit,
  onChange,
}: {
  label: string;
  value: string;
  unit: string;
  onChange: (value: string) => void;
}) {
  const theme = useTimeBasedTheme();
  return (
    <View style={styles.field}>
      <ThemedText variant="label" color="secondary">
        {label}
      </ThemedText>
      <View style={[styles.inputWrap, { borderColor: theme.border, backgroundColor: theme.surface }]}>
        <TextInput
          value={value}
          onChangeText={(text: string) => onChange(text.replace(/[^0-9.]/g, ''))}
          keyboardType="decimal-pad"
          style={[styles.input, { color: theme.textPrimary }]}
        />
        <ThemedText variant="body" color="secondary">
          {unit}
        </ThemedText>
      </View>
    </View>
  );
}

const DAY_LABELS = ['日', '一', '二', '三', '四', '五', '六'];

function TimePickerRow({
  label,
  hour,
  minute,
  onChangeHour,
  onChangeMinute,
}: {
  label: string;
  hour: number;
  minute: number;
  onChangeHour: (h: number) => void;
  onChangeMinute: (m: number) => void;
}) {
  const theme = useTimeBasedTheme();
  const [hText, setHText] = useState(hour.toString().padStart(2, '0'));
  const [mText, setMText] = useState(minute.toString().padStart(2, '0'));

  useEffect(() => { setHText(hour.toString().padStart(2, '0')); }, [hour]);
  useEffect(() => { setMText(minute.toString().padStart(2, '0')); }, [minute]);

  const commitHour = () => {
    const v = parseInt(hText, 10);
    if (Number.isFinite(v) && v >= 0 && v <= 23) onChangeHour(v);
    else setHText(hour.toString().padStart(2, '0'));
  };
  const commitMinute = () => {
    const v = parseInt(mText, 10);
    if (Number.isFinite(v) && v >= 0 && v <= 59) onChangeMinute(v);
    else setMText(minute.toString().padStart(2, '0'));
  };

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
      <ThemedText variant="body" style={{ flex: 1 }}>{label}</ThemedText>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <TextInput
          value={hText}
          onChangeText={setHText}
          onBlur={commitHour}
          keyboardType="number-pad"
          maxLength={2}
          style={[styles.timeInput, { color: theme.textPrimary, borderColor: theme.border, backgroundColor: theme.surface }]}
        />
        <ThemedText variant="body" bold>:</ThemedText>
        <TextInput
          value={mText}
          onChangeText={setMText}
          onBlur={commitMinute}
          keyboardType="number-pad"
          maxLength={2}
          style={[styles.timeInput, { color: theme.textPrimary, borderColor: theme.border, backgroundColor: theme.surface }]}
        />
      </View>
    </View>
  );
}

export default function SettingsScreen() {
  const theme = useTimeBasedTheme();
  const { themeMode, setThemeMode } = useThemeStore();
  const { profile, updateProfile, setAIConsent, deleteUserData, initForUser, notificationSettings, updateNotificationSettings } = useUserStore();
  const [isEditing, setIsEditing] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  const [draftNickname, setDraftNickname] = useState(profile.nickname ?? '');
  const [draftExperience, setDraftExperience] = useState<ExperienceLevel>(
    profile.experienceLevel ?? 'beginner'
  );
  const [draftGoal, setDraftGoal] = useState<FitnessGoal>(profile.goal ?? 'fat_loss');
  const [draftGender, setDraftGender] = useState<Gender>(profile.gender ?? 'prefer_not_to_say');
  const [draftAge, setDraftAge] = useState(profile.age?.toString() ?? '');
  const [draftHeight, setDraftHeight] = useState(profile.heightCm?.toString() ?? '');
  const [draftGoalWeight, setDraftGoalWeight] = useState(profile.goalWeightKg?.toString() ?? '');

  const profileRows = useMemo(
    () => [
      ['暱稱', profile.nickname || '未設定'],
      ['健身資歷', profile.experienceLevel ? ExperienceLevelLabels[profile.experienceLevel] : '未設定'],
      ['健身目標', profile.goal ? FitnessGoalLabels[profile.goal] : '未設定'],
      ['性別', profile.gender ? GenderLabels[profile.gender] : '未設定'],
      ['年齡', profile.age ? `${profile.age} 歲` : '未設定'],
      ['身高', profile.heightCm ? `${profile.heightCm} cm` : '未設定'],
      ['初始體重', profile.initialWeightKg ? `${profile.initialWeightKg.toFixed(1)} kg` : '未設定'],
      ['目標體重', profile.goalWeightKg ? `${profile.goalWeightKg.toFixed(1)} kg` : '未設定'],
    ],
    [profile]
  );

  const startEditing = () => {
    setDraftNickname(profile.nickname ?? '');
    setDraftExperience(profile.experienceLevel ?? 'beginner');
    setDraftGoal(profile.goal ?? 'fat_loss');
    setDraftGender(profile.gender ?? 'prefer_not_to_say');
    setDraftAge(profile.age?.toString() ?? '');
    setDraftHeight(profile.heightCm?.toString() ?? '');
    setDraftGoalWeight(profile.goalWeightKg?.toString() ?? '');
    setIsEditing(true);
  };

  const saveProfile = () => {
    const trimmedNickname = draftNickname.trim();
    const age = Number(draftAge);
    const heightCm = Number(draftHeight);
    const goalWeightRaw = draftGoalWeight.trim();
    const goalWeightKg = goalWeightRaw === '' ? null : Number(goalWeightRaw);

    if (!trimmedNickname) {
      Alert.alert('請輸入暱稱');
      return;
    }

    if (
      !Number.isFinite(age) ||
      age < BusinessRules.age.min ||
      age > BusinessRules.age.max ||
      !Number.isFinite(heightCm) ||
      heightCm < BusinessRules.height.min ||
      heightCm > BusinessRules.height.max ||
      (goalWeightKg !== null && (
        !Number.isFinite(goalWeightKg) ||
        goalWeightKg < BusinessRules.weight.min ||
        goalWeightKg > BusinessRules.weight.max
      ))
    ) {
      Alert.alert(
        '資料範圍不正確',
        `年齡 ${BusinessRules.age.min}-${BusinessRules.age.max}，身高 ${BusinessRules.height.min}-${BusinessRules.height.max} cm，目標體重 ${BusinessRules.weight.min}-${BusinessRules.weight.max} kg（留空表示不設定）。`
      );
      return;
    }

    updateProfile({
      nickname: trimmedNickname,
      experienceLevel: draftExperience,
      goal: draftGoal,
      gender: draftGender,
      age,
      heightCm,
      goalWeightKg: goalWeightKg !== null ? Math.round(goalWeightKg * 10) / 10 : null,
    });
    setIsEditing(false);
  };

  const handlePrivacyPolicy = () => {
    Alert.alert(
      '隱私政策',
      'FitTrack AI v1.0 的體重、照片、AI 授權與建議資料都保存在本機 App 儲存空間。App 不提供登入、雲端同步或遙測上傳。',
      [
        { text: '關閉', style: 'cancel' },
        {
          text: '開啟線上政策',
          onPress: () => Alert.alert('目前離線，請稍後再試'),
        },
      ]
    );
  };

  const handleClearAllData = () => {
    Alert.alert(
      '清除所有資料',
      '將永久刪除這支手機上的所有紀錄（體重、飲食、訓練、照片、個人資料），且無法復原。確定繼續？',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '確認清除',
          style: 'destructive',
          onPress: async () => {
            setIsClearing(true);
            try {
              await clearLocalDatabase();
              await clearAllPhotos();
              await clearAITemporaryFiles();
              await deleteUserData(LOCAL_USER_ID);
              // deleteUserData 會重置成未綁定 ID 的預設資料，重新載入本機使用者才會繼續保存之後的修改
              await initForUser(LOCAL_USER_ID);
              Alert.alert('已清除', '所有資料已刪除。');
            } catch (e) {
              Alert.alert('清除失敗', e instanceof Error ? e.message : '請稍後再試');
            } finally {
              setIsClearing(false);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: theme.separator }]}>
        <ThemedText variant="title" bold>設定</ThemedText>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.sectionHeader}>
          <ThemedText variant="label" color="secondary">個人資料</ThemedText>
          <TouchableOpacity onPress={isEditing ? saveProfile : startEditing}>
            <ThemedText variant="body" bold style={{ color: theme.primary }}>
              {isEditing ? '儲存' : '編輯'}
            </ThemedText>
          </TouchableOpacity>
        </View>

        <Card variant="default" padding="sm">
          {isEditing ? (
            <View style={styles.editor}>
              <ThemedText variant="label" color="secondary">暱稱</ThemedText>
              <View style={[styles.inputWrap, { borderColor: theme.border, backgroundColor: theme.surface }]}>
                <TextInput
                  value={draftNickname}
                  onChangeText={(text) => setDraftNickname(text.slice(0, 20))}
                  placeholder="輸入暱稱"
                  placeholderTextColor={theme.textTertiary}
                  style={[styles.input, { color: theme.textPrimary }]}
                  maxLength={20}
                />
              </View>

              <ThemedText variant="label" color="secondary">健身資歷</ThemedText>
              <OptionChips
                value={draftExperience}
                options={EXPERIENCE_OPTIONS}
                labels={ExperienceLevelLabels}
                onChange={setDraftExperience}
              />
              <ThemedText variant="label" color="secondary">健身目標</ThemedText>
              <OptionChips
                value={draftGoal}
                options={GOAL_OPTIONS}
                labels={FitnessGoalLabels}
                onChange={setDraftGoal}
              />
              <ThemedText variant="label" color="secondary">性別</ThemedText>
              <OptionChips
                value={draftGender}
                options={GENDER_OPTIONS}
                labels={GenderLabels}
                onChange={setDraftGender}
              />
              <NumberField label="年齡" value={draftAge} unit="歲" onChange={setDraftAge} />
              <NumberField label="身高" value={draftHeight} unit="cm" onChange={setDraftHeight} />
              <NumberField label="目標體重（留空表示不設定）" value={draftGoalWeight} unit="kg" onChange={setDraftGoalWeight} />
              <View style={[styles.readonlyField, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <ThemedText variant="label" color="secondary">初始體重（唯讀）</ThemedText>
                <ThemedText variant="body" color="primary">
                  {profile.initialWeightKg ? `${profile.initialWeightKg.toFixed(1)} kg` : '未設定'}
                </ThemedText>
              </View>
              <PrimaryButton label="取消編輯" variant="ghost" onPress={() => setIsEditing(false)} />
            </View>
          ) : (
            profileRows.map(([label, value]) => (
              <SettingRow key={label} label={label} value={value} />
            ))
          )}
        </Card>

        <ThemedText variant="label" color="secondary" style={styles.sectionLabel}>
          外觀
        </ThemedText>
        <Card variant="default" padding="md">
          <View style={styles.themePicker}>
            {THEME_OPTIONS.map(({ value, label }) => {
              const active = themeMode === value;
              return (
                <TouchableOpacity
                  key={value}
                  onPress={() => setThemeMode(value)}
                  style={[
                    styles.themeBtn,
                    {
                      backgroundColor: active ? theme.primary : theme.surface,
                      borderColor: active ? theme.primary : theme.border,
                    },
                  ]}
                >
                  <ThemedText
                    variant="caption"
                    bold={active}
                    style={{ color: active ? '#fff' : theme.textSecondary }}
                  >
                    {label}
                  </ThemedText>
                </TouchableOpacity>
              );
            })}
          </View>
        </Card>

        <ThemedText variant="label" color="secondary" style={styles.sectionLabel}>
          AI 授權
        </ThemedText>
        <Card variant="default" padding="md">
          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <ThemedText variant="body" bold>允許本機 AI 截圖解析</ThemedText>
              <ThemedText variant="caption" color="secondary" style={{ marginTop: 4 }}>
                關閉後 AI 截圖解析入口會停用；已確認保存的體重紀錄不會被刪除。
              </ThemedText>
            </View>
            <Switch
              value={profile.aiConsentGiven}
              onValueChange={(enabled: boolean) => {
                setAIConsent(enabled);
                if (!enabled) void clearAITemporaryFiles();
              }}
              trackColor={{ false: theme.disabled, true: theme.primary + '88' }}
              thumbColor={profile.aiConsentGiven ? theme.primary : '#f4f3f4'}
            />
          </View>
        </Card>

        <ThemedText variant="label" color="secondary" style={styles.sectionLabel}>
          照片隱私
        </ThemedText>
        <Card variant="default" padding="md">
          <ThemedText variant="body" bold>體態照片只存在這支手機</ThemedText>
          <ThemedText variant="caption" color="secondary" style={{ marginTop: 4 }}>
            App 不提供登入與雲端備份，照片不會上傳到任何伺服器。
          </ThemedText>
        </Card>

        {/* 通知設定 */}
        <ThemedText variant="label" color="secondary" style={styles.sectionLabel}>
          通知
        </ThemedText>
        <Card variant="default" padding="md" style={{ gap: Spacing.md }}>
          {/* 體重提醒 */}
          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <ThemedText variant="body" bold>每日體重提醒</ThemedText>
              <ThemedText variant="caption" color="secondary" style={{ marginTop: 2 }}>
                固定時間提醒你記錄體重
              </ThemedText>
            </View>
            <Switch
              value={notificationSettings.weightReminderEnabled}
              onValueChange={(v) => updateNotificationSettings({ weightReminderEnabled: v })}
              trackColor={{ false: theme.disabled, true: theme.primary + '88' }}
              thumbColor={notificationSettings.weightReminderEnabled ? theme.primary : '#f4f3f4'}
            />
          </View>
          {notificationSettings.weightReminderEnabled && (
            <TimePickerRow
              label="提醒時間"
              hour={notificationSettings.weightReminderHour}
              minute={notificationSettings.weightReminderMinute}
              onChangeHour={(h) => updateNotificationSettings({ weightReminderHour: h })}
              onChangeMinute={(m) => updateNotificationSettings({ weightReminderMinute: m })}
            />
          )}

          <View style={[styles.dividerThin, { backgroundColor: theme.separator }]} />

          {/* 訓練提醒 */}
          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <ThemedText variant="body" bold>訓練日提醒</ThemedText>
              <ThemedText variant="caption" color="secondary" style={{ marginTop: 2 }}>
                指定星期幾提醒你去訓練
              </ThemedText>
            </View>
            <Switch
              value={notificationSettings.workoutReminderEnabled}
              onValueChange={(v) => updateNotificationSettings({ workoutReminderEnabled: v })}
              trackColor={{ false: theme.disabled, true: theme.primary + '88' }}
              thumbColor={notificationSettings.workoutReminderEnabled ? theme.primary : '#f4f3f4'}
            />
          </View>
          {notificationSettings.workoutReminderEnabled && (
            <>
              <View style={{ gap: 8 }}>
                <ThemedText variant="caption" color="secondary">提醒日</ThemedText>
                <View style={styles.dayChipRow}>
                  {DAY_LABELS.map((label, idx) => {
                    const active = notificationSettings.workoutReminderDays.includes(idx);
                    return (
                      <TouchableOpacity
                        key={idx}
                        onPress={() => {
                          const days = active
                            ? notificationSettings.workoutReminderDays.filter(d => d !== idx)
                            : [...notificationSettings.workoutReminderDays, idx].sort();
                          updateNotificationSettings({ workoutReminderDays: days });
                        }}
                        style={[
                          styles.dayChip,
                          { backgroundColor: active ? theme.primary : theme.surface, borderColor: active ? theme.primary : theme.border },
                        ]}
                      >
                        <ThemedText
                          variant="caption"
                          bold={active}
                          style={{ color: active ? '#fff' : theme.textSecondary }}
                        >
                          {label}
                        </ThemedText>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
              <TimePickerRow
                label="提醒時間"
                hour={notificationSettings.workoutReminderHour}
                minute={notificationSettings.workoutReminderMinute}
                onChangeHour={(h) => updateNotificationSettings({ workoutReminderHour: h })}
                onChangeMinute={(m) => updateNotificationSettings({ workoutReminderMinute: m })}
              />
            </>
          )}
        </Card>

        <ThemedText variant="label" color="secondary" style={styles.sectionLabel}>
          關於
        </ThemedText>
        <Card variant="default" padding="sm">
          <SettingRow label="App 版本" value="1.0.0" />
          <SettingRow label="隱私政策" onPress={handlePrivacyPolicy} />
        </Card>

        <ThemedText variant="label" color="error" style={styles.sectionLabel}>
          危險區
        </ThemedText>
        <Card variant="outlined" padding="sm" style={{ borderColor: theme.error + '50' }}>
          <SettingRow
            label={isClearing ? '清除中...' : '清除所有資料'}
            onPress={isClearing ? undefined : handleClearAllData}
            danger
          />
        </Card>

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderBottomWidth: 0.5,
  },
  scrollContent: {
    padding: Spacing.xl,
    gap: Spacing.sm,
  },
  sectionHeader: {
    marginTop: Spacing.md,
    marginBottom: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionLabel: {
    marginTop: Spacing.md,
    marginBottom: Spacing.xs,
    paddingHorizontal: Spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    gap: Spacing.md,
    borderBottomWidth: 0.5,
  },
  editor: {
    gap: Spacing.md,
    padding: Spacing.sm,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  chip: {
    borderWidth: 1.5,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  field: {
    gap: 6,
  },
  readonlyField: {
    gap: 4,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
    opacity: 0.6,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  input: {
    flex: 1,
    minHeight: 48,
    fontSize: 16,
    fontWeight: '600',
  },
  themePicker: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  themeBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderRadius: Radius.full,
    borderWidth: 1.5,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  dividerThin: {
    height: 0.5,
    marginVertical: Spacing.xs,
  },
  dayChipRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
    flexWrap: 'wrap',
  },
  dayChip: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeInput: {
    width: 40,
    textAlign: 'center',
    borderWidth: 1,
    borderRadius: Radius.sm,
    paddingVertical: 4,
    fontSize: 16,
    fontWeight: '600',
  },
});
