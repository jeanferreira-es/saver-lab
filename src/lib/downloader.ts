import { Directory, DownloadTask, File, Paths } from 'expo-file-system';
import { Album, Asset, requestPermissionsAsync } from 'expo-media-library';
import { useSyncExternalStore } from 'react';

import { downloadUrl, type MediaItem, type PostInfo } from './api';
import { removeEntry, updateEntry, upsertEntry, type HistoryEntry } from './history';
import { getSettings } from './settings';

const ALBUM_NAME = 'Saver Lab';

function downloadsDir() {
  const dir = new Directory(Paths.document, 'downloads');
  dir.create({ intermediates: true, idempotent: true });
  return dir;
}

export function entryKey(post: PostInfo, item: MediaItem) {
  return `${post.id}-${item.index}`;
}

export type DownloadState =
  /** `totalBytes` é null enquanto o servidor não informa o tamanho (Content-Length). */
  | { status: 'downloading'; bytesWritten: number; totalBytes: number | null }
  | { status: 'error'; error: unknown };

// Estado dos downloads fica fora das telas: trocar de aba ou de tela não
// interrompe nem perde o progresso.
let states: Record<string, DownloadState> = {};
const listeners = new Set<() => void>();

function setState(key: string, state: DownloadState | null) {
  const next = { ...states };
  if (state) next[key] = state;
  else delete next[key];
  states = next;
  listeners.forEach((l) => l());
}

export function useDownloadStates() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => states,
  );
}

/**
 * Inicia o download de um item sem bloquear quem chamou. Chamadas repetidas
 * para um item que já está baixando são ignoradas.
 */
export function startDownload(post: PostInfo, item: MediaItem) {
  const key = entryKey(post, item);
  if (states[key]?.status === 'downloading') return;
  setState(key, { status: 'downloading', bytesWritten: 0, totalBytes: null });
  downloadItem(post, item, (bytesWritten, totalBytes) =>
    setState(key, { status: 'downloading', bytesWritten, totalBytes }),
  )
    .then(() => setState(key, null))
    .catch((error) => {
      console.log('[download] erro ao baixar item', key, error);
      setState(key, { status: 'error', error });
    });
}

/**
 * Baixa um item do post para o armazenamento do app, registra no histórico
 * e (se habilitado) salva na galeria.
 *
 * No iOS a transferência roda numa sessão em segundo plano do sistema: continua
 * com o app minimizado, e o iOS acorda o app ao terminar para concluir o
 * histórico e a galeria. No Android continua enquanto o processo estiver vivo.
 */
async function downloadItem(
  post: PostInfo,
  item: MediaItem,
  onProgress?: (bytesWritten: number, totalBytes: number | null) => void,
): Promise<HistoryEntry> {
  const key = entryKey(post, item);
  const destination = new File(downloadsDir(), `${key}.${item.ext || 'mp4'}`);
  if (destination.exists) destination.delete();

  const task = new DownloadTask(await downloadUrl(post.url, item), destination, {
    deferBackgroundSessionCompletion: true,
    onProgress: ({ bytesWritten, totalBytes }) => onProgress?.(bytesWritten, totalBytes > 0 ? totalBytes : null),
  });
  const file = await task.downloadAsync();
  if (!file) throw new Error('Download interrompido.');

  try {
    const entry: HistoryEntry = {
      key,
      postUrl: post.url,
      author: post.author,
      caption: post.caption || post.title,
      type: item.type,
      fileUri: file.uri,
      thumbnail: item.thumbnail,
      duration: item.duration,
      sizeBytes: file.size ?? null,
      savedToGallery: false,
      createdAt: Date.now(),
    };
    await upsertEntry(entry);

    if ((await getSettings()).autoSaveToGallery) {
      try {
        await saveToGallery(entry);
        entry.savedToGallery = true;
      } catch {
        // Sem permissão: o arquivo continua disponível na aba Downloads.
      }
    }
    return entry;
  } finally {
    // Libera o iOS para suspender o app de novo depois do histórico e da galeria.
    await task.acknowledgeBackgroundCompletionAsync().catch(() => {});
  }
}

export async function saveToGallery(entry: HistoryEntry) {
  const { granted } = await requestPermissionsAsync(true);
  if (!granted) throw new Error('Permissão da galeria negada.');

  const album = await Album.get(ALBUM_NAME);
  if (album) {
    await Asset.create(entry.fileUri, album);
  } else {
    const asset = await Asset.create(entry.fileUri);
    await Album.create(ALBUM_NAME, [asset]);
  }
  await updateEntry(entry.key, { savedToGallery: true });
}

export async function deleteDownload(entry: HistoryEntry) {
  try {
    const file = new File(entry.fileUri);
    if (file.exists) file.delete();
  } finally {
    await removeEntry(entry.key);
  }
}
