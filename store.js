const API_BASE = '/api/data';

const memoryCache = {
  milestone: [],
  suspicion: [],
  timeline: [],
  comparison: [],
  contentManagement: [],
  accounts: [],
  logs: [],
  sessions: []
};

const SESSION_KEY = 'tj_session';
let initialized = false;

export async function initStore() {
  if (initialized) return;
  try {
    const res = await fetch(API_BASE);
    if (!res.ok) throw new Error('서버 응답 오류: ' + res.status);
    const data = await res.json();
    Object.keys(memoryCache).forEach(k => {
      if (Array.isArray(data[k])) memoryCache[k] = data[k];
    });
    initialized = true;
  } catch (err) {
    console.error('initStore failed:', err);
    alert('⚠️ 서버 데이터 로드 실패. 새로고침 해주세요.\n' + err.message);
    throw err;
  }
}

export async function refreshStore() {
  initialized = false;
  await initStore();
}

function postAction(payload) {
  return fetch(API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }).then(res => {
    if (!res.ok) throw new Error('서버 저장 실패: ' + res.status);
    return res.json();
  }).catch(err => {
    console.error('API error:', err);
    alert('⚠️ 서버 동기화 실패: ' + err.message + '\n잠시 후 다시 시도하세요.');
    throw err;
  });
}

export function getAll(type) {
  return memoryCache[type] || [];
}

export function setAll(type, list) {
  memoryCache[type] = list;
  postAction({ action: 'setAll', type, list });
}

export function upsertItem(type, item) {
  if (!memoryCache[type]) memoryCache[type] = [];
  if (item.id) {
    const idx = memoryCache[type].findIndex(x => x.id === item.id);
    if (idx >= 0) memoryCache[type][idx] = { ...memoryCache[type][idx], ...item };
    else memoryCache[type].push(item);
  } else {
    item.id = type + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
    memoryCache[type].push(item);
  }
  postAction({ action: 'upsert', type, item });
  return item;
}

export function deleteItem(type, id) {
  memoryCache[type] = (memoryCache[type] || []).filter(x => x.id !== id);
  postAction({ action: 'delete', type, id });
}

export function moveItem(type, id, direction) {
  const list = memoryCache[type] || [];
  const idx = list.findIndex(x => x.id === id);
  const target = idx + direction;
  if (idx >= 0 && target >= 0 && target < list.length) {
    [list[idx], list[target]] = [list[target], list[idx]];
    postAction({ action: 'move', type, id, direction });
  }
}

export function getById(type, id) {
  return getAll(type).find(x => x.id === id);
}

export function setSession(user) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
}

export function getSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearSession() {
  sessionStorage.removeItem(SESSION_KEY);
}

export function hasPermission(user, key) {
  if (!user) return false;
  if (user.role === 'super') return true;
  if (user.permissions && user.permissions.includes('all')) return true;
  return user.permissions && user.permissions.includes(key);
}

export const PERMISSION_KEYS = ['milestone', 'suspicion', 'timeline', 'comparison', 'contentManagement'];

function nowStamp() {
  const now = new Date();
  return now.getFullYear() + '-' +
    String(now.getMonth() + 1).padStart(2, '0') + '-' +
    String(now.getDate()).padStart(2, '0') + ' ' +
    String(now.getHours()).padStart(2, '0') + ':' +
    String(now.getMinutes()).padStart(2, '0') + ':' +
    String(now.getSeconds()).padStart(2, '0');
}

export function addLog(userId, action, detail) {
  const log = {
    id: 'log_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
    timestamp: nowStamp(),
    userId: userId || 'system',
    action: action || 'unknown',
    detail: detail || ''
  };
  if (!memoryCache.logs) memoryCache.logs = [];
  memoryCache.logs.push(log);
  postAction({ action: 'addLog', log });
}

export function getLogs() {
  return memoryCache.logs || [];
}

export function clearLogs() {
  memoryCache.logs = [];
  postAction({ action: 'clear', type: 'logs' });
}

// 호환성을 위해 빈 함수로 유지 (서버에서 자동 시드됨)
export function seedInitialLogsIfNeeded() {}
export function seedInitialSessionsIfNeeded() {}

export function startSession(userId) {
  const id = 'sess_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
  const session = { id, userId, startTs: Date.now(), endTs: null, duration: 0 };
  if (!memoryCache.sessions) memoryCache.sessions = [];
  memoryCache.sessions.push(session);
  postAction({ action: 'startSession', session });
  return id;
}

export function endSession(sessionId) {
  if (!sessionId) return;
  const sessions = memoryCache.sessions || [];
  const idx = sessions.findIndex(s => s.id === sessionId);
  if (idx < 0) return;
  const endTs = Date.now();
  const duration = Math.max(0, Math.floor((endTs - sessions[idx].startTs) / 1000));
  sessions[idx].endTs = endTs;
  sessions[idx].duration = duration;
  postAction({ action: 'endSession', id: sessionId, endTs, duration });
}

export function getSessions() {
  return memoryCache.sessions || [];
}

export function getDailyAvgDurations(days = 7) {
  const sessions = getSessions().filter(s => s.duration > 0);
  const now = new Date();
  const result = [];
  for (let d = days - 1; d >= 0; d--) {
    const target = new Date(now.getFullYear(), now.getMonth(), now.getDate() - d);
    const start = target.getTime();
    const end = start + 86400 * 1000;
    const inDay = sessions.filter(s => s.endTs >= start && s.endTs < end);
    const avg = inDay.length ? Math.round(inDay.reduce((a, s) => a + s.duration, 0) / inDay.length) : 0;
    const label = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][target.getDay()];
    result.push({ label, avg, count: inDay.length, dateLabel: `${target.getMonth() + 1}/${target.getDate()}` });
  }
  return result;
}