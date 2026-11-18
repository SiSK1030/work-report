
const STORAGE_KEY_MODELS = 'worktime_models';
const STORAGE_KEY_RECORDS = 'worktime_records';
const STORAGE_KEY_JUMP_URL = 'worktime_jump_url';
const STORAGE_KEY_WINDOW_PERCENT = 'worktime_window_percent';

const DEFAULT_WINDOW_PERCENT = 20;

let models = [];
let records = [];
let jumpUrl = '';
let windowPercent = DEFAULT_WINDOW_PERCENT;
let currentView = 'active';
let expanded = {};

let notifiedIds = new Set();

function loadData() {
    try {
        const m = localStorage.getItem(STORAGE_KEY_MODELS);
        models = m ? JSON.parse(m) : [];
    } catch { models = []; }

    try {
        const r = localStorage.getItem(STORAGE_KEY_RECORDS);
        records = r ? JSON.parse(r) : [];
    } catch { records = []; }

    jumpUrl = localStorage.getItem(STORAGE_KEY_JUMP_URL) || '';

    const pctRaw = localStorage.getItem(STORAGE_KEY_WINDOW_PERCENT);
    const pct = parseFloat(pctRaw);
    windowPercent = (pctRaw !== null && !isNaN(pct) && pct >= 0 && pct <= 100)
        ? pct
        : DEFAULT_WINDOW_PERCENT;

    document.getElementById('jumpUrlInput').value = jumpUrl;
    document.getElementById('windowPercentInput').value = windowPercent;
    syncPresetChips();
}

function saveModels() {
    localStorage.setItem(STORAGE_KEY_MODELS, JSON.stringify(models));
}

function saveRecords() {
    localStorage.setItem(STORAGE_KEY_RECORDS, JSON.stringify(records));
}

function saveSettings() {
    const urlVal = document.getElementById('jumpUrlInput').value.trim();
    const pctRaw = document.getElementById('windowPercentInput').value.trim();
    const pctVal = parseFloat(pctRaw);

    if (pctRaw === '' || isNaN(pctVal)) {
        alert('⚠️ 请输入报工窗口浮动比例');
        return;
    }
    if (pctVal < 0 || pctVal > 100) {
        alert('⚠️ 浮动比例请在 0 ~ 100 之间');
        return;
    }

    jumpUrl = urlVal;
    windowPercent = pctVal;

    localStorage.setItem(STORAGE_KEY_JUMP_URL, jumpUrl);
    localStorage.setItem(STORAGE_KEY_WINDOW_PERCENT, String(windowPercent));

    notifiedIds.clear();

    closeSettingsModal();
    renderRecords();
    checkAndShowReadyPopup(false);
    alert(`✅ 设置已保存\n报工窗口：工时前后各浮动 ${windowPercent}%`);
}

function setPercentPreset(pct) {
    document.getElementById('windowPercentInput').value = pct;
    syncPresetChips();
}

function syncPresetChips() {
    const current = parseFloat(document.getElementById('windowPercentInput').value);
    document.querySelectorAll('#percentPresets .chip').forEach(chip => {
        const pct = parseFloat(chip.dataset.pct);
        chip.classList.toggle('active', !isNaN(current) && pct === current);
    });
}

// ================================================================
//  一键跳转
// ================================================================

function quickJump() {
    if (!jumpUrl) {
        alert('⚠️ 请先点击「设置」配置跳转地址');
        openSettingsModal();
        return;
    }
    window.location.href = jumpUrl;
}

// ================================================================
//  视图切换
// ================================================================

function switchView(view) {
    currentView = view;
    document.querySelectorAll('.segment-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === view);
    });
    // 「已报工」视图才显示导出工具栏
    const exportBar = document.getElementById('exportBar');
    if (exportBar) exportBar.style.display = (view === 'done') ? 'flex' : 'none';
    renderRecords();
}

// ================================================================
//  型号管理
// ================================================================

function addModel() {
    const nameInput = document.getElementById('modelNameInput');
    const durInput = document.getElementById('modelDurationInput');
    const name = nameInput.value.trim();
    const dur = parseInt(durInput.value);

    if (!name) { alert('请输入型号名称'); return; }
    if (!dur || dur < 1) { alert('请输入有效的工时定额'); return; }

    if (models.some(m => m.name === name)) {
        alert('该型号已存在，请勿重复添加');
        return;
    }

    models.push({
        id: Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6),
        name: name,
        duration: dur
    });

    saveModels();
    nameInput.value = '';
    durInput.value = '';
    renderModels();
    renderModelSelect();
}

function deleteModel(id) {
    if (!confirm('确定要删除该型号吗？')) return;
    models = models.filter(m => m.id !== id);
    saveModels();
    renderModels();
    renderModelSelect();
    renderRecords();
}

// ================================================================
//  开工 & 记录管理
// ================================================================

function startWork() {
    const select = document.getElementById('modelSelect');
    const modelId = select.value;
    const number = document.getElementById('workNumber').value.trim();

    if (!modelId) {
        alert('请先选择一个型号');
        return;
    }

    const model = models.find(m => m.id === modelId);
    if (!model) {
        alert('所选型号不存在，请重新选择');
        renderModelSelect();
        return;
    }

    const now = new Date();
    const record = {
        id: Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6),
        modelId: model.id,
        modelName: model.name,
        duration: model.duration,
        number: number || '',
        startTime: now.toISOString(),
        done: false,
        finishTime: null
    };

    records.push(record);
    saveRecords();
    document.getElementById('workNumber').value = '';
    renderRecords();
    renderModelSelect();
}

function finishWork(id) {
    const record = records.find(r => r.id === id);
    if (!record || record.done) return;

    record.done = true;
    record.finishTime = new Date().toISOString();
    saveRecords();
    notifiedIds.delete(id);
    renderRecords();

    if (jumpUrl) {
        window.location.href = jumpUrl;
    } else {
        alert('⚠️ 请先在「设置」中配置跳转地址');
        openSettingsModal();
    }
}

function batchFinishAll() {
    const readyList = getReadyRecords();

    if (readyList.length === 0) {
        closeReadyPopup();
        return;
    }

    const count = readyList.length;
    const nowIso = new Date().toISOString();

    readyList.forEach(r => {
        r.done = true;
        r.finishTime = nowIso;
        notifiedIds.delete(r.id);
    });

    saveRecords();
    closeReadyPopup();
    renderRecords();

    if (jumpUrl) {
        setTimeout(() => {
            window.location.href = jumpUrl;
        }, 120);
    } else {
        alert(`✅ 已批量报工 ${count} 个工件\n⚠️ 但未配置跳转地址，请先在「设置」中配置`);
        openSettingsModal();
    }
}

function deleteRecord(id) {
    if (!confirm('确定要移除该记录吗？')) return;
    records = records.filter(r => r.id !== id);
    delete expanded[id];
    notifiedIds.delete(id);
    saveRecords();
    renderRecords();
}

function clearAllRecords() {
    const active = records.filter(r => !r.done);
    if (active.length === 0) {
        alert('没有进行中的工件');
        return;
    }
    if (!confirm(`确定要清空全部 ${active.length} 个进行中的工件吗？`)) return;
    records = records.filter(r => r.done);
    saveRecords();
    expanded = {};
    notifiedIds.clear();
    renderRecords();
}

function toggleDetails(id) {
    expanded[id] = !expanded[id];
    renderRecords();
}

// ================================================================
//  可报工自动提醒
// ================================================================

function getReadyRecords() {
    const now = Date.now();
    return records
        .filter(r => {
            if (r.done) return false;
            const start = new Date(r.startTime).getTime();
            const { windowStart, windowEnd } = calcReportWindow(start, r.duration);
            const st = getStatus(now, windowStart, windowEnd);
            return st === 'ready' || st === 'overdue';
        })
        .sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
}

function checkAndShowReadyPopup(force) {
    const readyList = getReadyRecords();
    if (readyList.length === 0) return;

    if (!force) {
        const hasNew = readyList.some(r => !notifiedIds.has(r.id));
        if (!hasNew) return;
    }

    readyList.forEach(r => notifiedIds.add(r.id));
    showReadyPopup(readyList);
}

function showReadyPopup(list) {
    const container = document.getElementById('readyPopupList');
    const titleEl = document.getElementById('readyPopupTitle');
    const now = Date.now();

    titleEl.textContent = `⏰ 有 ${list.length} 个工件可以报工啦`;

    container.innerHTML = list.map(r => {
        const start = new Date(r.startTime).getTime();
        const { windowStart, windowEnd } = calcReportWindow(start, r.duration);
        const status = getStatus(now, windowStart, windowEnd);
        const isOverdue = status === 'overdue';
        const tagText = isOverdue ? '⚠️ 已超时' : '✅ 可报工';
        const tagCls = isOverdue ? 'status-overdue' : 'status-ready';
        const numberText = r.number && r.number.trim() ? escapeHtml(r.number.trim()) : '无编号';
        const modelText = escapeHtml(r.modelName || '（已删除）');

        return `
            <div class="ready-popup-item ${isOverdue ? 'overdue-item' : ''}">
                <div class="info">
                    <span class="item-number"><span class="hash">#</span>${numberText}</span>
                    <span class="item-model">
                        ${modelText}
                        <span class="mini-tag ${tagCls}">${tagText}</span>
                    </span>
                </div>
                <button class="btn btn-success btn-sm" onclick="finishWorkFromPopup('${r.id}')">报工</button>
            </div>
        `;
    }).join('');

    document.getElementById('readyPopup').classList.add('open');
}

function closeReadyPopup() {
    document.getElementById('readyPopup').classList.remove('open');
}

function finishWorkFromPopup(id) {
    closeReadyPopup();
    finishWork(id);
}

// ================================================================
//  渲染
// ================================================================

function renderModelSelect() {
    const select = document.getElementById('modelSelect');
    const currentVal = select.value;
    select.innerHTML = '<option value="">— 请选择型号 —</option>';
    models.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m.id;
        opt.textContent = `${m.name}（定额 ${m.duration}）`;
        select.appendChild(opt);
    });
    if (currentVal && models.some(m => m.id === currentVal)) {
        select.value = currentVal;
    }
}

function renderModels() {
    const container = document.getElementById('modelsContainer');
    if (models.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📦</div>
                <p>暂无型号，请添加</p>
            </div>
        `;
        return;
    }

    let html = '<div class="model-list">';
    models.forEach(m => {
        html += `
            <div class="model-card">
                <div class="model-info">
                    <span class="model-name">${escapeHtml(m.name)}</span>
                    <span class="model-duration">⏱ 定额 <strong>${m.duration}</strong></span>
                </div>
                <div class="model-actions">
                    <button class="btn btn-danger btn-sm" onclick="deleteModel('${m.id}')">删除</button>
                </div>
            </div>
        `;
    });
    html += '</div>';
    container.innerHTML = html;
}

function renderRecords() {
    const container = document.getElementById('recordsContainer');
    const countEl = document.getElementById('recordCount');
    const titleEl = document.getElementById('listTitle');

    if (currentView === 'active') {
        renderActiveView(container, countEl, titleEl);
    } else {
        renderDoneView(container, countEl, titleEl);
    }
}

// ---- 进行中视图（原样保留） ----
function renderActiveView(container, countEl, titleEl) {
    const list = records
        .filter(r => !r.done)
        .sort((a, b) => new Date(a.startTime) - new Date(b.startTime));

    titleEl.textContent = '⏳ 进行中的工件';
    countEl.textContent = `共 ${list.length} 个`;

    if (list.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📭</div>
                <p>暂无进行中的工件，选择型号后点击「开工」开始计时</p>
            </div>
        `;
        return;
    }

    let html = '<div class="records-grid">';
    const now = Date.now();

    list.forEach(r => {
        const start = new Date(r.startTime).getTime();
        const { windowStart, windowEnd } = calcReportWindow(start, r.duration);
        const modelDisplay = escapeHtml(r.modelName || '（已删除）');
        const activeNumberDisplay = r.number ? '编号' + escapeHtml(r.number) : '（无编号）';

        const status = getStatus(now, windowStart, windowEnd);
        const statusMap = {
            waiting: { label: '⏳ 等待报工', cls: 'status-waiting' },
            ready: { label: '✅ 可报工', cls: 'status-ready' },
            overdue: { label: '⚠️ 已超时', cls: 'status-overdue' }
        };
        const statusLabel = statusMap[status].label;
        const statusClass = statusMap[status].cls;

        let countdownText = '';
        let countdownClass = '';
        if (status === 'waiting') {
            const remain = windowStart - now;
            if (remain > 0) {
                countdownText = `⏳ ${formatDuration(remain)} 后可报`;
            } else {
                countdownText = '即将可报工';
                countdownClass = 'ready';
            }
        } else if (status === 'ready') {
            const remain = windowEnd - now;
            countdownText = `✅ 可报（剩 ${formatDuration(remain)}）`;
            countdownClass = 'ready';
        } else {
            const over = now - windowEnd;
            countdownText = `⏰ 超时 ${formatDuration(over)}`;
            countdownClass = 'overdue';
        }

        const isExpanded = expanded[r.id] || false;
        const detailsDisplay = isExpanded ? 'open' : '';
        const deadlineStr = formatTime(windowEnd);

        html += `
            <div class="record-card compact" data-id="${r.id}">
                <div class="record-header-compact">
                    <span class="record-model">${modelDisplay}</span>
                    <span class="status-badge ${statusClass}">${statusLabel}</span>
                </div>
                <div class="record-sub">
                    <span class="record-number">${activeNumberDisplay}</span>
                    <span class="record-deadline">⏰ 最晚 ${deadlineStr}</span>
                </div>
                <div class="record-countdown">
                    <span class="countdown-large ${countdownClass}">${countdownText}</span>
                </div>
                <div class="record-actions">
                    <button class="btn btn-outline btn-sm btn-toggle" onclick="toggleDetails('${r.id}')">
                        <span class="arrow ${isExpanded ? 'open' : ''}">▼</span> 详情
                    </button>
                    ${(status === 'ready' || status === 'overdue') ? `
                        <button class="btn btn-success btn-sm" onclick="finishWork('${r.id}')">✅ 报工</button>
                    ` : `
                        <button class="btn btn-outline btn-sm" disabled style="opacity:0.5;">⏳ 等待</button>
                    `}
                    <button class="btn btn-danger btn-sm" onclick="deleteRecord('${r.id}')">🗑</button>
                </div>
                <div class="record-details ${detailsDisplay}">
                    <div class="row">
                        <span class="label">开工时间</span>
                        <span class="value">${formatTime(start)}</span>
                    </div>
                    <div class="row">
                        <span class="label">报工窗口</span>
                        <span class="value highlight">${formatTime(windowStart)} ~ ${formatTime(windowEnd)}</span>
                    </div>
                    <div class="row">
                        <span class="label">浮动比例</span>
                        <span class="value">±${formatPercent(windowPercent)}</span>
                    </div>
                    <div class="row">
                        <span class="label">工时定额</span>
                        <span class="value">${r.duration}</span>
                    </div>
                </div>
            </div>
        `;
    });

    html += '</div>';
    container.innerHTML = html;
}

// ---- 已报工视图（新：按型号汇总 + 今日工时统计） ----
function renderDoneView(container, countEl, titleEl) {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const todayEnd = todayStart + 86400000;

    // 今日已报工记录
    const todayDone = records.filter(r => {
        if (!r.done || !r.finishTime) return false;
        const t = new Date(r.finishTime).getTime();
        return t >= todayStart && t < todayEnd;
    });

    titleEl.textContent = '✅ 今日已报工';
    countEl.textContent = `共 ${todayDone.length} 个`;

    if (todayDone.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📭</div>
                <p>今天还没有报工记录</p>
            </div>
        `;
        return;
    }

    // 按型号分组
    const groups = new Map();
    let totalHours = 0;

    todayDone.forEach(r => {
        const key = r.modelId || r.modelName || '_unknown';
        if (!groups.has(key)) {
            groups.set(key, {
                modelName: r.modelName || '（已删除）',
                items: []
            });
        }
        groups.get(key).items.push(r);
        totalHours += (r.duration || 0);
    });

    // 组内按编号排序
    groups.forEach(g => {
        g.items.sort((a, b) => {
            const an = (a.number || '').trim();
            const bn = (b.number || '').trim();
            if (an && bn) return an.localeCompare(bn, undefined, { numeric: true });
            if (an) return -1;
            if (bn) return 1;
            return new Date(a.finishTime) - new Date(b.finishTime);
        });
    });

    const groupArr = Array.from(groups.values());
    const totalHoursText = Number.isInteger(totalHours) ? totalHours : totalHours.toFixed(1);

    let html = `
        <div class="done-stats">
            <div class="done-stats-label">📊 今日累计工时</div>
            <div class="done-stats-value">
                ${totalHoursText}<span class="done-stats-unit">工时</span>
            </div>
            <div class="done-stats-meta">
                <span>共 ${todayDone.length} 个工件</span>
                <span class="sep">·</span>
                <span>${groupArr.length} 种型号</span>
            </div>
        </div>
        <div class="done-groups">
    `;

    groupArr.forEach(g => {
        const groupHours = g.items.reduce((s, r) => s + (r.duration || 0), 0);
        const groupHoursText = Number.isInteger(groupHours) ? groupHours : groupHours.toFixed(1);

        html += `
            <div class="done-group">
                <div class="done-group-head">
                    <span class="done-group-model">${escapeHtml(g.modelName)}</span>
                    <span class="done-group-meta">${g.items.length} 个 · ${groupHoursText} 工时</span>
                </div>
                <div class="done-group-numbers">
                    ${g.items.map(r => {
                        const numText = (r.number || '').trim();
                        if (numText) {
                            return `<span class="num-chip"><span class="hash">#</span>${escapeHtml(numText)}</span>`;
                        }
                        return `<span class="num-chip no-num">无编号</span>`;
                    }).join('')}
                </div>
            </div>
        `;
    });

    html += '</div>';
    container.innerHTML = html;
}

// ================================================================
//  工具函数
// ================================================================

function calcReportWindow(startTs, durationMin) {
    const durMs = durationMin * 60 * 1000;
    const ratio = windowPercent / 100;
    return {
        windowStart: startTs + durMs * (1 - ratio),
        windowEnd: startTs + durMs * (1 + ratio)
    };
}

function getStatus(now, windowStart, windowEnd) {
    if (now < windowStart) return 'waiting';
    if (now <= windowEnd) return 'ready';
    return 'overdue';
}

function formatTime(ts) {
    const d = new Date(ts);
    const pad = n => String(n).padStart(2, '0');
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatDuration(ms) {
    if (ms < 0) ms = -ms;
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    if (h > 0) return `${h}h${m}m`;
    if (m > 0) return `${m}m${s}s`;
    return `${s}s`;
}

function formatPercent(p) {
    return Number.isInteger(p) ? `${p}%` : `${p.toFixed(1)}%`;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ================================================================
//  弹窗控制
// ================================================================

function openSettingsModal() {
    document.getElementById('jumpUrlInput').value = jumpUrl;
    document.getElementById('windowPercentInput').value = windowPercent;
    syncPresetChips();
    document.getElementById('settingsModal').classList.add('open');
}

function closeSettingsModal() {
    document.getElementById('settingsModal').classList.remove('open');
}

function openTutorialModal() {
    document.getElementById('tutorialModal').classList.add('open');
}

function closeTutorialModal() {
    document.getElementById('tutorialModal').classList.remove('open');
}

document.querySelectorAll('.modal-overlay').forEach(el => {
    el.addEventListener('click', (e) => {
        if (e.target === el) {
            el.classList.remove('open');
        }
    });
});

// ================================================================
//  Tab 切换
// ================================================================

document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        this.classList.add('active');

        const target = this.dataset.tab;
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
        document.getElementById(target).classList.add('active');

        if (target === 'tab-main') {
            renderRecords();
        } else if (target === 'tab-models') {
            renderModels();
            renderModelSelect();
        }
    });
});

// ================================================================
//  定时刷新
// ================================================================

let timer = null;

function startTimer() {
    if (timer) clearInterval(timer);
    timer = setInterval(() => {
        const panel = document.getElementById('tab-main');
        if (panel.classList.contains('active')) {
            renderRecords();
        }

        const popup = document.getElementById('readyPopup');
        if (popup && !popup.classList.contains('open')) {
            checkAndShowReadyPopup(false);
        }
    }, 1000);
}

// ================================================================
//  初始化
// ================================================================

function init() {
    initTheme();
    loadData();
    renderModels();
    renderModelSelect();
    renderRecords();
    startTimer();
    // 初始视图为「进行中」，隐藏导出栏
    const exportBar = document.getElementById('exportBar');
    if (exportBar) exportBar.style.display = 'none';

    document.getElementById('modelNameInput').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') addModel();
    });
    document.getElementById('modelDurationInput').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') addModel();
    });
    document.getElementById('workNumber').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') startWork();
    });

    const pctInput = document.getElementById('windowPercentInput');
    pctInput.addEventListener('input', syncPresetChips);
    pctInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') saveSettings();
    });
    document.getElementById('jumpUrlInput').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') saveSettings();
    });

    setTimeout(() => checkAndShowReadyPopup(true), 400);
}

init();
console.log('✅ 报工助手（今日工时统计 + 型号汇总）已启动');

// ================================================================
//  深色模式
// ================================================================

const STORAGE_KEY_THEME = 'worktime_theme';

function applyTheme(theme) {
    const root = document.documentElement;
    if (theme === 'dark') {
        root.setAttribute('data-theme', 'dark');
    } else {
        root.removeAttribute('data-theme');
    }
    const btn = document.getElementById('themeToggle');
    if (btn) btn.textContent = (theme === 'dark') ? '☀️' : '🌙';
    // 同步移动端浏览器地址栏颜色
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#12151a' : '#F5A800');
}

function initTheme() {
    let saved = null;
    try { saved = localStorage.getItem(STORAGE_KEY_THEME); } catch (e) {}
    if (!saved) {
        // 跟随系统偏好
        const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        saved = prefersDark ? 'dark' : 'light';
    }
    applyTheme(saved);
}

function toggleTheme() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const next = isDark ? 'light' : 'dark';
    applyTheme(next);
    try { localStorage.setItem(STORAGE_KEY_THEME, next); } catch (e) {}
}

// ================================================================
//  导出 Excel（零依赖生成真正的 .xlsx）
// ================================================================

// --- 极简 ZIP 写入器（store 模式，无压缩，Excel 可直接打开） ---
function _crc32(bytes) {
    let c, crc = 0xFFFFFFFF;
    for (let i = 0; i < bytes.length; i++) {
        c = (crc ^ bytes[i]) & 0xFF;
        for (let k = 0; k < 8; k++) {
            c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
        }
        crc = (crc >>> 8) ^ c;
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
}

function _strToUtf8(str) {
    return new TextEncoder().encode(str);
}

// files: [{name, content(string)}]
function _buildZip(files) {
    const enc = new TextEncoder();
    const chunks = [];
    const central = [];
    let offset = 0;

    function u16(n) { return new Uint8Array([n & 0xFF, (n >>> 8) & 0xFF]); }
    function u32(n) { return new Uint8Array([n & 0xFF, (n >>> 8) & 0xFF, (n >>> 16) & 0xFF, (n >>> 24) & 0xFF]); }
    function concat(arrs) {
        let len = 0; arrs.forEach(a => len += a.length);
        const out = new Uint8Array(len); let p = 0;
        arrs.forEach(a => { out.set(a, p); p += a.length; });
        return out;
    }

    files.forEach(f => {
        const nameBytes = enc.encode(f.name);
        const dataBytes = enc.encode(f.content);
        const crc = _crc32(dataBytes);
        const localHeader = concat([
            u32(0x04034b50), u16(20), u16(0), u16(0), u16(0), u16(0),
            u32(crc), u32(dataBytes.length), u32(dataBytes.length),
            u16(nameBytes.length), u16(0), nameBytes
        ]);
        chunks.push(localHeader, dataBytes);

        const centralHeader = concat([
            u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0),
            u32(crc), u32(dataBytes.length), u32(dataBytes.length),
            u16(nameBytes.length), u16(0), u16(0), u16(0), u16(0),
            u32(0), u32(offset), nameBytes
        ]);
        central.push(centralHeader);
        offset += localHeader.length + dataBytes.length;
    });

    const centralBytes = concat(central);
    const endRecord = concat([
        u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length),
        u32(centralBytes.length), u32(offset), u16(0)
    ]);
    return concat([concat(chunks), centralBytes, endRecord]);
}

function _xmlEscape(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

// 列号 -> 字母（1->A）
function _colLetter(n) {
    let s = '';
    while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
    return s;
}

// rows: 二维数组。第一行为表头（加粗）
function _buildSheetXml(rows) {
    let rowsXml = '';
    rows.forEach((row, rIdx) => {
        let cells = '';
        row.forEach((val, cIdx) => {
            const ref = _colLetter(cIdx + 1) + (rIdx + 1);
            const isNum = typeof val === 'number' && isFinite(val);
            const styleAttr = rIdx === 0 ? ' s="1"' : '';
            if (isNum) {
                cells += `<c r="${ref}"${styleAttr}><v>${val}</v></c>`;
            } else {
                cells += `<c r="${ref}"${styleAttr} t="inlineStr"><is><t xml:space="preserve">${_xmlEscape(val)}</t></is></c>`;
            }
        });
        rowsXml += `<row r="${rIdx + 1}">${cells}</row>`;
    });
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rowsXml}</sheetData></worksheet>`;
}

function _buildXlsxBlob(rows, sheetName) {
    const files = [
        {
            name: '[Content_Types].xml',
            content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`
        },
        {
            name: '_rels/.rels',
            content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`
        },
        {
            name: 'xl/workbook.xml',
            content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${_xmlEscape(sheetName || 'Sheet1')}" sheetId="1" r:id="rId1"/></sheets></workbook>`
        },
        {
            name: 'xl/_rels/workbook.xml.rels',
            content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`
        },
        {
            name: 'xl/styles.xml',
            content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="center"/></xf><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment vertical="center"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`
        },
        {
            name: 'xl/worksheets/sheet1.xml',
            content: _buildSheetXml(rows)
        }
    ];
    const zipBytes = _buildZip(files);
    return new Blob([zipBytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

function _downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function _fmtDateTime(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function _recordsToRows(list) {
    const header = ['型号', '工件编号', '工时定额(分钟)', '开工时间', '报工时间'];
    const rows = [header];
    list.forEach(r => {
        rows.push([
            r.modelName || '（已删除）',
            (r.number || '').trim() || '无编号',
            Number(r.duration) || 0,
            _fmtDateTime(r.startTime),
            _fmtDateTime(r.finishTime)
        ]);
    });
    return rows;
}

function exportExcel() {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const todayEnd = todayStart + 86400000;
    const todayDone = records.filter(r => {
        if (!r.done || !r.finishTime) return false;
        const t = new Date(r.finishTime).getTime();
        return t >= todayStart && t < todayEnd;
    }).sort((a, b) => new Date(a.finishTime) - new Date(b.finishTime));

    if (todayDone.length === 0) { alert('今天还没有报工记录可导出'); return; }

    const rows = _recordsToRows(todayDone);
    const totalHours = todayDone.reduce((s, r) => s + (Number(r.duration) || 0), 0);
    rows.push([]);
    rows.push(['今日合计', `${todayDone.length} 个工件`, totalHours, '', '']);

    const pad = n => String(n).padStart(2, '0');
    const dateStr = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
    const blob = _buildXlsxBlob(rows, '今日报工');
    _downloadBlob(blob, `报工记录_今日_${dateStr}.xlsx`);
}

function exportAllExcel() {
    const done = records.filter(r => r.done && r.finishTime)
        .sort((a, b) => new Date(a.finishTime) - new Date(b.finishTime));
    if (done.length === 0) { alert('还没有任何已报工记录可导出'); return; }

    const rows = _recordsToRows(done);
    const totalHours = done.reduce((s, r) => s + (Number(r.duration) || 0), 0);
    rows.push([]);
    rows.push(['全部合计', `${done.length} 个工件`, totalHours, '', '']);

    const now = new Date();
    const pad = n => String(n).padStart(2, '0');
    const dateStr = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
    const blob = _buildXlsxBlob(rows, '全部报工记录');
    _downloadBlob(blob, `报工记录_全部_${dateStr}.xlsx`);
}
