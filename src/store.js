// 最後に読み込んだモデル(ファイルそのもの)を IndexedDB に1つだけ保存。設定は localStorage。
const DB = 'nozokimado';
const STORE = 'model';

function open() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run(mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    t.oncomplete = () => resolve(req.result);
    t.onerror = () => reject(t.error);
  });
}

export async function saveModel(file) {
  try {
    await run('readwrite', (s) => s.put({ name: file.name, blob: file }, 'last'));
  } catch {}
}
export async function loadModel() {
  try {
    return (await run('readonly', (s) => s.get('last'))) || null;
  } catch {
    return null;
  }
}
export async function clearModel() {
  try {
    await run('readwrite', (s) => s.delete('last'));
  } catch {}
}

export function loadSettings(defaults) {
  try {
    return { ...defaults, ...JSON.parse(localStorage.getItem('nozokimado:settings') || '{}') };
  } catch {
    return { ...defaults };
  }
}
export function saveSettings(s) {
  try {
    localStorage.setItem('nozokimado:settings', JSON.stringify(s));
  } catch {}
}
