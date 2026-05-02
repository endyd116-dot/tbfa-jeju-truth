// netlify/functions/data.mjs (전체 복사해서 덮어쓰기)
import { getStore } from "@netlify/blobs";
import {
  seedMilestones,
  seedSuspicions,
  seedTimeline,
  seedComparisons,
  seedContentManagement
} from "../../data.js";

const STORE_NAME = "truth-jeju";

// 동일 Function 인스턴스 내에서 같은 key 에 대한 동시 read-modify-write 충돌을 방지하기 위한 in-process 직렬화 락.
// 두 개 이상의 인스턴스가 떠 있을 때까지는 막지 못하지만, 단일 인스턴스에서 발생하던 "삭제한 항목이 다시 살아나거나 새로 추가한 항목이 사라지는" 문제는 제거됩니다.
const keyLocks = new Map();
function withKeyLock(key, fn) {
  const prev = keyLocks.get(key) || Promise.resolve();
  const next = prev.then(fn, fn);
  keyLocks.set(key, next.catch(() => {}));
  return next;
}

const VALID_TYPES = [
  'milestone', 'suspicion', 'timeline', 'comparison',
  'contentManagement', 'accounts', 'logs', 'sessions'
];

const DISPLAY_CONFIG_KEY = 'displayConfig';
const DEFAULT_DISPLAY_CONFIG = {
  milestoneSort: 'desc',
  timelineSort: 'desc'
};

const DEFAULT_ACCOUNTS = [
  { id: 'admin', pw: '1234', name: '슈퍼 관리자', role: 'super', permissions: ['all'], lastLogin: '-' },
  { id: 'staff_1', pw: '1234', name: '콘텐츠 운영팀', role: 'staff', permissions: ['milestone', 'timeline', 'suspicion', 'comparison', 'contentManagement'], lastLogin: '-' }
];

function generateSeedSessions() {
  const now = Date.now();
  const dayMs = 86400 * 1000;
  const seed = [];
  const users = ['admin', 'staff_1'];
  const dailyAvgSeconds = [180, 240, 420, 360, 540, 480, 620];
  for (let d = 6; d >= 0; d--) {
    const dayStart = now - d * dayMs;
    const sessionsCount = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < sessionsCount; i++) {
      const targetAvg = dailyAvgSeconds[6 - d];
      const dur = Math.floor(targetAvg * (0.5 + Math.random()));
      const start = dayStart - Math.floor(Math.random() * dayMs * 0.8);
      seed.push({
        id: 'sess_seed_' + d + '_' + i,
        userId: users[Math.floor(Math.random() * users.length)],
        startTs: start,
        endTs: start + dur * 1000,
        duration: dur
      });
    }
  }
  return seed;
}

const SEED_MAP = {
  milestone: () => seedMilestones,
  suspicion: () => seedSuspicions,
  timeline: () => seedTimeline,
  comparison: () => seedComparisons,
  contentManagement: () => seedContentManagement,
  accounts: () => DEFAULT_ACCOUNTS,
  logs: () => [],
  sessions: generateSeedSessions
};

// [수정된 부분] 데이터가 null일 때만 초기 시드 삽입, 잘못된 형태면 빈 배열 반환
async function loadData(store, type) {
  let data = await store.get(type, { type: 'json' });

  if (data === null) {
    data = SEED_MAP[type] ? SEED_MAP[type]() : [];
    await store.setJSON(type, data);
  }

  if (!Array.isArray(data)) {
      return [];
  }

  return data;
}

async function loadDisplayConfig(store) {
  let cfg = await store.get(DISPLAY_CONFIG_KEY, { type: 'json' });
  if (!cfg || typeof cfg !== 'object' || Array.isArray(cfg)) {
    cfg = { ...DEFAULT_DISPLAY_CONFIG };
    await store.setJSON(DISPLAY_CONFIG_KEY, cfg);
  }
  return { ...DEFAULT_DISPLAY_CONFIG, ...cfg };
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    }
  });
}

export default async (req) => {
  try {
    // 강한 일관성으로 읽기: 직전 쓰기가 즉시 후속 read 에 보이도록 보장
    const store = getStore({ name: STORE_NAME, consistency: 'strong' });

    if (req.method === 'GET') {
      const result = {};
      for (const type of VALID_TYPES) {
        result[type] = await loadData(store, type);
      }
      result.displayConfig = await loadDisplayConfig(store);
      return jsonResponse(result);
    }

    if (req.method === 'POST') {
      const body = await req.json();
      const { action, type } = body;

      if (action === 'setDisplayConfig') {
        return jsonResponse(await withKeyLock(DISPLAY_CONFIG_KEY, async () => {
          const current = await loadDisplayConfig(store);
          const next = { ...current, ...(body.config || {}) };
          await store.setJSON(DISPLAY_CONFIG_KEY, next);
          return { displayConfig: next };
        }));
      }

      if (action === 'addLog') {
        return jsonResponse(await withKeyLock('logs', async () => {
          const logs = await loadData(store, 'logs');
          logs.push(body.log);
          if (logs.length > 1000) logs.splice(0, logs.length - 1000);
          await store.setJSON('logs', logs);
          return { ok: true };
        }));
      }

      if (action === 'startSession') {
        return jsonResponse(await withKeyLock('sessions', async () => {
          const sessions = await loadData(store, 'sessions');
          sessions.push(body.session);
          await store.setJSON('sessions', sessions);
          return { ok: true };
        }));
      }

      if (action === 'endSession') {
        return jsonResponse(await withKeyLock('sessions', async () => {
          const sessions = await loadData(store, 'sessions');
          const idx = sessions.findIndex(s => s.id === body.id);
          if (idx >= 0) {
            sessions[idx].endTs = body.endTs;
            sessions[idx].duration = body.duration;
            await store.setJSON('sessions', sessions);
          }
          return { ok: true };
        }));
      }

      if (!VALID_TYPES.includes(type)) {
        return jsonResponse({ error: 'Invalid type' }, 400);
      }

      // 동일 type 키에 대한 모든 mutation 을 직렬화하여
      // "삭제 후 다른 변경에 의해 항목이 부활"하거나 "새 항목이 다른 동시 쓰기에 의해 사라지는" 문제를 방지.
      const result = await withKeyLock(type, async () => {
        // 락 안에서 항상 최신 상태를 다시 읽는다 (강한 일관성으로 직전 쓰기가 반영됨).
        let list = await loadData(store, type);

        switch (action) {
          case 'upsert': {
            const item = body.item;
            if (item.id) {
              const idx = list.findIndex(x => x.id === item.id);
              if (idx >= 0) list[idx] = { ...list[idx], ...item };
              else list.push(item);
            } else {
              item.id = type + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
              list.push(item);
            }
            await store.setJSON(type, list);
            return { list, item };
          }
          case 'delete': {
            list = list.filter(x => x.id !== body.id);
            await store.setJSON(type, list);
            return { list };
          }
          case 'move': {
            const idx = list.findIndex(x => x.id === body.id);
            const target = idx + body.direction;
            if (idx >= 0 && target >= 0 && target < list.length) {
              [list[idx], list[target]] = [list[target], list[idx]];
              await store.setJSON(type, list);
            }
            return { list };
          }
          case 'setAll': {
            const next = Array.isArray(body.list) ? body.list : [];
            await store.setJSON(type, next);
            return { list: next };
          }
          case 'clear': {
            await store.setJSON(type, []);
            return { ok: true, list: [] };
          }
          default:
            return { error: 'Unknown action', _status: 400 };
        }
      });

      if (result && result._status) {
        const { _status, ...rest } = result;
        return jsonResponse(rest, _status);
      }
      return jsonResponse(result);
    }

    return jsonResponse({ error: 'Method not allowed' }, 405);

  } catch (err) {
    console.error('Function error:', err);
    return jsonResponse({ error: err.message }, 500);
  }
};

export const config = {
  path: "/api/data"
};