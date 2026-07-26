// ─────────────────────────────────────────────
//  db.js — IndexedDB order history (client-only, no accounts)
// ─────────────────────────────────────────────

const DB_NAME = "scriptorium_db";
const DB_VERSION = 1;
const STORE_ORDERS = "orders";

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_ORDERS)) {
        const store = db.createObjectStore(STORE_ORDERS, { keyPath: "orderId" });
        store.createIndex("createdAt", "createdAt", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveOrderLocally(order) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_ORDERS, "readwrite");
    tx.objectStore(STORE_ORDERS).put(order);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

async function getAllLocalOrders() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_ORDERS, "readonly");
    const req = tx.objectStore(STORE_ORDERS).getAll();
    req.onsuccess = () => resolve((req.result || []).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
    req.onerror = () => reject(req.error);
  });
}

async function clearAllLocalData() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_ORDERS, "readwrite");
    tx.objectStore(STORE_ORDERS).clear();
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}
