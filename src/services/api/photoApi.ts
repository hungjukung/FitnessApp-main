import { authFetch } from './client';

export interface RemotePhotoMeta {
  id: string;
  date: string;
  fileName: string;
  sortIndex: number;
  createdAt: number;
}

export async function apiFetchPhotoMeta(): Promise<RemotePhotoMeta[]> {
  return authFetch<RemotePhotoMeta[]>('/users/me/photos');
}

export async function apiFetchPhotoData(id: string): Promise<string> {
  const res = await authFetch<{ data: string }>(`/users/me/photos/${id}/data`);
  return res.data;
}

export async function apiUploadPhoto(params: {
  id: string;
  date: string;
  fileName: string;
  sortIndex: number;
  createdAt: number;
  data: string;
}): Promise<void> {
  await authFetch('/users/me/photos', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function apiDeletePhoto(id: string): Promise<void> {
  await authFetch(`/users/me/photos/${id}`, { method: 'DELETE' });
}
