import { initStore, getAll } from './store.js';

document.addEventListener('DOMContentLoaded', async () => {
    try {
        await initStore();
    } catch (e) {
        return;
    }
    initContentManagement();
    initMilestones();
    initSuspicions();
    initTimeline();
    initComparisonView();
    initCharts();
    lucide.createIcons();
    handleHashScroll();
});

function handleHashScroll() {
    if (location.hash) {
        setTimeout(() => {
            const target = document.querySelector(location.hash);
            if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 200);
    }
}

function imageStyleString(item) {
    const w = item.imageWidth || 100;
    let align = 'margin: 1.5rem auto; display: block;';
    if (item.imageAlign === 'left') align = 'margin: 1.5rem 1.5rem 1.5rem 0; float: left;';
    if (item.imageAlign === 'right') align = 'margin: 1.5rem 0 1.5rem 1.5rem; float: right;';
    return `width: ${w}%; ${align} border-radius: 1.5rem;`;
}

function initContentManagement() {
    const contents = getAll('contentManagement');
    const emergencyBar = document.getElementById('emergency-bar-container');
    const ctaContainer = document.getElementById('cta-container');
    const footerContainer = document.getElementById('footer-container');
    
    emergencyBar.innerHTML = '';
    ctaContainer.innerHTML = '';
    footerContainer.innerHTML = '';

    contents.forEach(c => {
        if (!c.isActive) return;
        if (c.type === 'emergency') {
            emergencyBar.innerHTML += `
                <div class="urgent-banner">
                    <div class="max-w-7xl mx-auto px-6 py-2 flex items-center justify-center gap-3 text-xs font-black tracking-widest uppercase">
                        <span class="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                        ${c.title}
                        <span class="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                    </div>
                </div>
            `;
        } else if (c.type === 'cta') {
            ctaContainer.innerHTML += `
                <section class="py-24 px-6 bg-red-600">
                    <div class="max-w-5xl mx-auto text-center">
                        <h2 class="text-4xl md:text-5xl font-black text-white mb-6 tracking-tighter">${c.title}</h2>
                        <div class="text-white/90 mb-10 text-lg rich-content-inline">${c.content}</div>
                    </div>
                </section>
            `;
        } else if (c.type === 'footer') {
            footerContainer.innerHTML += `
                <div class="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-8">
                    <div class="text-center md:text-left">
                        <span class="text-red-600 font-black text-2xl tracking-tighter">${c.title}</span>
                        <div class="text-neutral-500 text-sm mt-2 max-w-md rich-content-inline">${c.content}</div>
                    </div>
                    <div class="flex gap-6 text-neutral-400 text-sm font-bold">
                        <a href="#" class="hover:text-red-500">보도자료</a>
                        <a href="#" class="hover:text-red-500">연대신청</a>
                        <a href="admin.html" class="hover:text-red-500">관리자</a>
                    </div>
                </div>
            `;
        }
    });
    
    if (!footerContainer.innerHTML.trim()) {
        footerContainer.innerHTML = `
            <div class="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-8">
                <div class="text-center md:text-left">
                    <span class="text-red-600 font-black text-2xl tracking-tighter">TRUTH <span class="text-white font-medium">JEJU</span></span>
                    <p class="text-neutral-500 text-sm mt-2 max-w-md">제주 교사 유가족 협의회는 고인의 명예 회복과 교육 현장의 진실을 위해 끝까지 싸우겠습니다.</p>
                </div>
                <div class="flex gap-6 text-neutral-400 text-sm font-bold">
                    <a href="admin.html" class="hover:text-red-500">관리자</a>
                </div>
            </div>
        `;
    }
}

function initMilestones() {
    const container = document.getElementById('milestone-container');
    const linksContainer = document.getElementById('milestone-links');
    const milestones = getAll('milestone');
    container.innerHTML = '';
    linksContainer.innerHTML = '';

    milestones.forEach(m => {
        const link = document.createElement('button');
        link.type = 'button';
        link.dataset.target = m.id;
        const isCurrent = m.status === 'current';
        const isFuture = m.status === 'future';
        link.className = `px-4 py-2 border rounded-full transition-all font-black ${
            isCurrent ? 'bg-red-600 border-red-600 text-white' :
            isFuture ? 'bg-blue-500/10 border-blue-500/30 text-blue-400' :
            'bg-white/5 border-white/10 text-neutral-400 hover:bg-red-600/20 hover:border-red-600/50 hover:text-red-500'
        }`;
        link.textContent = m.date;
        link.addEventListener('click', () => {
            const target = document.getElementById(m.id);
            if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
        });
        linksContainer.appendChild(link);

        const card = document.createElement('div');
        card.id = m.id;
        card.className = `milestone-card snap-center flex-shrink-0 w-[380px] bg-neutral-900/80 p-10 rounded-[2.5rem] cursor-pointer ${isCurrent ? 'highlight' : ''} ${isFuture ? 'future-mark' : ''}`;
        card.innerHTML = `
            <div class="flex justify-between items-start mb-8">
                <span class="text-sm font-black px-4 py-1.5 ${isCurrent ? 'bg-red-600 text-white' : isFuture ? 'bg-blue-500/20 text-blue-400' : 'bg-neutral-800 text-neutral-500'} rounded-full">${m.date}</span>
                <span class="text-[11px] font-black uppercase tracking-widest ${isCurrent ? 'text-red-500 animate-pulse' : isFuture ? 'text-blue-400' : 'text-neutral-600'}">
                    ${isCurrent ? '● NOW' : isFuture ? 'UPCOMING' : 'PAST'}
                </span>
            </div>
            <h3 class="text-2xl font-black mb-6 leading-tight">${m.title}</h3>
            <p class="text-neutral-400 text-sm leading-relaxed mb-8 line-clamp-3">${m.summary}</p>
            <div class="flex items-center gap-3 text-sm font-bold text-red-600 hover:gap-5 transition-all">
                사건 실체 확인 <i data-lucide="arrow-right" class="w-4 h-4"></i>
            </div>
        `;
        card.onclick = () => openModal('milestone', m);
        container.appendChild(card);
    });
}

function initSuspicions() {
    const grid = document.getElementById('suspicion-grid');
    grid.innerHTML = '';
    const suspicions = getAll('suspicion');
    suspicions.forEach((s, idx) => {
        const no = s.no || (idx + 1);
        const item = document.createElement('div');
        item.id = s.id;
        item.className = "suspicion-card p-12 rounded-[2rem] relative overflow-hidden group cursor-pointer";
        item.innerHTML = `
            <span class="absolute -top-10 -right-4 text-[10rem] font-black text-white/[0.03] group-hover:text-red-600/10 transition-colors">${no}</span>
            <div class="relative z-10">
                <h3 class="text-2xl font-black mb-8 flex items-center gap-5">
                    <span class="w-12 h-12 rounded-2xl bg-red-600 text-white flex items-center justify-center text-xl font-black shadow-2xl shadow-red-600/40">#${no}</span>
                    ${s.title}
                </h3>
                <p class="text-neutral-400 leading-relaxed text-lg">${s.summary || ''}</p>
            </div>
        `;
        item.onclick = () => openModal('suspicion', s);
        grid.appendChild(item);
    });
}

function initTimeline() {
    const list = document.getElementById('timeline-list');
    list.innerHTML = '';
    const timelineData = getAll('timeline');
    timelineData.forEach((t) => {
        const item = document.createElement('div');
        item.id = t.id;
        item.className = "relative group cursor-pointer";
        item.innerHTML = `
            <div class="md:grid md:grid-cols-2 md:gap-24 items-start">
                <div class="hidden md:block text-right pr-4">
                    <div class="text-sm font-black text-neutral-500 mb-2 font-mono uppercase">${t.date}</div>
                    <div class="p-8 bg-neutral-100 rounded-3xl border-r-8 border-neutral-300 text-neutral-600 shadow-sm">
                        <div class="text-[10px] font-black text-neutral-400 mb-2 uppercase italic">Education Office Stance</div>
                        <p class="text-sm italic font-medium leading-relaxed">${t.edu || ''}</p>
                    </div>
                </div>
                <div class="absolute left-1/2 -translate-x-1/2 h-full w-[2px] bg-neutral-200 hidden md:block"></div>
                <div class="absolute left-1/2 -translate-x-1/2 top-10 timeline-dot hidden md:block"></div>
                <div class="pl-10 md:pl-4">
                    <div class="md:hidden text-xs font-black text-red-600 mb-3">${t.date}</div>
                    <h4 class="text-3xl font-black mb-6 tracking-tight">${t.title}</h4>
                    <div class="md:hidden mb-8 p-6 bg-neutral-100 rounded-2xl border-l-4 border-neutral-300 text-sm italic">
                        <span class="block mb-2 font-black text-neutral-400 uppercase">교육청 대응</span>${t.edu || ''}
                    </div>
                    <div class="p-10 bg-neutral-900 text-white rounded-[2.5rem] border border-white/5 shadow-2xl group-hover:border-red-600/30 transition-all">
                        <div class="flex items-center gap-2 mb-4">
                             <div class="w-1.5 h-1.5 bg-red-600 rounded-full"></div>
                             <span class="text-[11px] font-black text-red-500 uppercase tracking-[0.2em]">Bereaved Family's Battle</span>
                        </div>
                        <p class="text-neutral-300 leading-relaxed text-lg mb-8">${t.family || ''}</p>
                        <div class="pt-6 border-t border-white/10 flex justify-between items-center">
                             <div class="flex items-center gap-2">
                                <i data-lucide="file" class="w-4 h-4 text-neutral-500"></i>
                                <span class="text-xs text-neutral-500 font-bold">${t.evidence || '증거 자료'}</span>
                             </div>
                             <button class="px-5 py-2.5 bg-white/5 rounded-xl text-[11px] font-black uppercase hover:bg-red-600 transition-colors">상세 보기</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        item.onclick = () => openModal('timeline', t);
        list.appendChild(item);
    });
}

function formatGap(c) {
    const diff = Math.abs((c.otherVal || 0) - (c.jejuVal || 0));
    return `${diff.toLocaleString()}${c.jejuUnit || ''}`;
}

function initComparisonView() {
    const container = document.getElementById('comparison-display');
    const textDataContainer = document.getElementById('comparison-text-data');
    container.innerHTML = '';
    textDataContainer.innerHTML = '';
    const comparisons = getAll('comparison');

    comparisons.forEach(c => {
        const row = document.createElement('div');
        row.id = c.id;
        row.className = "comparison-row cursor-pointer";
        row.innerHTML = `
            <div class="comparison-pane pane-jeju">
                <div class="text-[10px] font-black text-red-500 uppercase mb-4 tracking-[0.3em]">● JEJU CASE</div>
                <h4 class="text-xl font-black mb-2 text-white">${c.subject}</h4>
                <p class="text-xs text-red-400/70 mb-6 font-bold">${c.jejuLabel}</p>
                <div class="number-stat text-red-600">${(c.jejuVal||0).toLocaleString()}<span class="text-2xl ml-1">${c.jejuUnit}</span></div>
                <p class="text-neutral-400 leading-relaxed text-sm">${c.jejuDetail}</p>
            </div>
            <div class="vs-divider">
                <div class="vs-text">VS</div>
                <div class="gap-text">격차<br/><span class="gap-num">${formatGap(c)}</span></div>
            </div>
            <div class="comparison-pane pane-others">
                <div class="text-[10px] font-black text-neutral-500 uppercase mb-4 tracking-[0.3em]">${c.category || 'OTHERS'}</div>
                <h4 class="text-xl font-black mb-2 text-neutral-200">${c.subject}</h4>
                <p class="text-xs text-neutral-500 mb-6 font-bold">${c.otherLabel}</p>
                <div class="number-stat text-white">${(c.otherVal||0).toLocaleString()}<span class="text-2xl ml-1">${c.otherUnit}</span></div>
                <p class="text-neutral-500 leading-relaxed text-sm">${c.otherDetail}</p>
            </div>
        `;
        row.onclick = () => openModal('comparison', c);
        container.appendChild(row);

        const card = document.createElement('div');
        card.className = "bg-neutral-900/30 p-6 rounded-2xl border border-white/5 flex justify-between items-center hover:border-red-600/30 transition-all";
        card.innerHTML = `
            <div class="flex-1">
                <div class="text-[10px] text-red-500 font-black mb-1 uppercase tracking-widest">${c.category}</div>
                <div class="text-sm text-white font-bold">${c.subject}</div>
                <div class="text-xs text-neutral-500 mt-1">${c.jejuLabel} vs ${c.otherLabel}</div>
            </div>
            <div class="text-right ml-4">
                <div class="text-2xl font-black text-red-500 leading-none">${formatGap(c)}</div>
                <div class="text-[10px] text-neutral-600 font-bold mt-1">차별의 크기</div>
            </div>
        `;
        textDataContainer.appendChild(card);
    });
}

function initCharts() {
    const ctx = document.getElementById('comparisonChart').getContext('2d');
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['초기 지원금', '심리상담(연)', '법률 지원', '공식 사과(회)'],
            datasets: [
                { label: '제주 교사 유족', data: [0, 0, 0, 0], backgroundColor: '#dc2626', borderRadius: 8 },
                { label: '타 사례 평균', data: [34260, 365, 100, 4], backgroundColor: '#404040', borderRadius: 8 }
            ]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { labels: { color: '#a3a3a3', font: { weight: 'bold' } } },
                tooltip: { backgroundColor: '#000', borderColor: '#dc2626', borderWidth: 1 }
            },
            scales: {
                y: { beginAtZero: true, grid: { color: '#222' }, ticks: { color: '#666' }, type: 'logarithmic' },
                x: { grid: { display: false }, ticks: { color: '#a3a3a3', font: { weight: 'bold' } } }
            }
        }
    });
}

window.openModal = function(type, data) {
    const modal = document.getElementById('detail-modal');
    const content = document.getElementById('modal-content');
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    const sectionId = data.id || '';
    const shareUrl = location.origin + location.pathname + '#' + sectionId;
    const imgHtml = data.image ? `<img src="${data.image}" style="${imageStyleString(data)}" alt="${data.title || ''}">` : '';
    const fileHtml = data.file ? `
        <div class="mt-10 p-8 bg-white/5 rounded-3xl border border-white/10 flex items-center justify-between">
            <div class="flex items-center gap-5">
                <div class="w-12 h-12 bg-red-600/20 rounded-2xl flex items-center justify-center">
                    <i data-lucide="file-text" class="text-red-500"></i>
                </div>
                <div>
                    <div class="text-[10px] text-neutral-500 font-black uppercase">Official Evidence</div>
                    <div class="text-sm font-bold text-white">${data.file}</div>
                </div>
            </div>
            <a href="${data.fileUrl || '#'}" target="_blank" class="w-12 h-12 bg-red-600 text-white rounded-2xl hover:bg-red-700 transition-colors flex items-center justify-center">
                <i data-lucide="download" class="w-5 h-5"></i>
            </a>
        </div>
    ` : '';

    let headerHtml = '';
    if (type === 'milestone') {
        const tag = data.status === 'current' ? '● 현재 진행중' : data.status === 'future' ? '예정' : '과거';
        headerHtml = `<div class="flex items-center gap-4 mb-6"><span class="text-red-600 font-mono text-lg font-black tracking-tighter">${data.date}</span><span class="text-xs font-black px-3 py-1 bg-red-600/20 text-red-500 rounded-full">${tag}</span></div>
                      <h2 class="text-5xl font-black mb-10 leading-[1.1] tracking-tighter text-white">${data.title}</h2>`;
    } else if (type === 'suspicion') {
        headerHtml = `<div class="text-red-600 font-mono text-lg font-black mb-6 tracking-tighter">의혹 #${data.no || ''}</div>
                      <h2 class="text-5xl font-black mb-10 leading-[1.1] tracking-tighter text-white">${data.title}</h2>`;
    } else if (type === 'timeline') {
        headerHtml = `<div class="text-red-600 font-mono text-lg font-black mb-6 tracking-tighter">${data.date}</div>
                      <h2 class="text-5xl font-black mb-10 leading-[1.1] tracking-tighter text-white">${data.title}</h2>`;
    } else if (type === 'comparison') {
        headerHtml = `<div class="text-red-600 font-mono text-lg font-black mb-6 tracking-tighter">${data.category || ''}</div>
                      <h2 class="text-5xl font-black mb-10 leading-[1.1] tracking-tighter text-white">${data.subject}</h2>
                      <div class="grid grid-cols-2 gap-6 mb-10">
                          <div class="p-6 bg-red-600/10 rounded-2xl border border-red-600/30">
                              <div class="text-[10px] font-black text-red-500 uppercase mb-2">${data.jejuLabel}</div>
                              <div class="text-3xl font-black text-red-500">${(data.jejuVal||0).toLocaleString()}${data.jejuUnit}</div>
                          </div>
                          <div class="p-6 bg-white/5 rounded-2xl border border-white/10">
                              <div class="text-[10px] font-black text-neutral-500 uppercase mb-2">${data.otherLabel}</div>
                              <div class="text-3xl font-black text-white">${(data.otherVal||0).toLocaleString()}${data.otherUnit}</div>
                          </div>
                      </div>`;
    }

    content.innerHTML = `
        <div class="max-w-4xl mx-auto">
            ${headerHtml}
            <div class="rich-content clearfix">${imgHtml}${data.content || ''}</div>
            ${fileHtml}
            <div class="mt-16 pt-10 border-t border-white/10">
                <div class="text-[11px] font-black text-neutral-600 uppercase mb-4">진실을 알려주세요</div>
                <div class="flex gap-4 flex-wrap">
                    <button onclick="shareKakao('${shareUrl}')" class="px-8 py-4 bg-white text-black font-black rounded-2xl hover:bg-neutral-200 transition-colors">카카오톡 공유</button>
                    <button onclick="shareSNS('${shareUrl}')" class="px-8 py-4 bg-red-600 text-white font-black rounded-2xl hover:bg-red-700 transition-colors">SNS 확산</button>
                    <button id="copy-link-btn" onclick="copyShareLink('${shareUrl}', this)" class="px-8 py-4 bg-neutral-800 text-white font-black rounded-2xl hover:bg-neutral-700 transition-colors flex items-center gap-2">
                        <i data-lucide="link" class="w-4 h-4"></i> 링크 복사
                    </button>
                </div>
                <div class="mt-4 text-xs text-neutral-600 font-mono break-all">${shareUrl}</div>
            </div>
        </div>
    `;
    lucide.createIcons();
}

window.closeModal = function() {
    document.getElementById('detail-modal').classList.add('hidden');
    document.body.style.overflow = 'auto';
}

window.copyShareLink = async function(url, btn) {
    try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(url);
        } else {
            const ta = document.createElement('textarea');
            ta.value = url;
            ta.style.position = 'fixed';
            ta.style.left = '-9999px';
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
        }
        if (btn) {
            const orig = btn.innerHTML;
            btn.innerHTML = '<i data-lucide="check" class="w-4 h-4"></i> 복사 완료!';
            btn.classList.add('bg-green-600');
            lucide.createIcons();
            setTimeout(() => {
                btn.innerHTML = orig;
                btn.classList.remove('bg-green-600');
                lucide.createIcons();
            }, 2000);
        }
    } catch (e) {
        alert('링크 복사에 실패했습니다: ' + url);
    }
};

window.shareKakao = function(url) { alert('카카오톡 공유 링크:\n' + url); };
window.shareSNS = function(url) {
    const text = encodeURIComponent('제주 교사 사망사건의 진실을 알려주세요');
    window.open(`https://twitter.com/intent/tweet?text=${text}&url=${encodeURIComponent(url)}`, '_blank');
};