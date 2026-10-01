/**
 * 飲食拍照辨識
 *
 * 1. 拍照或從相簿選一張食物照片
 * 2. 壓縮後送後端 /ai/analyze-food 讓 xAI Grok 估算熱量與營養素
 * 3. 結果只是草稿：帶進 DietEntrySheet 讓使用者確認、修改後才存檔
 *
 * 照片只用於這次分析，不會存進 App 或相簿。
 */
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

/** 比後端 Grok 逾時（20 秒）稍長，讓後端有機會先回錯誤 */
const ANALYZE_TIMEOUT_MS = 25_000;

/** 與後端 FOOD_LIMITS 相同 */
const KCAL_MAX = 5000;
const MACRO_MAX_G = 500;

export type PhotoSource = 'camera' | 'library';

export interface FoodPhotoItem {
  name: string;
  portion: string;
  kcal: number;
}

export interface FoodPhotoResult {
  name: string;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  items: FoodPhotoItem[];
}

/** 給使用者看的錯誤 */
export class FoodPhotoError extends Error {}

/** 取得照片；使用者取消時回傳 null */
export async function pickFoodPhoto(source: PhotoSource): Promise<string | null> {
  const permission =
    source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (permission.status !== 'granted') {
    throw new FoodPhotoError(source === 'camera' ? '需要相機權限才能拍照' : '需要相簿權限才能選照片');
  }

  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1 };
  const result =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);

  if (result.canceled || !result.assets[0]) return null;
  return result.assets[0].uri;
}

function toNumber(v: unknown, max: number): number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.min(v, max) : 0;
}

/** 後端回傳的資料一律再驗證一次 */
function parseResult(raw: unknown): FoodPhotoResult {
  const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  if (obj.isFood !== true) {
    throw new FoodPhotoError('照片裡好像沒有食物，換個角度再拍一次');
  }

  const items: FoodPhotoItem[] = Array.isArray(obj.items)
    ? obj.items
        .filter((i): i is Record<string, unknown> => !!i && typeof i === 'object')
        .map((i) => ({
          name: typeof i.name === 'string' ? i.name : '',
          portion: typeof i.portion === 'string' ? i.portion : '',
          kcal: toNumber(i.kcal, KCAL_MAX),
        }))
        .filter((i) => i.name !== '')
    : [];

  return {
    name: typeof obj.name === 'string' ? obj.name.slice(0, 40) : '',
    kcal: Math.round(toNumber(obj.kcal, KCAL_MAX)),
    proteinG: Math.round(toNumber(obj.proteinG, MACRO_MAX_G)),
    carbsG: Math.round(toNumber(obj.carbsG, MACRO_MAX_G)),
    fatG: Math.round(toNumber(obj.fatG, MACRO_MAX_G)),
    items,
  };
}

export async function analyzeFoodPhoto(uri: string): Promise<FoodPhotoResult> {
  // 768px 寬足夠辨識食物，又能控制上傳大小
  const compressed = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 768 } }],
    { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
  );
  const imageBase64 = await FileSystem.readAsStringAsync(compressed.uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  FileSystem.deleteAsync(compressed.uri, { idempotent: true }).catch(() => {});

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ANALYZE_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}/ai/analyze-food`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64 }),
      signal: controller.signal,
    });
  } catch {
    throw new FoodPhotoError('連不上伺服器，請確認後端已啟動，或改用手動輸入');
  } finally {
    clearTimeout(timer);
  }

  const data: unknown = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = (data as { message?: unknown }).message;
    throw new FoodPhotoError(typeof message === 'string' ? message : 'AI 辨識失敗，請改用手動輸入');
  }
  return parseResult(data);
}
