import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'user-ids:v1';
// Os ids chegam de tudo que o site carrega (feed, comentários...): guarda só os mais recentes.
const MAX = 2000;

/**
 * Mapa usuário → id numérico do Instagram. O id nunca muda, e descobri-lo pelo
 * `web_profile_info` gasta um limite de consultas baixo (HTTP 429), então cada
 * id visto é guardado e reaproveitado.
 */
let ids: Record<string, string> = {};
let loading: Promise<void> | null = null;

function load() {
  loading ??= AsyncStorage.getItem(KEY)
    .then((raw) => {
      // O que foi anotado antes de terminar a leitura prevalece.
      ids = { ...(raw ? (JSON.parse(raw) as Record<string, string>) : {}), ...ids };
    })
    .catch(() => {});
  return loading;
}

export async function getUserId(username: string): Promise<string | null> {
  await load();
  return ids[username.toLowerCase()] ?? null;
}

export function rememberUserIds(found: Record<string, string>) {
  let changed = false;
  for (const [username, id] of Object.entries(found)) {
    const key = username.toLowerCase();
    if (!/^\d+$/.test(id) || ids[key] === id) continue;
    // Reinsere no fim: a ordem das chaves marca os mais recentes.
    delete ids[key];
    ids[key] = id;
    changed = true;
  }
  if (!changed) return;
  const keys = Object.keys(ids);
  keys.slice(0, Math.max(0, keys.length - MAX)).forEach((k) => delete ids[k]);
  load()
    .then(() => AsyncStorage.setItem(KEY, JSON.stringify(ids)))
    .catch(() => {});
}
