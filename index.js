const defaultWords = [
    { word: "aberration", phonetic: "", meaning: "n. 异常", pos: "n." },
    { word: "benevolent", phonetic: "", meaning: "adj. 慈善的", pos: "adj." },
    { word: "candor", phonetic: "", meaning: "n. 坦率", pos: "n." },
    { word: "diligent", phonetic: "", meaning: "adj. 勤奋的", pos: "adj." },
    { word: "ephemeral", phonetic: "", meaning: "adj. 短暂的", pos: "adj." },
    { word: "frugal", phonetic: "", meaning: "adj. 节俭的", pos: "adj." },
    { word: "gregarious", phonetic: "", meaning: "adj. 爱社交的", pos: "adj." },
    { word: "hapless", phonetic: "", meaning: "adj. 不幸的", pos: "adj." },
    { word: "innate", phonetic: "", meaning: "adj. 天生的", pos: "adj." },
    { word: "juxtapose", phonetic: "", meaning: "v. 并列", pos: "v." }
];

let pluginSettings = {
    words: defaultWords,
    // learned 现在存的是 { index: count }，count 表示连续认识次数（最多3）
    learned: {},
    currentIndex: 0,
    mode: 'browse',          // 'browse' | 'test'
    panelVisible: false,
    theme: 'dark',           // 'dark' | 'light'
    dailyGoal: 0,            // 0 表示未设置
    todayDone: 0,            // 今日已掌握数量
    lastDate: ''             // 用于跨天重置
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
            // 跨天重置
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

// 今日已掌握数量（测试连续3次认识 / 浏览划到下一个）
function countTodayDone() {
    let done = 0;
    if (pluginSettings.mode === 'test') {
        // 连续认识次数达到3
        for (const count of Object.values(pluginSettings.learned)) {
            if (count >= 3) done++;
        }
    } else {
        // 浏览模式：以当前索引作为已浏览数量（简化处理）
        done = Math.min(pluginSettings.currentIndex + 1, pluginSettings.words.length);
    }
    pluginSettings.todayDone = done;
    saveSettings();
}

// 渲染进度条
function renderProgressBar() {
    if (pluginSettings.dailyGoal > 0) {
        const pct = Math.min(100, Math.round((pluginSettings.todayDone / pluginSettings.dailyGoal) * 100));
        $('#word-memo-progress').html(`
            <div class="progress-bar-container">
                <div class="progress-bar-fill" style="width:${pct}%;">${pct}%</div>
            </div>
            <span class="progress-text">${pluginSettings.todayDone}/${pluginSettings.dailyGoal}</span>
        `);
    } else {
        $('#word-memo-progress').html(`<span id="word-memo-goal-btn" title="设置每日目标">🎯 设置目标</span>`);
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

// 解析导入
function parseWordList(text) {
    const lines = text.split(/[\r\n]+/).map(l => l.trim()).filter(l => l.length > 0);
    const parsed = [];
    const regex = /^(?:\d+\.\s*)?(\S+)\s+(?:([a-z]+)\.\s+)?(.+)$/i;
    for (const line of lines) {
        const match = line.match(regex);
        if (!match) continue;
        const word = match[1].toLowerCase();
        const pos = match[2] ? match[2].toLowerCase() + '.' : '';
        let meaning = match[3].trim();
        if (pos && !meaning.startsWith(pos)) meaning = `${pos} ${meaning}`;
        parsed.push({ word, phonetic: '', meaning, pos: pos || '' });
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

function createPanel() {
    if ($('#word-memorizer-panel').length) return;
    const panelHtml = `
    <div id="word-memorizer-panel" class="word-memo-panel ${pluginSettings.theme}" style="display:none;">
        <div class="word-memo-header">
            <span>📘 该背单词啦</span>
            <div>
                <button id="word-memo-theme-toggle" class="word-memo-mode-btn" title="切换日间/夜间">🌓</button>
                <button id="word-memo-mode-browse" class="word-memo-mode-btn ${pluginSettings.mode==='browse'?'active':''}">浏览</button>
                <button id="word-memo-mode-test" class="word-memo-mode-btn ${pluginSettings.mode==='test'?'active':''}">测试</button>
                <button id="word-memo-import-btn" class="word-memo-mode-btn" title="导入词库">📥</button>
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
    applyTheme();

    if (!window.matchMedia('(pointer: coarse)').matches) {
        $('#word-memorizer-panel').draggable({ handle: '.word-memo-header', containment: 'window', opacity: 0.8 });
    }

    $('#word-memo-theme-toggle').on('click', () => {
        pluginSettings.theme = pluginSettings.theme === 'dark' ? 'light' : 'dark';
        $('#word-memorizer-panel').removeClass('dark light').addClass(pluginSettings.theme);
        saveSettings();
    });

    $('#word-memo-import-btn').on('click', showImportDialog);
    $('#word-memo-close').on('click', () => {
        $('#word-memorizer-panel').hide();
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

    // 委托事件：认识/不认识/撤回
    $(document).on('click', '#word-memo-know', function() {
        handleKnow();
    });
    $(document).on('click', '#word-memo-unknown', function() {
        handleUnknown();
    });
    $(document).on('click', '#word-memo-undo', function(e) {
        e.stopPropagation();
        handleUndoUnknown();
    });
}

function handleKnow() {
    const idx = pluginSettings.currentIndex;
    if (!pluginSettings.learned[idx]) pluginSettings.learned[idx] = 0;
    pluginSettings.learned[idx] = Math.min(3, pluginSettings.learned[idx] + 1);
    countTodayDone();
    pluginSettings.currentIndex = getRandomIndexForTest();
    renderWordCard();
    saveSettings();
}

function handleUnknown() {
    const idx = pluginSettings.currentIndex;
    pluginSettings.learned[idx] = 0;
    countTodayDone();
    pluginSettings.currentIndex = getRandomIndexForTest();
    renderWordCard();
    saveSettings();
}

function handleUndoUnknown() {
    // 把当前单词的认识次数重置为0
    const idx = pluginSettings.currentIndex;
    pluginSettings.learned[idx] = 0;
    countTodayDone();
    renderWordCard(); // 重新渲染当前卡片（仍然显示释义和按钮）
    saveSettings();
}

function getRandomIndexForTest() {
    const words = pluginSettings.words;
    // 优先从未掌握（连续<3）的单词中选取
    const unmastered = words.map((_, i) => i).filter(i => (pluginSettings.learned[i] || 0) < 3);
    if (unmastered.length === 0) {
        // 全部掌握，重置部分
        for (const key in pluginSettings.learned) {
            if (pluginSettings.learned[key] >= 3) pluginSettings.learned[key] = 0;
        }
        return Math.floor(Math.random() * words.length);
    }
    return unmastered[Math.floor(Math.random() * unmastered.length)];
}

function renderWordCard() {
    const words = pluginSettings.words;
    const index = pluginSettings.currentIndex;
    if (!words.length) {
        $('#word-memo-body').html('<p>词库为空</p>');
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

        // 绑定卡片点击显示释义
        setTimeout(() => {
            $('#word-card-test').off('click').on('click', function(e) {
                if (e.target.tagName === 'BUTTON') return;
                // 如果释义已经显示，则隐藏
                const meaningArea = $('#word-meaning-area');
                if (meaningArea.is(':visible')) {
                    meaningArea.hide();
                    $('#word-buttons-know').show();
                }
            });

            // “认识”或“不认识”后自动显示释义
            $('#word-memo-know, #word-memo-unknown').off('click').on('click', function(e) {
                e.stopPropagation();
                const isKnow = e.target.id === 'word-memo-know';
                if (isKnow) {
                    handleKnowShowMeaning();
                } else {
                    handleUnknownShowMeaning();
                }
            });
        }, 0);
    }

    $('#word-memo-body').html(cardHtml);
}

function handleKnowShowMeaning() {
    const idx = pluginSettings.currentIndex;
    if (!pluginSettings.learned[idx]) pluginSettings.learned[idx] = 0;
    pluginSettings.learned[idx] = Math.min(3, pluginSettings.learned[idx] + 1);
    countTodayDone();
    saveSettings();
    // 显示释义，隐藏认识/不认识按钮
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

function applyTheme() {
    const panel = $('#word-memorizer-panel');
    panel.removeClass('dark light').addClass(pluginSettings.theme);
}

function addToolbarButton() {
    const btnHtml = `<div id="word-memorizer-btn" class="fa-solid fa-book-open" title="该背单词啦"></div>`;
    const targetBar = $('#extensionsMenu');
    if (targetBar.length) {
        targetBar.append(btnHtml);
    } else {
        $('.input-group').first().before(btnHtml);
    }
    $(document).on('click', '#word-memorizer-btn', () => {
        const panel = $('#word-memorizer-panel');
        if (panel.is(':visible')) {
            panel.hide();
            pluginSettings.panelVisible = false;
        } else {
            panel.show();
            pluginSettings.panelVisible = true;
            renderWordCard();
        }
        saveSettings();
    });
}

jQuery(async () => {
    loadSettings();
    createPanel();
    addToolbarButton();
    if (pluginSettings.panelVisible) {
        $('#word-memorizer-panel').show();
        renderWordCard();
    }
    console.log('WordMemorizer v3.0 已加载');
});
