/**
 * FitTrack AI — 體態照片 Repository（本地檔案系統版）
 * 已移除 Supabase Storage，改用 expo-file-system 本地儲存
 * 元資料存入本地 SQLite photo_logs 表
 */

import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { getDatabase } from './database';
import { PhotoLog } from '../types';
import { apiUploadPhoto, apiDeletePhoto, apiFetchPhotoMeta } from '../services/api/photoApi';
import { useUserStore } from '../stores/userStore';

const MAX_PHOTOS_PER_DAY = 4;
const MAX_IMAGE_EDGE_PX = 2048;
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

// 每個 userId 獨立的照片目錄
let _photoUserId: string | null = null;

export const setPhotoUser = (userId: string): void => {
  _photoUserId = userId;
};

const getPhotoDir = (): string => {
  if (!_photoUserId) throw new Error('Photo user not set. Call setPhotoUser() first.');
  return `${FileSystem.documentDirectory}body-photos/${_photoUserId}/`;
};

// ─────────────────────────────────────────────
// 初始化：確保目錄存在
// ─────────────────────────────────────────────

export const ensurePhotoDirExists = async (): Promise<void> => {
  const dir = getPhotoDir();
  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  }
};

// ─────────────────────────────────────────────
// 照片命名規則
// ─────────────────────────────────────────────

const buildFileName = (date: string, sortIndex: number): string =>
  sortIndex === 0 ? `${date}.jpg` : `${date}-${sortIndex}.jpg`;

// ─────────────────────────────────────────────
// 核心流程：拍攝 / 相簿選取並儲存至本地
// ─────────────────────────────────────────────

const assertCanAddPhoto = async (date: string): Promise<number> => {
  const existingCount = await getPhotoCountByDate(date);
  if (existingCount >= MAX_PHOTOS_PER_DAY) {
    throw new Error('今日照片已達 4 張上限');
  }
  return existingCount;
};

const buildResizeActions = (asset: ImagePicker.ImagePickerAsset): ImageManipulator.Action[] => {
  const { width, height } = asset;
  if (!width || !height) return [];
  const longest = Math.max(width, height);
  if (longest <= MAX_IMAGE_EDGE_PX) return [];
  return width >= height
    ? [{ resize: { width: MAX_IMAGE_EDGE_PX } }]
    : [{ resize: { height: MAX_IMAGE_EDGE_PX } }];
};

const compressToLimit = async (
  asset: ImagePicker.ImagePickerAsset
): Promise<ImageManipulator.ImageResult> => {
  const actions = buildResizeActions(asset);
  const qualities = [0.82, 0.7, 0.58, 0.45, 0.35];

  let latest: ImageManipulator.ImageResult | null = null;
  for (const quality of qualities) {
    latest = await ImageManipulator.manipulateAsync(asset.uri, actions, {
      compress: quality,
      format: ImageManipulator.SaveFormat.JPEG,
    });
    const info = await FileSystem.getInfoAsync(latest.uri);
    const size = 'size' in info ? info.size ?? 0 : 0;
    if (size <= MAX_FILE_SIZE_BYTES) return latest;
  }

  if (!latest) throw new Error('照片處理失敗');
  const info = await FileSystem.getInfoAsync(latest.uri);
  const size = 'size' in info ? info.size ?? 0 : 0;
  if (size > MAX_FILE_SIZE_BYTES) {
    throw new Error('照片壓縮後仍超過 5 MB，請選擇較小的圖片');
  }
  return latest;
};

const savePickedAsset = async (
  date: string,
  asset: ImagePicker.ImagePickerAsset
): Promise<PhotoLog> => {
  await ensurePhotoDirExists();
  const sortIndex = await assertCanAddPhoto(date);
  const processed = await compressToLimit(asset);

  const fileName = buildFileName(date, sortIndex);
  const destUri = `${getPhotoDir()}${fileName}`;

  const db = getDatabase();
  const photoId = `photo_${Date.now()}_${sortIndex}`;
  const now = Date.now();

  try {
    await FileSystem.copyAsync({ from: processed.uri, to: destUri });
    await db.runAsync(
      `INSERT INTO photo_logs (id, date, file_uri, file_name, sort_index, created_at)
       VALUES (?, ?, ?, ?, ?, ?);`,
      [photoId, date, destUri, fileName, sortIndex, now],
    );

    // 僅在使用者明確開啟「照片雲端備份」時才上傳；預設不上傳（fire-and-forget）
    if (useUserStore.getState().profile.photoCloudSyncEnabled) {
      FileSystem.readAsStringAsync(destUri, { encoding: FileSystem.EncodingType.Base64 })
        .then(base64 => apiUploadPhoto({ id: photoId, date, fileName, sortIndex, createdAt: now, data: base64 }))
        .catch(() => {});
    }

    return {
      id: photoId,
      date,
      fileUri: destUri,
      fileName,
      sortIndex,
      createdAt: now,
    };
  } catch (error) {
    const copied = await FileSystem.getInfoAsync(destUri);
    if (copied.exists) {
      await FileSystem.deleteAsync(destUri, { idempotent: true });
    }
    throw new Error('儲存空間不足');
  }
};

export const captureAndSavePhoto = async (date: string): Promise<PhotoLog | null> => {
  // 請求相機權限
  const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
  if (permissionResult.status !== 'granted') {
    throw new Error('需要相機權限');
  }

  // 啟動相機
  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect: [3, 4],
    quality: 0.85,
  });

  if (result.canceled || !result.assets[0]) return null;

  return savePickedAsset(date, result.assets[0]);
};

export const pickAndSavePhoto = async (date: string): Promise<PhotoLog | null> => {
  const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (permissionResult.status !== 'granted') {
    throw new Error('需要相簿權限');
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect: [3, 4],
    quality: 1,
  });

  if (result.canceled || !result.assets[0]) return null;

  return savePickedAsset(date, result.assets[0]);
};

/**
 * 刪除所有已上傳至雲端的照片，本機檔案不受影響。
 * 使用者關閉「照片雲端備份」時呼叫，讓「照片不離開本機」成為真實狀態而非僅止於停止新上傳。
 * @returns 成功刪除的張數
 */
export const deleteAllRemotePhotos = async (): Promise<number> => {
  const remote = await apiFetchPhotoMeta();
  let deleted = 0;
  for (const photo of remote) {
    try {
      await apiDeletePhoto(photo.id);
      deleted += 1;
    } catch {
      // 個別失敗不中斷其餘刪除，最終張數會反映實際結果
    }
  }
  return deleted;
};

// ─────────────────────────────────────────────
// CRUD 操作
// ─────────────────────────────────────────────

/** 取得某日所有照片 */
export const getPhotosByDate = async (date: string): Promise<PhotoLog[]> => {
  const db = getDatabase();

  const rows = await db.getAllAsync<{
    id: string; date: string; file_uri: string;
    file_name: string; sort_index: number; created_at: number;
  }>(
    'SELECT * FROM photo_logs WHERE date = ? ORDER BY sort_index ASC;',
    [date],
  );

  return rows.map((r) => ({
    id:        r.id,
    date:      r.date,
    fileUri:   r.file_uri,
    fileName:  r.file_name,
    sortIndex: r.sort_index,
    createdAt: r.created_at,
  }));
};

/** 取得某日照片數量 */
export const getPhotoCountByDate = async (date: string): Promise<number> => {
  const db = getDatabase();
  const row = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM photo_logs WHERE date = ?;',
    [date],
  );
  return row?.count ?? 0;
};

/** 取得所有有照片的日期（用於日曆照片標記） */
export const getAllPhotoDates = async (): Promise<string[]> => {
  const db = getDatabase();
  const rows = await db.getAllAsync<{ date: string }>(
    'SELECT DISTINCT date FROM photo_logs ORDER BY date DESC;',
  );
  return rows.map((r) => r.date);
};

/** 刪除某張照片（同時刪除本地檔案） */
export const deletePhoto = async (photoId: string): Promise<void> => {
  const db = getDatabase();

  const row = await db.getFirstAsync<{ file_uri: string }>(
    'SELECT file_uri FROM photo_logs WHERE id = ?;',
    [photoId],
  );

  if (row?.file_uri) {
    const info = await FileSystem.getInfoAsync(row.file_uri);
    if (info.exists) {
      await FileSystem.deleteAsync(row.file_uri, { idempotent: true });
    }
  }

  await db.runAsync('DELETE FROM photo_logs WHERE id = ?;', [photoId]);
  apiDeletePhoto(photoId).catch(() => {});
  console.log(`[PhotoRepo] Deleted photo: ${photoId}`);
};

/** 清除目前使用者的所有照片檔與照片 metadata */
export const clearAllPhotos = async (): Promise<void> => {
  const dir = getPhotoDir();
  const info = await FileSystem.getInfoAsync(dir);
  if (info.exists) {
    await FileSystem.deleteAsync(dir, { idempotent: true });
  }
  await ensurePhotoDirExists();
};

/** 取得最新一張體態照的本地 URI（供 AI 使用） */
export const getLatestPhotoUri = async (): Promise<string | null> => {
  const db = getDatabase();

  const row = await db.getFirstAsync<{ file_uri: string }>(
    'SELECT file_uri FROM photo_logs ORDER BY created_at DESC LIMIT 1;',
  );

  return row?.file_uri ?? null;
};
