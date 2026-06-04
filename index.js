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
    learned: [],
    currentIndex: 0,
    mode: 'browse',
    panelVisible: false
};

function loadSettings() {
    const saved = localStorage.getItem('WordMemorizer_settings');
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            pluginSettings = Object.assign(pluginSettings, parsed);
            if (!pluginSettings.words?.length) pluginSettings.words = defaultWords;
            if (!pluginSettings.learned) pluginSettings.learned = [];
            if (pluginSettings.currentIndex === undefined) pluginSettings.currentIndex = 0;
            if (!pluginSettings.mode) pluginSettings.mode = 'browse';
        } catch (e) { console.error('WordMemorizer: 加载失败', e); }
    }
}

function saveSettings() {
    localStorage.setItem('WordMemorizer_settings', JSON.stringify(pluginSettings));
}

// 解析导入的单词文本
function parseWordList(text) {
    const lines = text.split(/[\r\n]+/).map(l => l.trim()).filter(l => l.length > 0);
    const parsed = [];
    const regex = /^(?:\d+\.\s*)?(\S+)\s+(?:([a-z]+)\.\s+)?(.+)$/i;
    for (const line of lines) {
        const match = line.match(regex);
        if (!match) continue;
        const word = match[1].toLowerCase();
        const pos = match[2] ? match[2].toLowerCase() + '.' : '';
        const meaningRaw = match[3].trim();
        // 如果词性存在，把它加到释义前面以便显示（统一存储格式）
        let meaning = pos ? `${pos} ${meaningRaw}` : meaningRaw;
        // 避免已有词性重复：如果 meaning 已经以 pos 开头，则不重复
        if (pos && meaning.startsWith(pos + ' ')) {
            // 保持
        } else if (pos) {
            meaning = `${pos} ${meaning}`;
        }
        parsed.push({
            word: word,
            phonetic: '',
            meaning: meaning,
            pos: pos || ''
        });
    }
    return parsed;
}

// 导入词库
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

// 创建导入对话框
function showImportDialog() {
    // 移除已有的导入框
    $('#word-import-modal').remove();

    const modalHtml = `
    <div id="word-import-modal" class="word-import-modal">
        <div class="word-import-content">
            <div class="word-import-header">
                <span>📥 批量导入单词</span>
                <button id="word-import-close" class="word-memo-close-btn">✕</button>
            </div>
            <textarea id="word-import-textarea" placeholder="请粘贴单词列表，每行一个，例如：&#10;1.good adj.好的&#10;2.apple n.苹果&#10;happy 快乐的"></textarea>
            <div class="word-import-footer">
                <button id="word-import-cancel" class="word-memo-mode-btn">取消</button>
                <button id="word-import-submit" class="word-memo-mode-btn active">导入</button>
            </div>
        </div>
    </div>`;

    $('body').append(modalHtml);

    $('#word-import-close, #word-import-cancel').on('click', () => {
        $('#word-import-modal').remove();
    });

    $('#word-import-submit').on('click', () => {
        const text = $('#word-import-textarea').val().trim();
        if (!text) {
            alert('请粘贴单词内容');
            return;
        }
        const added = importWords(text);
        if (added > 0) {
            alert(`成功导入 ${added} 个新单词！`);
            renderWordCard();  // 刷新面板显示
        } else {
            alert('没有新单词被导入，可能已存在。');
        }
        $('#word-import-modal').remove();
    });

    // 点击背景关闭
    $('#word-import-modal').on('click', function(e) {
        if (e.target === this) $(this).remove();
    });
}

function createPanel() {
    if ($('#word-memorizer-panel').length) return;

    const panelHtml = `
    <div id="word-memorizer-panel" class="word-memo-panel" style="display:none;">
        <div class="word-memo-header">
            <span>📘 单词记忆</span>
            <div>
                <button id="word-memo-mode-browse" class="word-memo-mode-btn active">浏览</button>
                <button id="word-memo-mode-test" class="word-memo-mode-btn">测试</button>
                <button id="word-memo-import-btn" class="word-memo-mode-btn" title="导入词库">📥</button>
                <button id="word-memo-close" class="word-memo-close-btn">✕</button>
            </div>
        </div>
        <div class="word-memo-body" id="word-memo-body"></div>
        <div class="word-memo-footer">
            <span id="word-memo-progress"></span>
            <div>
                <button id="word-memo-prev">◀</button>
                <button id="word-memo-next">▶</button>
            </div>
        </div>
    </div>`;

    $('body').append(panelHtml);

    if (!window.matchMedia('(pointer: coarse)').matches) {
        $('#word-memorizer-panel').draggable({
            handle: '.word-memo-header',
            containment: 'window',
            opacity: 0.8
        });
    }

    // 导入按钮事件
    $('#word-memo-import-btn').on('click', () => {
        showImportDialog();
    });

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
        pluginSettings.currentIndex = getRandomUntestedIndex();
        renderWordCard();
        saveSettings();
    });

    $('#word-memo-prev').on('click', () => {
        if (pluginSettings.mode === 'test') {
            pluginSettings.currentIndex = getRandomUntestedIndex();
        } else {
            pluginSettings.currentIndex = (pluginSettings.currentIndex - 1 + pluginSettings.words.length) % pluginSettings.words.length;
        }
        renderWordCard();
        saveSettings();
    });

    $('#word-memo-next').on('click', () => {
        if (pluginSettings.mode === 'test') {
            pluginSettings.currentIndex = getRandomUntestedIndex();
        } else {
            pluginSettings.currentIndex = (pluginSettings.currentIndex + 1) % pluginSettings.words.length;
        }
        renderWordCard();
        saveSettings();
    });

    $(document).on('click', '#word-memo-know', function() {
        const idx = pluginSettings.currentIndex;
        if (!pluginSettings.learned.includes(idx)) pluginSettings.learned.push(idx);
        pluginSettings.currentIndex = getRandomUntestedIndex();
        renderWordCard();
        saveSettings();
    });

    $(document).on('click', '#word-memo-unknown', function() {
        const idx = pluginSettings.currentIndex;
        pluginSettings.learned = pluginSettings.learned.filter(i => i !== idx);
        pluginSettings.currentIndex = getRandomUntestedIndex();
        renderWordCard();
        saveSettings();
    });
}

function getRandomUntestedIndex() {
    const words = pluginSettings.words;
    const learned = pluginSettings.learned;
    if (learned.length >= words.length) {
        pluginSettings.learned = [];
        return Math.floor(Math.random() * words.length);
    }
    const unlearned = words.map((_, i) => i).filter(i => !learned.includes(i));
    return unlearned[Math.floor(Math.random() * unlearned.length)];
}

function renderWordCard() {
    const words = pluginSettings.words;
    const total = words.length;
    const learnedCount = pluginSettings.learned.length;
    const index = pluginSettings.currentIndex;

    if (total === 0) {
        $('#word-memo-body').html('<p>词库为空，请导入单词</p>');
        return;
    }

    const currentWord = words[index];
    const isLearned = pluginSettings.learned.includes(index);
    $('#word-memo-progress').text(`${pluginSettings.mode === 'test' ? '📝 测试' : '📖 浏览'} | ${learnedCount}/${total}`);

    let cardHtml = '';
    if (pluginSettings.mode === 'browse') {
        cardHtml = `
            <div class="word-card">
                <div class="word-main">${currentWord.word}</div>
                <div class="word-phonetic">${currentWord.phonetic || ''}</div>
                <div class="word-meaning">${currentWord.meaning}</div>
                <div class="word-status">${isLearned ? '✅ 已掌握' : '🆕 新词'}</div>
            </div>`;
    } else {
        cardHtml = `
            <div class="word-card" id="word-card-test">
                <div class="word-main">${currentWord.word}</div>
                <div class="word-phonetic">${currentWord.phonetic || ''}</div>
                <div class="word-meaning" style="display:none;">${currentWord.meaning}</div>
                <div class="word-status">${isLearned ? '✅ 已掌握' : '🆕 新词'}</div>
                <div class="test-buttons" style="display:none;">
                    <button id="word-memo-know" class="word-memo-know-btn">认识</button>
                    <button id="word-memo-unknown" class="word-memo-unknown-btn">不认识</button>
                </div>
            </div>`;
        setTimeout(() => {
            $('#word-card-test').off('click').on('click', function(e) {
                if (e.target.tagName === 'BUTTON') return;
                $(this).find('.word-meaning').toggle();
                $(this).find('.test-buttons').toggle();
            });
        }, 0);
    }

    $('#word-memo-body').html(cardHtml);
}

function addToolbarButton() {
    const btnHtml = `<div id="word-memorizer-btn" class="fa-solid fa-book-open" title="单词记忆"></div>`;
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
    console.log('WordMemorizer 已加载 (import ready)');
});
