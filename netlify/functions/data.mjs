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
    const store = getStore(STORE_NAME);

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
        const current = await loadDisplayConfig(store);
        const next = { ...current, ...(body.config || {}) };
        await store.setJSON(DISPLAY_CONFIG_KEY, next);
        return jsonResponse({ displayConfig: next });
      }

      if (action === 'addLog') {
        const logs = await loadData(store, 'logs');
        logs.push(body.log);
        if (logs.length > 1000) logs.splice(0, logs.length - 1000);
        await store.setJSON('logs', logs);
        return jsonResponse({ ok: true });
      }

      if (action === 'startSession') {
        const sessions = await loadData(store, 'sessions');
        sessions.push(body.session);
        await store.setJSON('sessions', sessions);
        return jsonResponse({ ok: true });
      }

      if (action === 'endSession') {
        const sessions = await loadData(store, 'sessions');
        const idx = sessions.findIndex(s => s.id === body.id);
        if (idx >= 0) {
          sessions[idx].endTs = body.endTs;
          sessions[idx].duration = body.duration;
          await store.setJSON('sessions', sessions);
        }
        return jsonResponse({ ok: true });
      }

      if (!VALID_TYPES.includes(type)) {
        return jsonResponse({ error: 'Invalid type' }, 400);
      }

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
          return jsonResponse({ list, item });
        }
        case 'delete': {
          list = list.filter(x => x.id !== body.id);
          await store.setJSON(type, list);
          return jsonResponse({ list });
        }
        case 'move': {
          const idx = list.findIndex(x => x.id === body.id);
          const target = idx + body.direction;
          if (idx >= 0 && target >= 0 && target < list.length) {
            [list[idx], list[target]] = [list[target], list[idx]];
            await store.setJSON(type, list);
          }
          return jsonResponse({ list });
        }
        case 'setAll': {
          await store.setJSON(type, body.list);
          return jsonResponse({ list: body.list });
        }
        case 'clear': {
          await store.setJSON(type, []);
          return jsonResponse({ ok: true });
        }
      }

      return jsonResponse({ error: 'Unknown action' }, 400);
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