// Хранилище: Postgres (DATABASE_URL, например Neon) — таблица store_kv.
// Без DATABASE_URL (локальная проверка, тесты) — временное хранилище в памяти.
// Интерфейс: get(key), setJSON(key, value), delete(key), list({prefix}).
import { readFile } from "node:fs/promises";

let poolPromise;
async function pool() {
  poolPromise ??= (async () => {
    const { default: pg } = await import("pg");
    const p = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 5, idleTimeoutMillis: 30000, ssl: { rejectUnauthorized: true } });
    const schema = await readFile(new URL("../db/schema.sql", import.meta.url), "utf8");
    await p.query(schema);
    return p;
  })().catch((e) => { poolPromise = undefined; throw e; });
  return poolPromise;
}

function sqlStore(name) {
  const q = async (text, params) => (await pool()).query(text, params);
  return {
    get: async (key) => (await q("select value from store_kv where bucket=$1 and key=$2", [name, key])).rows[0]?.value ?? null,
    setJSON: async (key, value) => {
      await q(`insert into store_kv (bucket, key, value) values ($1, $2, $3)
               on conflict (bucket, key) do update set value = excluded.value, updated_at = now()`, [name, key, JSON.stringify(value)]);
    },
    delete: async (key) => { await q("delete from store_kv where bucket=$1 and key=$2", [name, key]); },
    list: async ({ prefix = "" } = {}) => {
      const r = await q("select key from store_kv where bucket=$1 and starts_with(key, $2) order by updated_at limit 2000", [name, prefix]);
      return { blobs: r.rows.map(({ key }) => ({ key })) };
    },
  };
}

const mem = new Map();
function memStore(name) {
  if (!mem.has(name)) mem.set(name, new Map());
  const m = mem.get(name);
  return {
    get: async (k) => (m.has(k) ? structuredClone(m.get(k)) : null),
    setJSON: async (k, v) => { m.delete(k); m.set(k, structuredClone(v)); },
    delete: async (k) => { m.delete(k); },
    list: async ({ prefix = "" } = {}) => ({ blobs: [...m.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })) }),
  };
}

export function getStore(name) {
  return process.env.DATABASE_URL ? sqlStore(name) : memStore(name);
}

export const warmUp = () => (process.env.DATABASE_URL ? pool() : Promise.resolve());
