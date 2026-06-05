const defaultWords = [
    { word: "aberration", phonetic: "", meaning: "n. 异常", pos: "n.", time: "" },
    { word: "benevolent", phonetic: "", meaning: "adj. 慈善的", pos: "adj.", time: "" },
    { word: "candor", phonetic: "", meaning: "n. 坦率", pos: "n.", time: "" },
    { word: "diligent", phonetic: "", meaning: "adj. 勤奋的", pos: "adj.", time: "" },
    { word: "ephemeral", phonetic: "", meaning: "adj. 短暂的", pos: "adj.", time: "" },
    { word: "frugal", phonetic: "", meaning: "adj. 节俭的", pos: "adj.", time: "" },
    { word: "gregarious", phonetic: "", meaning: "adj. 爱社交的", pos: "adj.", time: "" },
    { word: "hapless", phonetic: "", meaning: "adj. 不幸的", pos: "adj.", time: "" },
    { word: "innate", phonetic: "", meaning: "adj. 天生的", pos: "adj.", time: "" },
    { word: "juxtapose", phonetic: "", meaning: "v. 并列", pos: "v.", time: "" }
];

// 给默认单词加上时间戳
defaultWords.forEach(w => { if (!w.time) w.time = new Date().toLocaleString(); });

let pluginSettings = {
    words: defaultWords,
    learned: {},
    currentIndex: 0,
    mode: 'browse',
    panelVisible: false,
    theme: 'dark',
    dailyGoal: 0,
    todayDone: 0,
    lastDate: ''
};

function loadSettings() {
    const saved = localStorage.getItem('WordMemorizer_settings');
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            pluginSettings = Object.assign(pluginSettings, parsed);
            if (!pluginSettings.words?.length) pluginSettings.words = defaultWords;
            if (!pluginSettings.learned) pluginSettings.learned = {};
            if (pluginSettings.currentIndex === undefined) pluginSettings.currentIndex = 0;
            if (!pluginSettings.mode) pluginSettings.mode = 'browse';
            if (!pluginSettings.theme) pluginSettings.theme = 'dark';
            if (!pluginSettings.dailyGoal) pluginSettings.dailyGoal = 0;
            if (!pluginSettings.todayDone) pluginSettings.todayDone = 0;
            // 确保所有单词都有时间戳
            pluginSettings.words.forEach(w => { if (!w.time) w.time = new Date().toLocaleString(); });
            const today = new Date().toDateString();
            if (pluginSettings.lastDate !== today) {
                pluginSettings.todayDone = 0;
                pluginSettings.lastDate = today;
            }
        } catch (e) { console.error('WordMemorizer: 加载失败', e); }
    }
}

function saveSettings() {
    localStorage.setItem('WordMemorizer_settings', JSON.stringify(pluginSettings));
}

function countTodayDone() {
    let done = 0;
    if (pluginSettings.mode === 'test') {
        for (const count of Object.values(pluginSettings.learned)) {
            if (count >= 3) done++;
        }
    } else {
        done = Math.min(pluginSettings.currentIndex + 1, pluginSettings.words.length);
    }
    pluginSettings.todayDone = done;
    saveSettings();
}

function renderProgressBar() {
    const footerDiv = $('#word-memo-progress');
    if (pluginSettings.dailyGoal > 0) {
        const pct = Math.min(100, Math.round((pluginSettings.todayDone / pluginSettings.dailyGoal) * 100));
        footerDiv.html(`
            <div class="progress-bar-container">
                <div class="progress-bar-fill" style="width:${pct}%;">${pct}%</div>
            </div>
            <span class="progress-text" id="word-memo-goal-text">${pluginSettings.todayDone}/${pluginSettings.dailyGoal}</span>
        `);
        // 绑定点击进度文字重新设置目标
        $('#word-memo-goal-text').off('click').on('click', setDailyGoal);
    } else {
        footerDiv.html(`<span id="word-memo-goal-btn" title="设置每日目标">🎯 设置目标</span>`);
        $('#word-memo-goal-btn').off('click').on('click', setDailyGoal);
    }
}

function setDailyGoal() {
    const goal = prompt('请输入今日计划背诵的单词数量（0 表示取消目标）：', pluginSettings.dailyGoal || 20);
    if (goal !== null) {
        const num = parseInt(goal, 10);
        if (!isNaN(num) && num >= 0) {
            pluginSettings.dailyGoal = num;
            if (num === 0) pluginSettings.todayDone = 0;
            saveSettings();
            renderProgressBar();
        }
    }
}

// ========== 查看词库弹窗 ==========
function showWordListDialog() {
    $('#word-list-modal').remove();
    const words = pluginSettings.words;
    let listHtml = '';
    if (words.length === 0) {
        listHtml = '<p style="text-align:center;padding:20px;">词库为空</p>';
    } else {
        listHtml = '<div class="word-list-scroll">';
        words.forEach((w, i) => {
            listHtml += `
                <div class="word-list-item">
                    <span class="word-list-index">${i + 1}.</span>
                    <span class="word-list-word">${w.word}</span>
                    <span class="word-list-meaning">${w.meaning}</span>
                    <span class="word-list-time">${w.time || '未知'}</span>
                </div>`;
        });
        listHtml += '</div>';
    }

    const modalHtml = `
    <div id="word-list-modal" class="word-import-modal">
        <div class="word-import-content" style="max-height:80vh; display:flex; flex-direction:column;">
            <div class="word-import-header">
                <span>📚 词库列表 (共${words.length}个)</span>
                <button id="word-list-close" class="word-memo-close-btn">✕</button>
            </div>
            <div style="overflow-y:auto; flex:1;">
                ${listHtml}
            </div>
            <div class="word-import-footer">
                <button id="word-list-clear" class="word-memo-mode-btn" style="color:#ff7b7b;">清空词库</button>
                <button id="word-list-close2" class="word-memo-mode-btn active">关闭</button>
            </div>
        </div>
    </div>`;

    $('body').append(modalHtml);

    $('#word-list-close, #word-list-close2').on('click', () => $('#word-list-modal').remove());
    $('#word-list-clear').on('click', () => {
        if (confirm('确定要清空所有词库吗？此操作不可恢复！')) {
            pluginSettings.words = [];
            pluginSettings.learned = {};
            pluginSettings.currentIndex = 0;
            saveSettings();
            renderWordCard();
            $('#word-list-modal').remove();
        }
    });
    $('#word-list-modal').on('click', function(e) { if (e.target === this) $(this).remove(); });
}

// ========== 导入词库 ==========
function parseWordList(text) {
    const lines = text.split(/[\r\n]+/).map(l => l.trim()).filter(l => l.length > 0);
    const parsed = [];
    const regex = /^(?:\d+\.\s*)?(\S+)\s+(?:([a-z]+)\.\s+)?(.+)$/i;
    const now = new Date().toLocaleString();
    for (const line of lines) {
        const match = line.match(regex);
        if (!match) continue;
        const word = match[1].toLowerCase();
        const pos = match[2] ? match[2].toLowerCase() + '.' : '';
        let meaning = match[3].trim();
        if (pos && !meaning.startsWith(pos)) meaning = `${pos} ${meaning}`;
        parsed.push({ word, phonetic: '', meaning, pos: pos || '', time: now });
    }
    return parsed;
}

function importWords(text) {
    const newWords = parseWordList(text);
    if (newWords.length === 0) {
        alert('没有识别到有效单词。格式示例：1.good adj.好的');
        return 0;
    }
    let added = 0;
    const existingWords = new Set(pluginSettings.words.map(w => w.word));
    for (const nw of newWords) {
        if (!existingWords.has(nw.word)) {
            pluginSettings.words.push(nw);
            existingWords.add(nw.word);
            added++;
        }
    }
    saveSettings();
    return added;
}

function showImportDialog() {
    $('#word-import-modal').remove();
    const modalHtml = `
    <div id="word-import-modal" class="word-import-modal">
        <div class="word-import-content">
            <div class="word-import-header">
                <span>📥 批量导入单词</span>
                <button id="word-import-close" class="word-memo-close-btn">✕</button>
            </div>
            <textarea id="word-import-textarea" placeholder="请粘贴单词列表，每行一个，例如：&#10;1.good adj.好的&#10;2.apple n.苹果"></textarea>
            <div class="word-import-footer">
                <button id="word-import-cancel" class="word-memo-mode-btn">取消</button>
                <button id="word-import-submit" class="word-memo-mode-btn active">导入</button>
            </div>
        </div>
    </div>`;
    $('body').append(modalHtml);
    $('#word-import-close, #word-import-cancel').on('click', () => $('#word-import-modal').remove());
    $('#word-import-submit').on('click', () => {
        const text = $('#word-import-textarea').val().trim();
        if (!text) return;
        const added = importWords(text);
        if (added > 0) alert(`成功导入 ${added} 个新单词！`);
        else alert('没有新单词被导入。');
        $('#word-import-modal').remove();
        renderWordCard();
    });
    $('#word-import-modal').on('click', function(e) { if (e.target === this) $(this).remove(); });
}

// ========== 悬浮球 ==========
function createFloatingBall() {
    if ($('#word-memo-floating-ball').length) return;
    const ballHtml = `<div id="word-memo-floating-ball" class="word-memo-floating-ball" title="打开单词面板" style="display:none;">📕</div>`;
    $('body').append(ballHtml);

    const ball = document.getElementById('word-memo-floating-ball');
    let isDragging = false, startX, startY, initialLeft, initialTop, hasMoved = false;

    ball.addEventListener('touchstart', function(e) {
        isDragging = true;
        hasMoved = false;
        const touch = e.touches[0];
        startX = touch.clientX;
        startY = touch.clientY;
        const rect = ball.getBoundingClientRect();
        initialLeft = rect.left;
        initialTop = rect.top;
        ball.style.transition = 'none';
        e.preventDefault();
    }, { passive: false });

    document.addEventListener('touchmove', function(e) {
        if (!isDragging) return;
        const touch = e.touches[0];
        const dx = touch.clientX - startX;
        const dy = touch.clientY - startY;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) hasMoved = true;
        ball.style.left = (initialLeft + dx) + 'px';
        ball.style.top = (initialTop + dy) + 'px';
        e.preventDefault();
    }, { passive: false });

    document.addEventListener('touchend', function() {
        if (isDragging) {
            isDragging = false;
            ball.style.transition = '';
        }
    });

    ball.addEventListener('click', function(e) {
        if (hasMoved) { hasMoved = false; return; }
        restorePanel();
    });
}

function minimizePanel() {
    $('#word-memorizer-panel').hide();
    pluginSettings.panelVisible = false;
    createFloatingBall();
    // 强制显示悬浮球
    const ball = $('#word-memo-floating-ball');
    ball.css({
        display: 'flex',
        bottom: '80px',
        right: '20px'
    });
    saveSettings();
}

function restorePanel() {
    $('#word-memo-floating-ball').hide();
    $('#word-memorizer-panel').show();
    pluginSettings.panelVisible = true;
    renderWordCard();
    saveSettings();
}

// ========== 面板拖拽 ==========
function enablePanelDrag() {
    const panel = document.getElementById('word-memorizer-panel');
    if (!panel) return;
    const header = panel.querySelector('.word-memo-header');
    if (!header) return;
    let isDragging = false, startX, startY, initialLeft, initialTop;

    header.addEventListener('touchstart', function(e) {
        if (e.target.tagName === 'BUTTON') return;
        isDragging = true;
        const touch = e.touches[0];
        startX = touch.clientX;
        startY = touch.clientY;
        const rect = panel.getBoundingClientRect();
        initialLeft = rect.left;
        initialTop = rect.top;
        panel.style.transition = 'none';
        e.preventDefault();
    }, { passive: false });

    document.addEventListener('touchmove', function(e) {
        if (!isDragging) return;
        const touch = e.touches[0];
        const dx = touch.clientX - startX;
        const dy = touch.clientY - startY;
        panel.style.left = (initialLeft + dx) + 'px';
        panel.style.top = (initialTop + dy) + 'px';
        e.preventDefault();
    }, { passive: false });

    document.addEventListener('touchend', function() {
        if (isDragging) { isDragging = false; panel.style.transition = ''; }
    });
}

// ========== 创建面板 ==========
function createPanel() {
    if ($('#word-memorizer-panel').length) return;
    const panelHtml = `
    <div id="word-memorizer-panel" class="word-memo-panel ${pluginSettings.theme}" style="display:none;">
        <div class="word-memo-header">
            <span>📘 该背单词啦</span>
            <div>
                <button id="word-memo-list-btn" class="word-memo-mode-btn" title="查看词库">📚</button>
                <button id="word-memo-theme-toggle" class="word-memo-mode-btn" title="切换日间/夜间">🌓</button>
                <button id="word-memo-mode-browse" class="word-memo-mode-btn ${pluginSettings.mode==='browse'?'active':''}">浏览</button>
                <button id="word-memo-mode-test" class="word-memo-mode-btn ${pluginSettings.mode==='test'?'active':''}">测试</button>
                <button id="word-memo-import-btn" class="word-memo-mode-btn" title="导入词库">📥</button>
                <button id="word-memo-minimize" class="word-memo-minimize-btn" title="最小化">－</button>
                <button id="word-memo-close" class="word-memo-close-btn">✕</button>
            </div>
        </div>
        <div class="word-memo-body" id="word-memo-body"></div>
        <div class="word-memo-footer" id="word-memo-footer">
            <div id="word-memo-progress" style="flex:1;"></div>
            <div style="display:flex;">
                <button id="word-memo-prev">◀</button>
                <button id="word-memo-next">▶</button>
            </div>
        </div>
    </div>`;
    $('body').append(panelHtml);

    enablePanelDrag();

    $('#word-memo-list-btn').on('click', showWordListDialog);
    $('#word-memo-theme-toggle').on('click', () => {
        pluginSettings.theme = pluginSettings.theme === 'dark' ? 'light' : 'dark';
        $('#word-memorizer-panel').removeClass('dark light').addClass(pluginSettings.theme);
        saveSettings();
    });
    $('#word-memo-import-btn').on('click', showImportDialog);
    $('#word-memo-minimize').on('click', minimizePanel);
    $('#word-memo-close').on('click', () => {
        $('#word-memorizer-panel').hide();
        $('#word-memo-floating-ball').hide();
        pluginSettings.panelVisible = false;
        saveSettings();
    });
    $('#word-memo-mode-browse').on('click', function() {
        pluginSettings.mode = 'browse';
        $(this).addClass('active');
        $('#word-memo-mode-test').removeClass('active');
        renderWordCard();
        saveSettings();
    });
    $('#word-memo-mode-test').on('click', function() {
        pluginSettings.mode = 'test';
        $(this).addClass('active');
        $('#word-memo-mode-browse').removeClass('active');
        pluginSettings.currentIndex = getRandomIndexForTest();
        renderWordCard();
        saveSettings();
    });
    $('#word-memo-prev').on('click', () => {
        if (pluginSettings.mode === 'test') {
            pluginSettings.currentIndex = getRandomIndexForTest();
        } else {
            pluginSettings.currentIndex = (pluginSettings.currentIndex - 1 + pluginSettings.words.length) % pluginSettings.words.length;
            countTodayDone();
        }
        renderWordCard();
        saveSettings();
    });
    $('#word-memo-next').on('click', () => {
        if (pluginSettings.mode === 'test') {
            pluginSettings.currentIndex = getRandomIndexForTest();
        } else {
            pluginSettings.currentIndex = (pluginSettings.currentIndex + 1) % pluginSettings.words.length;
            countTodayDone();
        }
        renderWordCard();
        saveSettings();
    });
    $(document).on('click', '#word-memo-undo', function(e) {
        e.stopPropagation();
        handleUndoUnknown();
    });
}

// ========== 测试模式逻辑 ==========
function handleKnowShowMeaning() {
    const idx = pluginSettings.currentIndex;
    if (!pluginSettings.learned[idx]) pluginSettings.learned[idx] = 0;
    pluginSettings.learned[idx] = Math.min(3, pluginSettings.learned[idx] + 1);
    countTodayDone();
    saveSettings();
    $('#word-buttons-know').hide();
    $('#word-meaning-area').show();
}

function handleUnknownShowMeaning() {
    const idx = pluginSettings.currentIndex;
    pluginSettings.learned[idx] = 0;
    countTodayDone();
    saveSettings();
    $('#word-buttons-know').hide();
    $('#word-meaning-area').show();
}

function handleUndoUnknown() {
    const idx = pluginSettings.currentIndex;
    pluginSettings.learned[idx] = 0;
    countTodayDone();
    renderWordCard();
    saveSettings();
}

function getRandomIndexForTest() {
    const words = pluginSettings.words;
    if (words.length === 0) return 0;
    const unmastered = words.map((_, i) => i).filter(i => (pluginSettings.learned[i] || 0) < 3);
    if (unmastered.length === 0) {
        for (const key in pluginSettings.learned) {
            if (pluginSettings.learned[key] >= 3) pluginSettings.learned[key] = 0;
        }
        return Math.floor(Math.random() * words.length);
    }
    return unmastered[Math.floor(Math.random() * unmastered.length)];
}

// ========== 渲染单词卡片 ==========
function renderWordCard() {
    const words = pluginSettings.words;
    const index = pluginSettings.currentIndex;
    if (!words.length) {
        $('#word-memo-body').html('<p>词库为空，请导入单词</p>');
        return;
    }
    const currentWord = words[index];
    const learnedCount = pluginSettings.learned[index] || 0;
    const isMastered = learnedCount >= 3;

    renderProgressBar();

    let cardHtml = '';
    if (pluginSettings.mode === 'browse') {
        cardHtml = `
            <div class="word-card">
                <div class="word-main">${currentWord.word}</div>
                <div class="word-phonetic">${currentWord.phonetic || ''}</div>
                <div class="word-meaning">${currentWord.meaning}</div>
                <div class="word-status">${isMastered ? '✅ 已掌握' : '🆕 学习中'}</div>
            </div>`;
    } else {
        cardHtml = `
            <div class="word-card" id="word-card-test">
                <div class="word-main">${currentWord.word}</div>
                <div class="word-phonetic">${currentWord.phonetic || ''}</div>
                <div class="word-buttons" id="word-buttons-know">
                    <button id="word-memo-know" class="word-memo-know-btn">认识</button>
                    <button id="word-memo-unknown" class="word-memo-unknown-btn">不认识</button>
                </div>
                <div class="word-meaning word-meaning-hidden" id="word-meaning-area" style="display:none;">
                    ${currentWord.meaning}
                    <div class="word-undo-area">
                        <button id="word-memo-undo" class="word-memo-undo-btn">↩ 不认识</button>
                    </div>
                </div>
                <div class="word-status">${isMastered ? '✅ 已掌握' : '🆕 学习中 (' + learnedCount + '/3)'}</div>
            </div>`;

        setTimeout(() => {
            $('#word-card-test').off('click').on('click', function(e) {
                if (e.target.tagName === 'BUTTON') return;
                const meaningArea = $('#word-meaning-area');
                if (meaningArea.is(':visible')) {
                    meaningArea.hide();
                    $('#word-buttons-know').show();
                }
            });

            $('#word-memo-know, #word-memo-unknown').off('click').on('click', function(e) {
                e.stopPropagation();
                if (e.target.id === 'word-memo-know') {
                    handleKnowShowMeaning();
                } else {
                    handleUnknownShowMeaning();
                }
            });
        }, 0);
    }

    $('#word-memo-body').html(cardHtml);
}

// ========== 工具栏按钮 ==========
function addToolbarButton() {
    const btnHtml = `<div id="word-memorizer-btn" style="font-size:14px; font-weight:bold; color:#b5a0ff; padding:4px 8px; cursor:pointer;" title="打开单词面板">该背单词啦</div>`;
    const targetBar = $('#extensionsMenu');
    if (targetBar.length) {
        targetBar.append(btnHtml);
    } else {
        $('.input-group').first().before(btnHtml);
    }
    $(document).on('click', '#word-memorizer-btn', () => {
        const panel = $('#word-memorizer-panel');
        if (panel.is(':visible')) {
            minimizePanel();
        } else {
            restorePanel();
        }
    });
}

// ========== 初始化 ==========
jQuery(async () => {
    loadSettings();
    createPanel();
    createFloatingBall();
    addToolbarButton();

    if (pluginSettings.panelVisible) {
        $('#word-memorizer-panel').show();
        $('#word-memo-floating-ball').hide();
        renderWordCard();
    } else {
        // 默认显示悬浮球
        const ball = $('#word-memo-floating-ball');
        ball.css({
            display: 'flex',
            bottom: '80px',
            right: '20px'
        });
    }

    console.log('WordMemorizer v3.3 已加载 (悬浮球+词库查看+目标修改)');
});
