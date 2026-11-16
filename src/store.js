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

// key: 'last' = モデル、'motion' = .vrma
export async function saveFile(file, key = 'last') {
  try {
    await run('readwrite', (s) => s.put({ name: file.name, blob: file }, key));
  } catch {}
}
export async function loadFile(key = 'last') {
  try {
    return (await run('readonly', (s) => s.get(key))) || null;
  } catch {
    return null;
  }
}
export async function clearFile(key = 'last') {
  try {
    await run('readwrite', (s) => s.delete(key));
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
