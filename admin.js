import { initStore, getAll, upsertItem, deleteItem, moveItem, getById, setSession, getSession, clearSession, hasPermission, PERMISSION_KEYS, addLog, getLogs, clearLogs, startSession, endSession, getDailyAvgDurations, getSessions, setAll } from './store.js';

const menuItems = [
    { id: 'dashboard', label: '종합 대시보드', icon: 'pie-chart', desc: '실시간 방문 및 클릭 지표 분석', perm: null },
    { id: 'contentManagement', label: '컨텐츠 관리', icon: 'layout-template', desc: '긴급 헤더, 연대 요청, 푸터 정보 관리', perm: 'contentManagement' },
    { id: 'milestone', label: '마일스톤 관리', icon: 'flag', desc: '주요 사건 일정 및 하이라이트 편집', perm: 'milestone' },
    { id: 'suspicion', label: '의혹 노출 관리', icon: 'shield-alert', desc: '핵심 의혹 카드 데이터', perm: 'suspicion' },
    { id: 'timeline', label: '타임라인 편집', icon: 'git-commit', desc: '교육청 vs 유족 투쟁 기록 아카이빙', perm: 'timeline' },
    { id: 'comparison', label: '비교 라인 관리', icon: 'shuffle', desc: '타 사례 대비 지원 격차 데이터 관리', perm: 'comparison' },
    { id: 'users', label: '시스템 계정', icon: 'users', desc: '권한 설정 및 관리자 계정 CRUD', perm: 'super_only' },
    { id: 'logs', label: '로그 관리', icon: 'file-clock', desc: '관리자 작업 이력 추적', perm: 'super_only' }
];

let currentUser = null;
let currentSessionId = null;
let quill = null;
let currentEditType = null;
let currentEditId = null;
let selectedImage = null;
let isResizing = false;

// 모바일에서 사이드바 자동 닫기
function closeSidebarOnMobile() {
    if (window.innerWidth < 1024) {
        const sidebar = document.getElementById('sidebar');
        const backdrop = document.getElementById('sidebar-backdrop');
        if (sidebar && sidebar.classList.contains('active')) {
            sidebar.classList.remove('active');
            backdrop.classList.remove('active');
            document.body.classList.remove('sidebar-open');
        }
    }
}

window.handleLogin = function() {
    const id = document.getElementById('admin-id').value;
    const pw = document.getElementById('admin-pw').value;
    const accounts = getAll('accounts');
    const user = accounts.find(u => u.id === id && u.pw === pw);

    if (user) {
        currentUser = user;
        setSession(user);
        addLog(user.id, '로그인', `${user.name}(${user.id}) 시스템 접속 [${user.role}]`);
        currentSessionId = startSession(user.id);

        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('admin-panel').style.display = 'block';
        document.getElementById('current-user-name').textContent = user.name;
        document.getElementById('current-user-role').textContent = user.role === 'super' ? 'Super Admin' : 'Staff Admin';
        document.getElementById('user-avatar').textContent = user.name[0];

        initAdminNav();
        renderView('dashboard');
    } else {
        alert('인증 정보가 올바르지 않습니다.');
    }
};

window.handleLogout = function() {
    if (currentUser) addLog(currentUser.id, '로그아웃', `${currentUser.name} 시스템 종료`);
    if (currentSessionId) endSession(currentSessionId);
    clearSession();
    location.reload();
};

window.addEventListener('beforeunload', () => {
    if (currentSessionId) endSession(currentSessionId);
});

document.addEventListener('DOMContentLoaded', async () => {
    try {
        await initStore();
    } catch (e) {
        return;
    }
    const session = getSession();
    if (session) {
        document.getElementById('admin-id').value = session.id;
        document.getElementById('admin-pw').value = session.pw;
        handleLogin();
    } else {
        lucide.createIcons();
    }
});

function initAdminNav() {
    const nav = document.getElementById('admin-nav');
    nav.innerHTML = '';
    menuItems.forEach(item => {
        if (item.perm === 'super_only' && currentUser.role !== 'super') return;
        if (item.perm && item.perm !== 'super_only' && currentUser.role !== 'super' && !hasPermission(currentUser, item.perm)) return;
        const btn = document.createElement('button');
        btn.className = `sidebar-link w-full flex items-center gap-4 px-5 lg:px-6 py-3 lg:py-4 rounded-2xl transition-all text-sm mb-2 hover:bg-white/5`;
        btn.innerHTML = `<i data-lucide="${item.icon}" class="w-5 h-5 flex-shrink-0"></i> <span class="font-black">${item.label}</span>`;
        btn.onclick = () => {
            renderView(item.id, btn);
            closeSidebarOnMobile();
        };
        nav.appendChild(btn);
    });
    lucide.createIcons();
}

function renderView(viewId, activeBtn = null) {
    if ((viewId === 'users' || viewId === 'logs') && currentUser.role !== 'super') {
        alert('접근 권한이 없습니다. 슈퍼 관리자 전용 메뉴입니다.');
        return;
    }
    const content = document.getElementById('admin-content');
    const title = document.getElementById('view-title');
    const desc = document.getElementById('view-desc');
    document.querySelectorAll('.sidebar-link').forEach(b => b.classList.remove('active'));
    if (activeBtn) {
        activeBtn.classList.add('active');
    } else {
        const buttons = document.querySelectorAll('#admin-nav button');
        const visibleMenus = menuItems.filter(m => {
            if (m.perm === 'super_only' && currentUser.role !== 'super') return false;
            if (m.perm && m.perm !== 'super_only' && currentUser.role !== 'super' && !hasPermission(currentUser, m.perm)) return false;
            return true;
        });
        const idx = visibleMenus.findIndex(m => m.id === viewId);
        if (buttons[idx]) buttons[idx].classList.add('active');
    }
    const menu = menuItems.find(m => m.id === viewId);
    title.textContent = menu.label;
    desc.textContent = menu.desc;
    let html = '';
    switch (viewId) {
        case 'dashboard': html = renderDashboard(); break;
        case 'users': html = renderUserList(); break;
        case 'logs': html = renderLogView(); break;
        default: html = renderListView(viewId);
    }
    content.innerHTML = html;
    lucide.createIcons();
    if (viewId === 'dashboard') setTimeout(initStatChart, 100);
    if (viewId === 'logs') setTimeout(bindLogFilters, 50);
}

function getActionIcon(action) {
    if (!action) return 'circle';
    if (action.includes('로그인')) return 'log-in';
    if (action.includes('로그아웃')) return 'log-out';
    if (action.includes('등록') || action.includes('추가')) return 'plus-circle';
    if (action.includes('수정') || action.includes('변경')) return 'edit-3';
    if (action.includes('삭제') || action.includes('제거')) return 'trash-2';
    if (action.includes('순서')) return 'move-vertical';
    if (action.includes('초기화')) return 'rotate-ccw';
    return 'activity';
}

function getActionColor(action) {
    if (!action) return 'bg-neutral-100 text-neutral-500';
    if (action.includes('로그인') || action.includes('로그아웃')) return 'bg-blue-100 text-blue-600';
    if (action.includes('등록') || action.includes('추가')) return 'bg-green-100 text-green-600';
    if (action.includes('수정') || action.includes('변경')) return 'bg-amber-100 text-amber-600';
    if (action.includes('삭제') || action.includes('제거')) return 'bg-red-100 text-red-600';
    return 'bg-neutral-100 text-neutral-500';
}

function timeAgo(timestamp) {
    if (!timestamp) return '';
    const ts = new Date(timestamp.replace(' ', 'T')).getTime();
    if (isNaN(ts)) return timestamp;
    const diff = Math.floor((Date.now() - ts) / 1000);
    if (diff < 60) return `${diff}초 전`;
    if (diff < 3600) return `${Math.floor(diff/60)}분 전`;
    if (diff < 86400) return `${Math.floor(diff/3600)}시간 전`;
    if (diff < 86400*7) return `${Math.floor(diff/86400)}일 전`;
    return timestamp.slice(5, 16);
}

function renderActivityFeed() {
    const logs = getLogs().slice().reverse().slice(0, 12);
    if (!logs.length) return `<div class="p-8 md:p-12 text-center text-neutral-400 font-bold text-sm">최근 활동이 없습니다.</div>`;
    const accounts = getAll('accounts');
    return logs.map(log => {
        const acc = accounts.find(a => a.id === log.userId);
        const accName = acc ? acc.name : log.userId;
        const icon = getActionIcon(log.action);
        const color = getActionColor(log.action);
        return `
            <div class="activity-item flex gap-3 md:gap-4 p-3 md:p-4 rounded-2xl hover:bg-neutral-50 transition-all border-b border-neutral-50 last:border-0">
                <div class="w-9 h-9 md:w-10 md:h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${color}">
                    <i data-lucide="${icon}" class="w-4 h-4"></i>
                </div>
                <div class="flex-1 min-w-0">
                    <div class="text-xs md:text-sm font-bold text-neutral-800 leading-snug">
                        <span class="text-red-600 font-black">${accName}</span>
                        <span class="text-neutral-500">(${log.userId})</span>
                        님이 <span class="font-black">${log.action}</span> 하였습니다
                    </div>
                    <div class="text-[11px] md:text-xs text-neutral-400 font-bold mt-1 truncate">${log.detail}</div>
                    <div class="text-[10px] text-neutral-400 font-black mt-1.5 uppercase tracking-wider">${timeAgo(log.timestamp)} · ${log.timestamp}</div>
                </div>
            </div>
        `;
    }).join('');
}

function renderDashboard() {
    const counts = {
        milestone: getAll('milestone').length,
        suspicion: getAll('suspicion').length,
        timeline: getAll('timeline').length,
        comparison: getAll('comparison').length
    };
    const logs = getLogs();
    const sessions = getSessions().filter(s => s.duration > 0);
    const totalSessions = sessions.length;
    const avgDuration = totalSessions ? Math.round(sessions.reduce((a, s) => a + s.duration, 0) / totalSessions) : 0;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todaySessions = sessions.filter(s => s.endTs >= todayStart.getTime()).length;

    return `
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6 mb-6 md:mb-10">
            <div class="stat-card bg-white p-5 md:p-8 rounded-2xl md:rounded-[2rem] border-2 border-neutral-100 shadow-sm">
                <div class="text-neutral-400 text-[10px] font-black uppercase mb-2 md:mb-3 tracking-widest">마일스톤</div>
                <div class="text-2xl md:text-4xl font-black text-red-600">${counts.milestone}<span class="text-xs md:text-sm text-neutral-400 font-medium">건</span></div>
            </div>
            <div class="stat-card bg-white p-5 md:p-8 rounded-2xl md:rounded-[2rem] border-2 border-neutral-100 shadow-sm">
                <div class="text-neutral-400 text-[10px] font-black uppercase mb-2 md:mb-3 tracking-widest">의혹 항목</div>
                <div class="text-2xl md:text-4xl font-black italic">${counts.suspicion}<span class="text-xs md:text-sm text-neutral-400 font-medium">건</span></div>
            </div>
            <div class="stat-card bg-white p-5 md:p-8 rounded-2xl md:rounded-[2rem] border-2 border-neutral-100 shadow-sm">
                <div class="text-neutral-400 text-[10px] font-black uppercase mb-2 md:mb-3 tracking-widest">타임라인</div>
                <div class="text-2xl md:text-4xl font-black italic">${counts.timeline}<span class="text-xs md:text-sm text-neutral-400 font-medium">건</span></div>
            </div>
            <div class="stat-card bg-white p-5 md:p-8 rounded-2xl md:rounded-[2rem] border-2 border-red-100 shadow-sm bg-red-50/10">
                <div class="text-red-500 text-[10px] font-black uppercase mb-2 md:mb-3 tracking-widest">비교 라인</div>
                <div class="text-2xl md:text-4xl font-black italic">${counts.comparison}<span class="text-xs md:text-sm text-neutral-400 font-medium">건</span></div>
            </div>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-6 mb-6 md:mb-10">
            <div class="stat-card bg-gradient-to-br from-neutral-900 to-black p-5 md:p-8 rounded-2xl md:rounded-[2rem] text-white shadow-2xl">
                <div class="flex items-center gap-2 md:gap-3 mb-2 md:mb-3">
                    <i data-lucide="clock" class="w-4 h-4 text-red-500"></i>
                    <div class="text-[10px] font-black uppercase tracking-widest text-red-500">평균 체류 시간</div>
                </div>
                <div class="text-2xl md:text-4xl font-black">${Math.floor(avgDuration/60)}<span class="text-base md:text-lg text-neutral-400 font-medium">분</span> ${avgDuration%60}<span class="text-base md:text-lg text-neutral-400 font-medium">초</span></div>
                <div class="text-[11px] md:text-xs text-neutral-400 mt-1 md:mt-2 font-bold">관리자 전체 세션 평균</div>
            </div>
            <div class="stat-card bg-white p-5 md:p-8 rounded-2xl md:rounded-[2rem] border-2 border-neutral-100 shadow-sm">
                <div class="flex items-center gap-2 md:gap-3 mb-2 md:mb-3">
                    <i data-lucide="users" class="w-4 h-4 text-blue-500"></i>
                    <div class="text-[10px] font-black uppercase tracking-widest text-neutral-400">총 세션</div>
                </div>
                <div class="text-2xl md:text-4xl font-black">${totalSessions}<span class="text-xs md:text-sm text-neutral-400 font-medium">건</span></div>
                <div class="text-[11px] md:text-xs text-neutral-500 mt-1 md:mt-2 font-bold">오늘 ${todaySessions}건</div>
            </div>
            <div class="stat-card bg-white p-5 md:p-8 rounded-2xl md:rounded-[2rem] border-2 border-neutral-100 shadow-sm">
                <div class="flex items-center gap-2 md:gap-3 mb-2 md:mb-3">
                    <i data-lucide="file-clock" class="w-4 h-4 text-green-500"></i>
                    <div class="text-[10px] font-black uppercase tracking-widest text-neutral-400">누적 작업 로그</div>
                </div>
                <div class="text-2xl md:text-4xl font-black">${logs.length}<span class="text-xs md:text-sm text-neutral-400 font-medium">건</span></div>
                <div class="text-[11px] md:text-xs text-neutral-500 mt-1 md:mt-2 font-bold">서버 영속화</div>
            </div>
        </div>
        <div class="grid grid-cols-1 lg:grid-cols-5 gap-4 md:gap-6">
            <div class="lg:col-span-3 bg-white rounded-2xl md:rounded-[2.5rem] border-2 border-neutral-100 p-5 md:p-10">
                <h4 class="font-black text-base md:text-xl mb-2 flex justify-between items-center">주간 평균 체류 세션<span class="text-[11px] md:text-xs text-neutral-400 font-bold">Past 7 Days</span></h4>
                <p class="text-[11px] md:text-xs text-neutral-400 font-bold mb-4 md:mb-6">관리자 1인 세션 평균 체류 시간(초)</p>
                <div class="relative" style="height:240px"><canvas id="statChart"></canvas></div>
            </div>
            <div class="lg:col-span-2 bg-white rounded-2xl md:rounded-[2.5rem] border-2 border-neutral-100 overflow-hidden flex flex-col" style="max-height:480px">
                <div class="p-5 md:p-7 border-b-2 border-neutral-50 flex justify-between items-center flex-shrink-0">
                    <div>
                        <h4 class="font-black text-base md:text-lg flex items-center gap-2"><span class="w-2 h-2 bg-red-600 rounded-full animate-pulse"></span>최근 활동 메시지</h4>
                        <p class="text-[10px] text-neutral-400 font-bold uppercase tracking-widest mt-1">전체 관리자 공유 피드</p>
                    </div>
                    <span class="text-[10px] font-black text-red-600 bg-red-50 px-2 md:px-3 py-1 rounded-full">LIVE</span>
                </div>
                <div class="flex-1 overflow-y-auto activity-feed-list">${renderActivityFeed()}</div>
            </div>
        </div>
        <div class="mt-6 md:mt-8 p-4 md:p-6 bg-red-50 rounded-2xl md:rounded-3xl border border-red-100 flex items-start md:items-center gap-3 md:gap-4">
            <i data-lucide="shield-check" class="w-5 h-5 md:w-6 md:h-6 text-red-600 flex-shrink-0 mt-0.5 md:mt-0"></i>
            <div class="flex-1 min-w-0">
                <div class="text-[10px] md:text-xs font-black text-red-600 uppercase tracking-widest mb-1">현재 세션</div>
                <div class="text-xs md:text-sm font-black break-words">${currentUser.name} (${currentUser.id}) · 권한: ${currentUser.role === 'super' ? '슈퍼 관리자' : (currentUser.permissions || []).join(', ')}</div>
            </div>
        </div>
    `;
}

function renderListView(viewId) {
    const items = getAll(viewId);
    const labels = {
        milestone: ['일자', '제목', '상태'],
        suspicion: ['번호', '제목', '요약'],
        timeline: ['일자', '제목', '교육청 입장'],
        comparison: ['주제', '카테고리', '격차'],
        contentManagement: ['종류', '제목', '활성여부']
    };
    const cols = labels[viewId] || ['제목'];
    const rowHtml = items.map((item, idx) => {
        let c1, c2, c3;
        if (viewId === 'milestone') {
            c1 = item.date; c2 = item.title;
            c3 = `<span class="px-2 md:px-3 py-1 rounded-lg text-[10px] font-black ${item.status==='current'?'bg-red-100 text-red-600':item.status==='future'?'bg-blue-100 text-blue-600':'bg-neutral-100 text-neutral-500'}">${item.status||'-'}</span>`;
        } else if (viewId === 'suspicion') {
            c1 = `#${item.no || idx+1}`; c2 = item.title; c3 = (item.summary || '').slice(0, 50);
        } else if (viewId === 'timeline') {
            c1 = item.date; c2 = item.title; c3 = (item.edu || '').slice(0, 50);
        } else if (viewId === 'comparison') {
            c1 = item.subject; c2 = item.category || '-';
            c3 = `<span class="text-red-600 font-black">${Math.abs((item.otherVal||0)-(item.jejuVal||0))}${item.jejuUnit||''}</span>`;
        } else if (viewId === 'contentManagement') {
            c1 = item.type === 'emergency' ? '긴급 헤더' : item.type === 'cta' ? '연대 요청' : '푸터';
            c2 = item.title;
            c3 = item.isActive ? `<span class="text-green-600 font-black">활성</span>` : `<span class="text-neutral-400 font-black">비활성</span>`;
        }
        return `
            <tr class="hover:bg-neutral-50/50">
                <td class="px-3 md:px-8 py-4 md:py-6 text-xs font-black text-neutral-400">${idx+1}</td>
                <td class="px-3 md:px-8 py-4 md:py-6 text-xs md:text-sm font-bold whitespace-nowrap">${c1 || '-'}</td>
                <td class="px-3 md:px-8 py-4 md:py-6 text-xs md:text-sm font-black min-w-[150px]">${c2 || '-'}</td>
                <td class="px-3 md:px-8 py-4 md:py-6 text-[11px] md:text-xs text-neutral-500 hidden md:table-cell">${c3 || '-'}</td>
                <td class="px-3 md:px-8 py-4 md:py-6">
                    <div class="flex gap-1 md:gap-2 flex-wrap">
                        <button onclick="moveContent('${viewId}','${item.id}',-1)" class="p-1.5 md:p-2 hover:bg-neutral-100 rounded-lg" title="위로"><i data-lucide="arrow-up" class="w-3 h-3"></i></button>
                        <button onclick="moveContent('${viewId}','${item.id}',1)" class="p-1.5 md:p-2 hover:bg-neutral-100 rounded-lg" title="아래로"><i data-lucide="arrow-down" class="w-3 h-3"></i></button>
                        <button onclick="openEditor('${viewId}','${item.id}')" class="px-3 md:px-4 py-1.5 md:py-2 bg-neutral-100 rounded-lg text-[10px] font-black hover:bg-neutral-200">수정</button>
                        <button onclick="deleteContent('${viewId}','${item.id}')" class="px-3 md:px-4 py-1.5 md:py-2 bg-red-50 text-red-600 rounded-lg text-[10px] font-black hover:bg-red-100">삭제</button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    return `
        <div class="bg-white rounded-2xl md:rounded-[2.5rem] border-2 border-neutral-100 overflow-hidden shadow-sm">
            <div class="p-5 md:p-10 border-b-2 border-neutral-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 md:gap-4">
                <div>
                    <h4 class="font-black text-lg md:text-2xl tracking-tighter">${menuItems.find(m=>m.id===viewId).label}</h4>
                    <p class="text-[11px] md:text-xs text-neutral-400 mt-1">총 ${items.length}건 · 서버 동기화</p>
                </div>
                <button onclick="openEditor('${viewId}')" class="bg-red-600 text-white px-6 md:px-10 py-3 md:py-4 rounded-2xl text-xs font-black shadow-2xl shadow-red-200 hover:bg-red-700 transition-all w-full sm:w-auto">+ 새 콘텐츠 작성</button>
            </div>
            ${items.length === 0 ? `
                <div class="p-12 md:p-32 text-center">
                    <div class="w-16 h-16 md:w-24 md:h-24 bg-neutral-50 rounded-full flex items-center justify-center mx-auto mb-6 md:mb-8 border-4 border-white shadow-inner">
                        <i data-lucide="archive" class="text-neutral-200 w-8 h-8 md:w-10 md:h-10"></i>
                    </div>
                    <p class="text-neutral-400 font-bold mb-2 text-sm md:text-base">등록된 데이터가 없습니다.</p>
                </div>
            ` : `
                <div class="table-wrap">
                    <table class="w-full text-left">
                        <thead class="bg-neutral-50 text-[10px] font-black uppercase text-neutral-400">
                            <tr>
                                <th class="px-3 md:px-8 py-4 md:py-6">#</th>
                                <th class="px-3 md:px-8 py-4 md:py-6">${cols[0]}</th>
                                <th class="px-3 md:px-8 py-4 md:py-6">${cols[1]}</th>
                                <th class="px-3 md:px-8 py-4 md:py-6 hidden md:table-cell">${cols[2]}</th>
                                <th class="px-3 md:px-8 py-4 md:py-6">관리</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y-2 divide-neutral-50">${rowHtml}</tbody>
                    </table>
                </div>
            `}
        </div>
    `;
}

function renderUserList() {
    const accounts = getAll('accounts');
    return `
        <div class="bg-white rounded-2xl md:rounded-[2.5rem] border-2 border-neutral-100 overflow-hidden shadow-sm">
            <div class="p-5 md:p-10 border-b-2 border-neutral-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 md:gap-4">
                <h4 class="font-black text-lg md:text-2xl tracking-tighter">접속 계정 & 권한 설정</h4>
                <button onclick="openAccountModal()" class="bg-neutral-900 text-white px-6 md:px-8 py-3 md:py-4 rounded-2xl text-xs font-black shadow-xl hover:bg-black w-full sm:w-auto">+ 신규 계정 추가</button>
            </div>
            <div class="table-wrap">
                <table class="w-full text-left">
                    <thead class="bg-neutral-50 text-[10px] font-black uppercase text-neutral-400">
                        <tr>
                            <th class="px-4 md:px-10 py-4 md:py-6">사용자 (ID)</th>
                            <th class="px-4 md:px-10 py-4 md:py-6">권한</th>
                            <th class="px-4 md:px-10 py-4 md:py-6 hidden md:table-cell">접근 메뉴</th>
                            <th class="px-4 md:px-10 py-4 md:py-6 hidden lg:table-cell">최근 접속</th>
                            <th class="px-4 md:px-10 py-4 md:py-6">ACTION</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y-2 divide-neutral-50">
                        ${accounts.map(acc => `
                            <tr class="hover:bg-neutral-50/50 transition-colors">
                                <td class="px-4 md:px-10 py-5 md:py-8">
                                    <div class="font-black text-neutral-800 text-sm md:text-base">${acc.name}</div>
                                    <div class="text-[11px] md:text-xs text-neutral-400 font-bold">${acc.id}</div>
                                </td>
                                <td class="px-4 md:px-10 py-5 md:py-8">
                                    <span class="permission-badge ${acc.role === 'super' ? 'bg-red-100 text-red-600' : 'bg-neutral-100 text-neutral-600'} font-black uppercase tracking-widest">${acc.role}</span>
                                </td>
                                <td class="px-4 md:px-10 py-5 md:py-8 hidden md:table-cell">
                                    <div class="flex flex-wrap gap-1 md:gap-2">
                                        ${(acc.permissions || []).map(p => `<span class="px-2 md:px-3 py-1 bg-white border border-neutral-200 rounded-lg text-[10px] font-bold text-neutral-500">${p}</span>`).join('')}
                                    </div>
                                </td>
                                <td class="px-4 md:px-10 py-5 md:py-8 text-[11px] md:text-xs font-black text-neutral-400 hidden lg:table-cell">${acc.lastLogin || '-'}</td>
                                <td class="px-4 md:px-10 py-5 md:py-8">
                                    <div class="flex gap-2 md:gap-4">
                                        <button onclick="editAccount('${acc.id}')" class="text-[10px] font-black text-neutral-400 hover:text-black">수정</button>
                                        ${acc.id === 'admin' ? '' : `<button onclick="removeAccount('${acc.id}')" class="text-[10px] font-black text-red-500 hover:text-red-700">제거</button>`}
                                    </div>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

function actionBadgeColor(action) {
    if (!action) return 'bg-neutral-100 text-neutral-600';
    if (action.includes('로그인') || action.includes('로그아웃')) return 'bg-blue-100 text-blue-700';
    if (action.includes('등록') || action.includes('추가')) return 'bg-green-100 text-green-700';
    if (action.includes('수정') || action.includes('변경')) return 'bg-yellow-100 text-yellow-700';
    if (action.includes('삭제') || action.includes('제거')) return 'bg-red-100 text-red-700';
    return 'bg-neutral-100 text-neutral-600';
}

function renderLogView() {
    const logs = getLogs().slice().reverse();
    const actions = Array.from(new Set(logs.map(l => l.action)));
    const users = Array.from(new Set(logs.map(l => l.userId)));
    return `
        <div class="bg-white rounded-2xl md:rounded-[2.5rem] border-2 border-neutral-100 overflow-hidden shadow-sm">
            <div class="p-5 md:p-10 border-b-2 border-neutral-50 flex flex-col gap-4">
                <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div>
                        <h4 class="font-black text-lg md:text-2xl tracking-tighter">관리자 작업 이력</h4>
                        <p class="text-[11px] md:text-xs text-neutral-400 mt-1">전체 ${logs.length}건 · 서버 영속화</p>
                    </div>
                    <button onclick="handleClearLogs()" class="px-4 md:px-5 py-2 md:py-3 bg-red-50 text-red-600 rounded-2xl text-xs font-black hover:bg-red-100 w-full sm:w-auto">전체 초기화</button>
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 md:gap-3">
                    <input type="text" id="log-search" placeholder="🔎 검색 (ID/액션/상세)" class="px-4 md:px-5 py-2.5 md:py-3 bg-neutral-50 border border-neutral-200 rounded-2xl text-sm font-bold">
                    <select id="log-filter-user" class="px-4 md:px-5 py-2.5 md:py-3 bg-neutral-50 border border-neutral-200 rounded-2xl text-sm font-bold">
                        <option value="">전체 사용자</option>
                        ${users.map(u => `<option value="${u}">${u}</option>`).join('')}
                    </select>
                    <select id="log-filter-action" class="px-4 md:px-5 py-2.5 md:py-3 bg-neutral-50 border border-neutral-200 rounded-2xl text-sm font-bold">
                        <option value="">전체 작업</option>
                        ${actions.map(a => `<option value="${a}">${a}</option>`).join('')}
                    </select>
                </div>
            </div>
            <div class="table-wrap">
                <table class="w-full text-left">
                    <thead class="bg-neutral-50 text-[10px] font-black uppercase text-neutral-400">
                        <tr>
                            <th class="px-3 md:px-8 py-4 md:py-6">#</th>
                            <th class="px-3 md:px-8 py-4 md:py-6">일시</th>
                            <th class="px-3 md:px-8 py-4 md:py-6">사용자</th>
                            <th class="px-3 md:px-8 py-4 md:py-6">작업</th>
                            <th class="px-3 md:px-8 py-4 md:py-6 hidden md:table-cell">상세</th>
                        </tr>
                    </thead>
                    <tbody id="log-tbody" class="divide-y divide-neutral-100">${renderLogRows(logs)}</tbody>
                </table>
            </div>
        </div>
    `;
}

function renderLogRows(logs) {
    if (!logs.length) return `<tr><td colspan="5" class="p-12 md:p-20 text-center text-neutral-400 font-bold">조건에 맞는 로그가 없습니다.</td></tr>`;
    return logs.map((log, idx) => `
        <tr class="log-row">
            <td class="px-3 md:px-8 py-3 md:py-5 text-[11px] md:text-xs font-black text-neutral-400">${idx + 1}</td>
            <td class="px-3 md:px-8 py-3 md:py-5 text-[10px] md:text-xs font-mono font-bold text-neutral-600 whitespace-nowrap">${log.timestamp}</td>
            <td class="px-3 md:px-8 py-3 md:py-5 text-xs md:text-sm font-black">${log.userId}</td>
            <td class="px-3 md:px-8 py-3 md:py-5"><span class="log-action-badge ${actionBadgeColor(log.action)}">${log.action}</span></td>
            <td class="px-3 md:px-8 py-3 md:py-5 text-[11px] md:text-xs text-neutral-600 hidden md:table-cell">${log.detail}</td>
        </tr>
    `).join('');
}

function bindLogFilters() {
    const search = document.getElementById('log-search');
    const userF = document.getElementById('log-filter-user');
    const actionF = document.getElementById('log-filter-action');
    const tbody = document.getElementById('log-tbody');
    if (!search) return;
    function apply() {
        const q = search.value.trim().toLowerCase();
        const u = userF.value;
        const a = actionF.value;
        let logs = getLogs().slice().reverse();
        if (u) logs = logs.filter(l => l.userId === u);
        if (a) logs = logs.filter(l => l.action === a);
        if (q) logs = logs.filter(l =>
            (l.userId || '').toLowerCase().includes(q) ||
            (l.action || '').toLowerCase().includes(q) ||
            (l.detail || '').toLowerCase().includes(q) ||
            (l.timestamp || '').toLowerCase().includes(q));
        tbody.innerHTML = renderLogRows(logs);
    }
    search.addEventListener('input', apply);
    userF.addEventListener('change', apply);
    actionF.addEventListener('change', apply);
}

window.handleClearLogs = function() {
    if (!confirm('모든 로그를 초기화하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) return;
    clearLogs();
    addLog(currentUser.id, '로그 초기화', '전체 로그 데이터 삭제');
    renderView('logs');
};

function initStatChart() {
    const el = document.getElementById('statChart');
    if (!el) return;
    const data = getDailyAvgDurations(7);
    const ctx = el.getContext('2d');
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.map(d => d.label),
            datasets: [{
                label: '평균 체류 시간 (초)',
                data: data.map(d => d.avg),
                borderColor: '#dc2626', borderWidth: 4, tension: 0.4, fill: true,
                backgroundColor: 'rgba(220, 38, 38, 0.08)',
                pointBackgroundColor: '#dc2626', pointRadius: 5, pointHoverRadius: 8
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (ctx) => {
                            const idx = ctx.dataIndex;
                            const sec = ctx.parsed.y;
                            const cnt = data[idx].count;
                            return ` 평균 ${Math.floor(sec/60)}분 ${sec%60}초 · ${cnt}세션`;
                        }
                    }
                }
            },
            scales: {
                y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { font: { weight: 'bold', size: 10 }, callback: (v) => v + 's' } },
                x: { grid: { display: false }, ticks: { font: { weight: 'bold', size: 11 } } }
            }
        }
    });
}

function buildDynamicFields(type, data = {}) {
    const container = document.getElementById('dynamic-fields');
    let fields = '';
    if (type === 'milestone') {
        fields = `
            <div class="md:col-span-2 space-y-2">
                <label class="text-[10px] font-black text-neutral-400 uppercase">제목</label>
                <input type="text" id="f-title" placeholder="제목" class="w-full p-3 md:p-4 bg-neutral-50 border border-neutral-100 rounded-2xl font-bold" value="${escapeAttr(data.title)}">
            </div>
            <div>
                <label class="text-[10px] font-black text-neutral-400 uppercase">날짜</label>
                <input type="date" id="f-date" class="w-full p-3 md:p-4 bg-neutral-50 border border-neutral-100 rounded-2xl font-bold mt-2" value="${escapeAttr(data.date)}">
            </div>
            <div>
                <label class="text-[10px] font-black text-neutral-400 uppercase">상태</label>
                <select id="f-status" class="w-full p-3 md:p-4 bg-neutral-50 border border-neutral-100 rounded-2xl font-bold mt-2">
                    <option value="past" ${data.status==='past'?'selected':''}>과거</option>
                    <option value="current" ${data.status==='current'?'selected':''}>진행중</option>
                    <option value="future" ${data.status==='future'?'selected':''}>예정</option>
                </select>
            </div>
            <div class="md:col-span-2">
                <label class="text-[10px] font-black text-neutral-400 uppercase">목록 요약</label>
                <input type="text" id="f-summary" placeholder="목록에 표시될 요약" class="w-full p-3 md:p-4 bg-neutral-50 border border-neutral-100 rounded-2xl font-bold mt-2" value="${escapeAttr(data.summary)}">
            </div>`;
    } else if (type === 'suspicion') {
        fields = `
            <div>
                <label class="text-[10px] font-black text-neutral-400 uppercase">번호</label>
                <input type="number" id="f-no" placeholder="의혹 번호" class="w-full p-3 md:p-4 bg-neutral-50 border border-neutral-100 rounded-2xl font-bold mt-2" value="${escapeAttr(data.no)}">
            </div>
            <div>
                <label class="text-[10px] font-black text-neutral-400 uppercase">제목</label>
                <input type="text" id="f-title" placeholder="제목" class="w-full p-3 md:p-4 bg-neutral-50 border border-neutral-100 rounded-2xl font-bold mt-2" value="${escapeAttr(data.title)}">
            </div>
            <div class="md:col-span-2">
                <label class="text-[10px] font-black text-neutral-400 uppercase">개요 (요약)</label>
                <input type="text" id="f-summary" placeholder="요약 설명" class="w-full p-3 md:p-4 bg-neutral-50 border border-neutral-100 rounded-2xl font-bold mt-2" value="${escapeAttr(data.summary)}">
            </div>`;
    } else if (type === 'timeline') {
        fields = `
            <div>
                <label class="text-[10px] font-black text-neutral-400 uppercase">날짜</label>
                <input type="date" id="f-date" class="w-full p-3 md:p-4 bg-neutral-50 border border-neutral-100 rounded-2xl font-bold mt-2" value="${escapeAttr(data.date)}">
            </div>
            <div>
                <label class="text-[10px] font-black text-neutral-400 uppercase">제목</label>
                <input type="text" id="f-title" placeholder="제목" class="w-full p-3 md:p-4 bg-neutral-50 border border-neutral-100 rounded-2xl font-bold mt-2" value="${escapeAttr(data.title)}">
            </div>
            <div class="md:col-span-2">
                <label class="text-[10px] font-black text-neutral-400 uppercase">교육청 입장</label>
                <textarea id="f-edu" rows="2" class="w-full p-3 md:p-4 bg-neutral-50 border border-neutral-100 rounded-2xl font-bold mt-2">${escapeAttr(data.edu)}</textarea>
            </div>
            <div class="md:col-span-2">
                <label class="text-[10px] font-black text-neutral-400 uppercase">유족 입장 / 대응</label>
                <textarea id="f-family" rows="2" class="w-full p-3 md:p-4 bg-neutral-50 border border-neutral-100 rounded-2xl font-bold mt-2">${escapeAttr(data.family)}</textarea>
            </div>
            <div class="md:col-span-2">
                <label class="text-[10px] font-black text-neutral-400 uppercase">증거 자료명</label>
                <input type="text" id="f-evidence" placeholder="증거 파일명" class="w-full p-3 md:p-4 bg-neutral-50 border border-neutral-100 rounded-2xl font-bold mt-2" value="${escapeAttr(data.evidence)}">
            </div>`;
    } else if (type === 'comparison') {
        fields = `
            <div class="md:col-span-2">
                <label class="text-[10px] font-black text-neutral-400 uppercase">비교 주제</label>
                <input type="text" id="f-subject" placeholder="예: 초기 위로금" class="w-full p-3 md:p-4 bg-neutral-50 border border-neutral-100 rounded-2xl font-bold mt-2" value="${escapeAttr(data.subject)}">
            </div>
            <div class="md:col-span-2">
                <label class="text-[10px] font-black text-neutral-400 uppercase">카테고리</label>
                <input type="text" id="f-category" placeholder="예: 타 직군 비교 (경찰/소방)" class="w-full p-3 md:p-4 bg-neutral-50 border border-neutral-100 rounded-2xl font-bold mt-2" value="${escapeAttr(data.category)}">
            </div>
            <div class="md:col-span-2 p-3 md:p-4 bg-red-50 rounded-2xl">
                <div class="text-[10px] font-black text-red-600 mb-3">제주 측 데이터</div>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-2 md:gap-3">
                    <input type="text" id="f-jeju-label" placeholder="라벨" class="p-3 bg-white border rounded-xl font-bold text-sm" value="${escapeAttr(data.jejuLabel)}">
                    <input type="number" id="f-jeju-val" placeholder="수치" class="p-3 bg-white border rounded-xl font-bold text-sm" value="${escapeAttr(data.jejuVal)}">
                    <input type="text" id="f-jeju-unit" placeholder="단위" class="p-3 bg-white border rounded-xl font-bold text-sm" value="${escapeAttr(data.jejuUnit)}">
                </div>
                <input type="text" id="f-jeju-detail" placeholder="상세 설명" class="w-full p-3 bg-white border rounded-xl font-bold text-sm mt-3" value="${escapeAttr(data.jejuDetail)}">
            </div>
            <div class="md:col-span-2 p-3 md:p-4 bg-neutral-100 rounded-2xl">
                <div class="text-[10px] font-black text-neutral-600 mb-3">비교 대상 데이터</div>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-2 md:gap-3">
                    <input type="text" id="f-other-label" placeholder="라벨" class="p-3 bg-white border rounded-xl font-bold text-sm" value="${escapeAttr(data.otherLabel)}">
                    <input type="number" id="f-other-val" placeholder="수치" class="p-3 bg-white border rounded-xl font-bold text-sm" value="${escapeAttr(data.otherVal)}">
                    <input type="text" id="f-other-unit" placeholder="단위" class="p-3 bg-white border rounded-xl font-bold text-sm" value="${escapeAttr(data.otherUnit)}">
                </div>
                <input type="text" id="f-other-detail" placeholder="상세 설명" class="w-full p-3 bg-white border rounded-xl font-bold text-sm mt-3" value="${escapeAttr(data.otherDetail)}">
            </div>`;
    } else if (type === 'contentManagement') {
        fields = `
            <div>
                <label class="text-[10px] font-black text-neutral-400 uppercase">종류</label>
                <select id="f-type" class="w-full p-3 md:p-4 bg-neutral-50 border border-neutral-100 rounded-2xl font-bold mt-2">
                    <option value="emergency" ${data.type==='emergency'?'selected':''}>긴급 헤더 (Emergency Bar)</option>
                    <option value="cta" ${data.type==='cta'?'selected':''}>연대 요청 (Call to Action)</option>
                    <option value="footer" ${data.type==='footer'?'selected':''}>푸터 (Footer)</option>
                </select>
            </div>
            <div>
                <label class="text-[10px] font-black text-neutral-400 uppercase">활성화 여부</label>
                <select id="f-isactive" class="w-full p-3 md:p-4 bg-neutral-50 border border-neutral-100 rounded-2xl font-bold mt-2">
                    <option value="true" ${data.isActive!==false?'selected':''}>활성</option>
                    <option value="false" ${data.isActive===false?'selected':''}>비활성</option>
                </select>
            </div>
            <div class="md:col-span-2">
                <label class="text-[10px] font-black text-neutral-400 uppercase">제목/요약</label>
                <input type="text" id="f-title" placeholder="제목" class="w-full p-3 md:p-4 bg-neutral-50 border border-neutral-100 rounded-2xl font-bold mt-2" value="${escapeAttr(data.title)}">
            </div>`;
    }
    container.innerHTML = fields;
}

function escapeAttr(v) {
    if (v === undefined || v === null) return '';
    return String(v).replace(new RegExp('"', 'g'), '&quot;');
}

// 기존 함수를 찾아서 이걸로 덮어쓰세요
function customImageHandler() {
    const input = document.createElement('input');
    input.setAttribute('type', 'file');
    input.setAttribute('accept', 'image/*');
    input.click();
    input.onchange = async () => {
        const file = input.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append("file", file);

        try {
            const response = await fetch("/.netlify/functions/file-api", {
                method: "POST",
                body: formData
            });
            const data = await response.json();
            if (data.url) insertImageToEditor(data.url);
        } catch (error) {
            alert("본문 이미지 업로드 실패");
        }
    };
}

function customImageUrlHandler() {
    const url = prompt('이미지 URL을 입력하세요:', 'https://');
    if (url && url.trim() && url !== 'https://') insertImageToEditor(url.trim());
}

function insertImageToEditor(src) {
    const range = quill.getSelection(true);
    quill.insertEmbed(range.index, 'image', src, 'user');
    quill.setSelection(range.index + 1);
    setTimeout(() => {
        const imgs = quill.root.querySelectorAll('img');
        const lastImg = imgs[imgs.length - 1];
        if (lastImg) {
            lastImg.style.width = '60%';
            lastImg.style.display = 'block';
            lastImg.style.margin = '1rem auto';
        }
    }, 50);
}

function setupImageInteraction() {
    const root = quill.root;
    root.addEventListener('click', (e) => {
        if (e.target.tagName === 'IMG') { e.preventDefault(); selectImage(e.target); }
        else deselectImage();
    });
    quill.on('selection-change', (range) => {
        if (range && selectedImage) {
            const sel = window.getSelection();
            if (!sel.toString() && !root.contains(selectedImage)) deselectImage();
        }
    });
    setupResizeHandles();
}

function selectImage(img) {
    deselectImage();
    selectedImage = img;
    img.classList.add('img-selected');
    showFloatingToolbar(img);
    showResizeHandles(img);
    const widthInput = document.getElementById('img-width-input');
    const cssWidth = img.style.width;
    if (cssWidth && cssWidth.endsWith('%')) widthInput.value = parseInt(cssWidth);
    else widthInput.value = 60;
}

function deselectImage() {
    if (selectedImage) selectedImage.classList.remove('img-selected');
    selectedImage = null;
    hideFloatingToolbar();
    hideResizeHandles();
}

function showFloatingToolbar(img) {
    const toolbar = document.getElementById('img-floating-toolbar');
    const wrap = document.getElementById('editor-wrap');
    const wrapRect = wrap.getBoundingClientRect();
    const imgRect = img.getBoundingClientRect();
    toolbar.style.left = (imgRect.left - wrapRect.left + imgRect.width / 2) + 'px';
    toolbar.style.top = (imgRect.top - wrapRect.top) + 'px';
    toolbar.classList.add('active');
}

function hideFloatingToolbar() { document.getElementById('img-floating-toolbar').classList.remove('active'); }

function showResizeHandles(img) {
    const wrap = document.getElementById('editor-wrap');
    const wrapRect = wrap.getBoundingClientRect();
    const imgRect = img.getBoundingClientRect();
    const positions = {
        tl: { left: imgRect.left - wrapRect.left - 7, top: imgRect.top - wrapRect.top - 7 },
        tr: { left: imgRect.right - wrapRect.left - 7, top: imgRect.top - wrapRect.top - 7 },
        bl: { left: imgRect.left - wrapRect.left - 7, top: imgRect.bottom - wrapRect.top - 7 },
        br: { left: imgRect.right - wrapRect.left - 7, top: imgRect.bottom - wrapRect.top - 7 }
    };
    Object.keys(positions).forEach(key => {
        const handle = document.getElementById('handle-' + key);
        handle.style.left = positions[key].left + 'px';
        handle.style.top = positions[key].top + 'px';
        handle.classList.add('active');
    });
}

function hideResizeHandles() { ['tl', 'tr', 'bl', 'br'].forEach(k => document.getElementById('handle-' + k).classList.remove('active')); }

function setupResizeHandles() {
    ['tl', 'tr', 'bl', 'br'].forEach(corner => {
        const handle = document.getElementById('handle-' + corner);
        handle.addEventListener('mousedown', (e) => {
            if (!selectedImage) return;
            e.preventDefault();
            isResizing = true;
            const startX = e.clientX;
            const startWidth = selectedImage.offsetWidth;
            const editorWidth = quill.root.offsetWidth;
            const onMove = (ev) => {
                let delta = ev.clientX - startX;
                if (corner === 'tl' || corner === 'bl') delta = -delta;
                const newWidth = Math.max(50, startWidth + delta);
                const percent = Math.min(100, Math.max(10, Math.round((newWidth / editorWidth) * 100)));
                selectedImage.style.width = percent + '%';
                selectedImage.style.height = 'auto';
                showResizeHandles(selectedImage);
                showFloatingToolbar(selectedImage);
                document.getElementById('img-width-input').value = percent;
            };
            const onUp = () => {
                isResizing = false;
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
            };
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
        });
    });
}

window.alignSelectedImage = function(align) {
    if (!selectedImage) return;
    selectedImage.style.float = '';
    selectedImage.style.display = '';
    selectedImage.style.margin = '';
    if (align === 'left') {
        selectedImage.style.float = 'left';
        selectedImage.style.margin = '0.5rem 1.5rem 0.5rem 0';
        selectedImage.style.display = 'inline';
    } else if (align === 'right') {
        selectedImage.style.float = 'right';
        selectedImage.style.margin = '0.5rem 0 0.5rem 1.5rem';
        selectedImage.style.display = 'inline';
    } else {
        selectedImage.style.display = 'block';
        selectedImage.style.margin = '1rem auto';
    }
    setTimeout(() => { showFloatingToolbar(selectedImage); showResizeHandles(selectedImage); }, 10);
};

window.applyImageWidth = function() {
    if (!selectedImage) return;
    const val = parseInt(document.getElementById('img-width-input').value);
    if (isNaN(val) || val < 10 || val > 100) { alert('10~100 사이의 값을 입력하세요.'); return; }
    selectedImage.style.width = val + '%';
    selectedImage.style.height = 'auto';
    setTimeout(() => { showFloatingToolbar(selectedImage); showResizeHandles(selectedImage); }, 10);
};

window.deleteSelectedImage = function() {
    if (!selectedImage) return;
    if (!confirm('이 이미지를 삭제하시겠습니까?')) return;
    selectedImage.remove();
    deselectImage();
};

window.openEditor = function(type, id = null) {
    currentEditType = type;
    currentEditId = id;
    const data = id ? (getById(type, id) || {}) : {};
    document.getElementById('editor-modal').classList.remove('hidden');
    document.getElementById('modal-title').textContent = id ? `${type.toUpperCase()} 수정` : `${type.toUpperCase()} 신규 등록`;
    buildDynamicFields(type, data);
    document.getElementById('edit-image').value = data.image || '';
    document.getElementById('edit-image-align').value = data.imageAlign || 'center';
    document.getElementById('edit-image-width').value = data.imageWidth || 100;
    document.getElementById('edit-file').value = data.file || '';
    document.getElementById('edit-file-url').value = data.fileUrl || '';
    updateImagePreview();
    document.getElementById('edit-image').oninput = updateImagePreview;
    if (!quill) {
        const Image = Quill.import('formats/image');
        Image.className = 'editor-img';
        Quill.register(Image, true);
        quill = new Quill('#editor-container', {
            theme: 'snow',
            placeholder: '진실을 증명하는 내용을 작성하세요...',
            modules: {
                toolbar: {
                    container: [
                        [{ 'header': [1, 2, 3, false] }],
                        [{ 'size': ['small', false, 'large', 'huge'] }],
                        ['bold', 'italic', 'underline', 'strike'],
                        [{ 'color': [] }, { 'background': [] }],
                        [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                        [{ 'align': [] }],
                        ['link', 'image', 'image-url'],
                        ['blockquote', 'code-block'],
                        ['clean']
                    ],
                    handlers: { 'image': customImageHandler, 'image-url': customImageUrlHandler }
                }
            }
        });
        const urlBtn = document.querySelector('.ql-image-url');
        if (urlBtn) { urlBtn.innerHTML = '🔗'; urlBtn.title = 'URL로 이미지 삽입'; urlBtn.style.fontWeight = 'bold'; }
        setupImageInteraction();
    }
    deselectImage();
    quill.root.innerHTML = data.content || '';
    setTimeout(() => {
        const imgs = quill.root.querySelectorAll('img');
        imgs.forEach(img => {
            if (!img.style.width && !img.getAttribute('width')) img.style.width = '60%';
        });
    }, 50);
    lucide.createIcons();
};

function updateImagePreview() {
    const url = document.getElementById('edit-image').value;
    const preview = document.getElementById('image-preview');
    if (url) preview.innerHTML = `<img src="${url}" class="h-12 w-full object-cover rounded-2xl" onerror="this.parentElement.innerHTML='URL 오류'">`;
    else preview.textContent = '이미지 없음';
}


window.handleImageUpload = async function(e) {
    const file = e.target.files[0];
    if (!file) return;

    const preview = document.getElementById('image-preview');
    preview.textContent = "서버 업로드 중...";

    const formData = new FormData();
    formData.append("file", file);

    try {
        const response = await fetch("/.netlify/functions/file-api", {
            method: "POST",
            body: formData
        });
        const data = await response.json();

        if (data.url) {
            document.getElementById('edit-image').value = data.url;
            updateImagePreview();
        }
    } catch (error) {
        alert("이미지 업로드 실패: " + error.message);
        preview.textContent = "업로드 실패";
    }
};

window.closeEditor = function() {
    deselectImage();
    document.getElementById('editor-modal').classList.add('hidden');
};

window.saveAndClose = function() {
    const type = currentEditType;
    const isNew = !currentEditId;
    const item = currentEditId ? { ...getById(type, currentEditId) } : {};
    if (currentEditId) item.id = currentEditId;
    const v = (id) => { const el = document.getElementById(id); return el ? el.value : ''; };
    if (type === 'milestone') {
        item.title = v('f-title'); item.date = v('f-date'); item.status = v('f-status'); item.summary = v('f-summary');
    } else if (type === 'suspicion') {
        item.no = parseInt(v('f-no')) || 0; item.title = v('f-title'); item.summary = v('f-summary');
    } else if (type === 'timeline') {
        item.date = v('f-date'); item.title = v('f-title'); item.edu = v('f-edu'); item.family = v('f-family'); item.evidence = v('f-evidence');
    } else if (type === 'comparison') {
        item.subject = v('f-subject'); item.category = v('f-category');
        item.jejuLabel = v('f-jeju-label'); item.jejuVal = parseFloat(v('f-jeju-val')) || 0; item.jejuUnit = v('f-jeju-unit'); item.jejuDetail = v('f-jeju-detail');
        item.otherLabel = v('f-other-label'); item.otherVal = parseFloat(v('f-other-val')) || 0; item.otherUnit = v('f-other-unit'); item.otherDetail = v('f-other-detail');
    } else if (type === 'contentManagement') {
        item.type = v('f-type'); item.isActive = v('f-isactive') === 'true'; item.title = v('f-title');
    }
    item.image = v('edit-image'); item.imageAlign = v('edit-image-align'); item.imageWidth = parseInt(v('edit-image-width')) || 100;
    item.file = v('edit-file'); item.fileUrl = v('edit-file-url');
    deselectImage();
    item.content = quill ? quill.root.innerHTML : '';
    const titleField = item.title || item.subject;
    if (!titleField) { alert('제목/주제는 필수 입력 항목입니다.'); return; }
    upsertItem(type, item);
    addLog(currentUser.id, `${typeKor(type)} ${isNew ? '등록' : '수정'}`, `[${type}] "${titleField}" ${isNew ? '신규 등록' : 'ID:' + item.id + ' 수정'}`);
    alert('데이터가 서버에 저장되었습니다. 모든 기기에서 즉시 반영됩니다.');
    closeEditor();
    renderView(type);
};

function typeKor(type) {
    return { milestone: '마일스톤', suspicion: '의혹', timeline: '타임라인', comparison: '비교라인', accounts: '계정', contentManagement: '컨텐츠' }[type] || type;
}

window.deleteContent = function(type, id) {
    if (!confirm('정말 이 항목을 삭제하시겠습니까?')) return;
    const target = getById(type, id);
    deleteItem(type, id);
    addLog(currentUser.id, `${typeKor(type)} 삭제`, `[${type}] "${target?.title || target?.subject || id}" 삭제 (ID: ${id})`);
    renderView(type);
};

window.moveContent = function(type, id, direction) {
    moveItem(type, id, direction);
    addLog(currentUser.id, `${typeKor(type)} 순서변경`, `[${type}] ID ${id} ${direction > 0 ? '아래로' : '위로'} 이동`);
    renderView(type);
};

window.openAccountModal = function(accId = null) {
    const modal = document.getElementById('account-modal');
    modal.classList.remove('hidden');
    const permContainer = document.getElementById('acc-permissions');
    permContainer.innerHTML = PERMISSION_KEYS.map(p => `
        <label class="flex items-center gap-3 p-3 bg-neutral-50 rounded-xl cursor-pointer hover:bg-neutral-100">
            <input type="checkbox" class="acc-perm" value="${p}">
            <span class="text-sm font-bold">${p}</span>
        </label>
    `).join('');

    // [추가된 부분] 창 열 때마다 비밀번호 숨김 상태로 초기화
    const pwInput = document.getElementById('acc-pw');
    const eyeIcon = document.getElementById('pw-eye-icon');
    if (pwInput && eyeIcon) {
        pwInput.type = 'password';
        eyeIcon.setAttribute('data-lucide', 'eye');
    }

    if (accId) {
        const acc = getAll('accounts').find(a => a.id === accId);
        if (acc) {
            document.getElementById('account-modal-title').textContent = `계정 수정: ${acc.id}`;
            document.getElementById('acc-orig-id').value = acc.id;
            document.getElementById('acc-id').value = acc.id;
            document.getElementById('acc-id').disabled = true;
            document.getElementById('acc-name').value = acc.name;
            document.getElementById('acc-pw').value = acc.pw;
            document.getElementById('acc-role').value = acc.role;
            (acc.permissions || []).forEach(p => {
                const cb = permContainer.querySelector(`input[value="${p}"]`);
                if (cb) cb.checked = true;
            });
        }
    } else {
        document.getElementById('account-modal-title').textContent = '신규 계정 추가';
        document.getElementById('acc-orig-id').value = '';
        document.getElementById('acc-id').value = '';
        document.getElementById('acc-id').disabled = false;
        document.getElementById('acc-name').value = '';
        document.getElementById('acc-pw').value = '';
        document.getElementById('acc-role').value = 'staff';
    }
    lucide.createIcons();
};

window.closeAccountModal = function() { document.getElementById('account-modal').classList.add('hidden'); };
window.editAccount = function(id) { openAccountModal(id); };

window.removeAccount = function(id) {
    if (id === 'admin') return alert('초기 슈퍼관리자는 삭제할 수 없습니다.');
    if (!confirm('정말 이 계정을 삭제하시겠습니까?')) return;
    const accounts = getAll('accounts').filter(a => a.id !== id);
    setAll('accounts', accounts);
    addLog(currentUser.id, '계정 삭제', `계정[${id}] 제거`);
    renderView('users');
};

// 교체할 window.saveAccount 메소드 전체
window.saveAccount = function() {
    const origId = document.getElementById('acc-orig-id').value;
    const id = document.getElementById('acc-id').value.trim();
    const name = document.getElementById('acc-name').value.trim();
    const pw = document.getElementById('acc-pw').value;
    const role = document.getElementById('acc-role').value;
    const perms = Array.from(document.querySelectorAll('.acc-perm:checked')).map(c => c.value);
    
    if (!id || !name || !pw) return alert('아이디/이름/비밀번호는 필수입니다.');
    
    const accounts = getAll('accounts');
    const permissions = role === 'super' ? ['all'] : perms;
    
    if (origId) {
        const idx = accounts.findIndex(a => a.id === origId);
        if (idx >= 0) accounts[idx] = { ...accounts[idx], name, pw, role, permissions };
        addLog(currentUser.id, '계정 수정', `계정 [${origId}] 정보 수정 (권한: ${role})`);
        
        // [중요] 현재 로그인한 본인의 계정을 수정한 경우 세션 즉시 업데이트
        if (currentUser.id === origId) {
            currentUser = accounts[idx];
            setSession(currentUser);
        }
    } else {
        if (accounts.find(a => a.id === id)) return alert('이미 존재하는 아이디입니다.');
        accounts.push({ id, pw, name, role, permissions, lastLogin: '-' });
        addLog(currentUser.id, '계정 등록', `신규 계정 [${id}/${name}] 추가 (권한: ${role})`);
    }
    
    setAll('accounts', accounts);
    closeAccountModal();
    renderView('users');
};

// 파일의 가장 밑에 추가하세요
window.handleGeneralFileUpload = async function(e) {
    const file = e.target.files[0];
    if (!file) return;

    // 용량 제한 방어 로직 (너무 큰 파일 업로드 시 멈춤)
    if (file.size > 20 * 1024 * 1024) {
        alert("20MB 이하의 파일만 업로드 가능합니다.");
        return;
    }

    const label = e.target.parentElement;
    const originalContent = label.innerHTML;
    label.innerHTML = `<span class="animate-pulse">서버로 전송 중...</span>`;
    label.classList.add('opacity-50', 'pointer-events-none');

    const formData = new FormData();
    formData.append("file", file);

    try {
        const response = await fetch("/.netlify/functions/file-api", {
            method: "POST",
            body: formData
        });
        const data = await response.json();

        if (data.url) {
            // 파일명과 다운로드 링크를 텍스트 박스에 자동 삽입
            document.getElementById('edit-file').value = data.fileName;
            document.getElementById('edit-file-url').value = data.url;
            alert(`[${data.fileName}] 파일이 안전하게 서버에 등록되었습니다.`);
        }
    } catch (error) {
        alert("파일 업로드 실패: " + error.message);
    } finally {
        label.innerHTML = originalContent;
        label.classList.remove('opacity-50', 'pointer-events-none');
        lucide.createIcons();
    }
};
// ====== 비밀번호 표시/숨김 토글 핸들러 ======
window.togglePasswordVisibility = function() {
    const pwInput = document.getElementById('acc-pw');
    const eyeIcon = document.getElementById('pw-eye-icon');
    
    if (pwInput.type === 'password') {
        pwInput.type = 'text'; // 비밀번호 보이기
        eyeIcon.setAttribute('data-lucide', 'eye-off'); // 눈 감은 아이콘으로 변경
    } else {
        pwInput.type = 'password'; // 비밀번호 숨기기
        eyeIcon.setAttribute('data-lucide', 'eye'); // 눈 뜬 아이콘으로 변경
    }
    lucide.createIcons(); // 아이콘 다시 그리기
};