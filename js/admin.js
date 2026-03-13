(function() {  'use strict';

  // === Конфигурация ===
  const ADMIN_PASSWORD = 'kz27';
  const LANGUAGES = ['ru', 'kz', 'uz', 'en', 'tk'];
  const LANG_NAMES = {
    ru: 'Русский',
    kz: 'Қазақша',
    uz: 'O\'zbekcha',
    en: 'English',
    tk: 'Türkmençe'
  };

  // === Состояние ===
  let isLoggedIn = false;
  let categories = [];
  let cards = [];
  let currentCardId = null;
  let currentLang = 'ru';
  let unsavedChanges = false;

  let formData = {
    title: {},
    description: {},
    checklist: {},
    sections: {}
  };

  // === Элементы ===
  const elements = {};

  // === Инициализация ===
  document.addEventListener('DOMContentLoaded', init);

  function init() {
    cacheElements();
    bindEvents();
    checkAuth();
  }

  function cacheElements() {
    elements.authScreen = document.getElementById('auth-screen');
    elements.authForm = document.getElementById('auth-form');
    elements.authPassword = document.getElementById('admin-password');
    elements.authError = document.getElementById('auth-error');
    elements.adminPanel = document.getElementById('admin-panel');
    elements.logoutBtn = document.getElementById('logout-btn');
    elements.cardsList = document.getElementById('cards-list');
    elements.addCardBtn = document.getElementById('add-card-btn');
    elements.editorPlaceholder = document.getElementById('editor-placeholder');
    elements.editorForm = document.getElementById('editor-form');
    elements.cardId = document.getElementById('card-id');
    elements.langTabs = document.getElementById('lang-tabs');
    elements.currentLangLabel = document.getElementById('current-lang-label');
    elements.categorySelect = document.getElementById('category-select');
    elements.isPublished = document.getElementById('is-published');
    elements.heroImages = document.getElementById('hero-images');
    elements.heroUploadZone = document.getElementById('hero-upload-zone');
    elements.heroFileInput = document.getElementById('hero-file-input');
    elements.heroUrlInput = document.getElementById('hero-url-input');
    elements.heroUrlAdd = document.getElementById('hero-url-add');
    elements.titleInput = document.getElementById('title-input');
    elements.descriptionInput = document.getElementById('description-input');
    elements.checklistInput = document.getElementById('checklist-input');
    elements.sectionsList = document.getElementById('sections-list');
    elements.addSectionBtn = document.getElementById('add-section-btn');
    elements.saveBtn = document.getElementById('save-btn');
    elements.deleteBtn = document.getElementById('delete-btn');
    elements.previewBtn = document.getElementById('preview-btn');
    elements.previewModal = document.getElementById('preview-modal');
    elements.previewClose = document.getElementById('preview-close');
    elements.previewIframe = document.getElementById('preview-iframe');
    elements.sectionTemplate = document.getElementById('section-template');
    elements.nestedSectionTemplate = document.getElementById('nested-section-template');
    elements.translateBtn = document.getElementById('translate-btn');
  }

  function bindEvents() {
    elements.authForm?.addEventListener('submit', handleLogin);
    elements.logoutBtn?.addEventListener('click', handleLogout);
    elements.langTabs?.addEventListener('click', handleLangTabClick);
    elements.addCardBtn?.addEventListener('click', createNewCard);

    elements.heroUploadZone?.addEventListener('click', (e) => {
      if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'BUTTON') {
        elements.heroFileInput?.click();
      }
    });
    elements.heroUploadZone?.addEventListener('dragover', handleDragOver);
    elements.heroUploadZone?.addEventListener('dragleave', handleDragLeave);
    elements.heroUploadZone?.addEventListener('drop', handleHeroDrop);
    elements.heroFileInput?.addEventListener('change', handleHeroFileSelect);
    elements.heroUrlAdd?.addEventListener('click', handleHeroUrlAdd);

    elements.titleInput?.addEventListener('input', () => {
      formData.title[currentLang] = elements.titleInput.value;
      unsavedChanges = true;
    });
    
    elements.descriptionInput?.addEventListener('input', () => {
      formData.description[currentLang] = elements.descriptionInput.value;
      unsavedChanges = true;
    });
    
    elements.checklistInput?.addEventListener('input', () => {
      formData.checklist[currentLang] = elements.checklistInput.value;
      unsavedChanges = true;
    });

    elements.addSectionBtn?.addEventListener('click', () => addSection());

    elements.saveBtn?.addEventListener('click', saveCard);
    elements.deleteBtn?.addEventListener('click', deleteCard);
    elements.previewBtn?.addEventListener('click', showPreview);
    elements.previewClose?.addEventListener('click', hidePreview);
    elements.translateBtn?.addEventListener('click', handleTranslateClick);

    document.getElementById('migrate-btn')?.addEventListener('click', migrateFromSupabase);
    document.getElementById('export-btn')?.addEventListener('click', exportData);
    document.getElementById('import-btn')?.addEventListener('click', importData);
    document.getElementById('csv-btn')?.addEventListener('click', importCsv);

    window.addEventListener('beforeunload', (e) => {
      if (unsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    });
  }

  function checkAuth() {
    isLoggedIn = sessionStorage.getItem('admin_auth') === 'true';
    if (isLoggedIn) {
      showAdminPanel();
    }
  }

  function handleLogin(e) {
    e.preventDefault();
    const password = elements.authPassword?.value;

    if (password === ADMIN_PASSWORD) {
      sessionStorage.setItem('admin_auth', 'true');
      isLoggedIn = true;
      showAdminPanel();
    } else {
      if (elements.authError) {
        elements.authError.textContent = 'Неверный пароль';
      }
    }
  }

  function handleLogout() {
    sessionStorage.removeItem('admin_auth');
    isLoggedIn = false;
    location.reload();
  }

  async function showAdminPanel() {
    if (elements.authScreen) elements.authScreen.style.display = 'none';
    if (elements.adminPanel) elements.adminPanel.style.display = 'flex';
    if (elements.logoutBtn) elements.logoutBtn.style.display = 'block';

    await loadData();
  }

  async function loadData() {
    try {
      categories = lsGet('techcards_categories')
        .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

      const allCards = lsGet('techcards_cards');
      cards = allCards.map(card => ({
        ...card,
        category: categories.find(c => c.id === card.category_id) || null
      })).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

      renderCardsList();
      renderCategorySelect();
    } catch (error) {
      console.error('Load error:', error);
      alert('Ошибка загрузки данных');
    }
  }

  function lsGet(key) {
    try { return JSON.parse(localStorage.getItem(key) || '[]'); }
    catch { return []; }
  }

  function lsSet(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
  }

  async function migrateFromSupabase() {
    if (!confirm('Загрузить все данные из Supabase в localStorage?\nТекущие данные в localStorage будут перезаписаны.')) return;
    const btn = document.getElementById('migrate-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Загрузка...'; }
    try {
      const headers = {
        'apikey': CONFIG.SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${CONFIG.SUPABASE_ANON_KEY}`
      };
      const [catsResp, cardsResp] = await Promise.all([
        fetch(`${CONFIG.SUPABASE_URL}/rest/v1/categories?order=sort_order.asc`, { headers }),
        fetch(`${CONFIG.SUPABASE_URL}/rest/v1/cards?select=*&order=created_at.desc`, { headers })
      ]);
      if (!catsResp.ok || !cardsResp.ok) throw new Error('Ошибка запроса к Supabase');
      const [cats, fetchedCards] = await Promise.all([catsResp.json(), cardsResp.json()]);
      lsSet('techcards_categories', cats);
      lsSet('techcards_cards', fetchedCards);
      alert(`Готово! Загружено: ${cats.length} категорий, ${fetchedCards.length} карточек.`);
      await loadData();
    } catch (e) {
      alert('Ошибка миграции: ' + e.message);
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = '↓ Импорт из Supabase'; }
    }
  }

  function exportData() {
    const data = {
      categories: lsGet('techcards_categories'),
      cards: lsGet('techcards_cards'),
      exported_at: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `techcards-backup-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function importData() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = JSON.parse(ev.target.result);
          if (!data.cards || !data.categories) throw new Error('Неверный формат файла');
          if (!confirm(`Импортировать ${data.categories.length} категорий и ${data.cards.length} карточек? Текущие данные будут заменены.`)) return;
          lsSet('techcards_categories', data.categories);
          lsSet('techcards_cards', data.cards);
          alert('Импорт завершён!');
          loadData();
        } catch (err) {
          alert('Ошибка импорта: ' + err.message);
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }

  // Parse a CSV string into array of objects, handles quoted fields with commas/newlines
  function parseCsv(text) {
    const lines = [];
    let cur = '', inQuote = false, fields = [], rows = [];

    for (let i = 0; i < text.length; i++) {
      const ch = text[i], next = text[i + 1];
      if (ch === '"') {
        if (inQuote && next === '"') { cur += '"'; i++; }
        else inQuote = !inQuote;
      } else if (ch === ',' && !inQuote) {
        fields.push(cur); cur = '';
      } else if ((ch === '\n' || (ch === '\r' && next === '\n')) && !inQuote) {
        if (ch === '\r') i++;
        fields.push(cur); cur = '';
        rows.push(fields); fields = [];
      } else {
        cur += ch;
      }
    }
    if (cur || fields.length) { fields.push(cur); rows.push(fields); }

    if (rows.length < 2) return [];
    const headers = rows[0];
    return rows.slice(1)
      .filter(r => r.some(f => f.trim()))
      .map(r => {
        const obj = {};
        headers.forEach((h, i) => {
          const val = r[i] ?? '';
          // Try to parse JSON fields (objects/arrays)
          if (val.startsWith('{') || val.startsWith('[')) {
            try { obj[h] = JSON.parse(val); return; } catch {}
          }
          // Booleans
          if (val === 'true') { obj[h] = true; return; }
          if (val === 'false') { obj[h] = false; return; }
          // Numbers (but not IDs that look like UUIDs)
          if (val !== '' && !isNaN(val) && !val.includes('-')) { obj[h] = Number(val); return; }
          obj[h] = val;
        });
        return obj;
      });
  }

  function importCsv() {
    const modal = document.createElement('div');
    modal.className = 'image-modal';
    modal.innerHTML = `
      <div class="image-modal-content" style="max-width:560px;">
        <h3>Импорт из CSV (Supabase)</h3>
        <p style="font-size:13px;color:#6b7280;margin-bottom:16px;">
          Выберите файлы экспорта из Supabase:<br>
          <b>cards.csv</b> и <b>categories.csv</b>
        </p>
        <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:16px;">
          <label style="font-size:13px;font-weight:600;color:#374151;">
            cards.csv
            <input type="file" id="csv-cards-input" accept=".csv" style="display:block;margin-top:4px;font-weight:normal;">
          </label>
          <label style="font-size:13px;font-weight:600;color:#374151;">
            categories.csv
            <input type="file" id="csv-cats-input" accept=".csv" style="display:block;margin-top:4px;font-weight:normal;">
          </label>
        </div>
        <div id="csv-status" style="font-size:13px;color:#6b7280;min-height:20px;"></div>
        <div class="image-modal-actions">
          <button class="btn-secondary" id="csv-cancel">Отмена</button>
          <button class="btn-primary" id="csv-import">Импортировать</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    modal.querySelector('#csv-cancel').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });

    modal.querySelector('#csv-import').addEventListener('click', async () => {
      const cardsFile = modal.querySelector('#csv-cards-input').files[0];
      const catsFile = modal.querySelector('#csv-cats-input').files[0];
      const status = modal.querySelector('#csv-status');

      if (!cardsFile && !catsFile) {
        status.textContent = 'Выберите хотя бы один файл.';
        status.style.color = '#dc2626';
        return;
      }

      const readFile = f => new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = e => res(e.target.result);
        r.onerror = rej;
        r.readAsText(f, 'utf-8');
      });

      try {
        status.style.color = '#6b7280';
        status.textContent = 'Обработка...';

        if (catsFile) {
          const text = await readFile(catsFile);
          const cats = parseCsv(text);
          lsSet('techcards_categories', cats);
          status.textContent = `Категории: загружено ${cats.length}`;
        }

        if (cardsFile) {
          const text = await readFile(cardsFile);
          const parsed = parseCsv(text);
          lsSet('techcards_cards', parsed);
          status.textContent += (catsFile ? ' | ' : '') + `Карточки: загружено ${parsed.length}`;
        }

        status.style.color = '#059669';
        status.textContent += ' ✓ Готово!';
        await loadData();
        setTimeout(() => modal.remove(), 1200);

      } catch (err) {
        status.style.color = '#dc2626';
        status.textContent = 'Ошибка: ' + err.message;
      }
    });
  }

  function renderCardsList() {
    if (!elements.cardsList) return;

    if (cards.length === 0) {
      elements.cardsList.innerHTML = '<p style="padding: 20px; text-align: center; color: #9ca3af;">Карточек пока нет</p>';
      return;
    }

    elements.cardsList.innerHTML = cards.map(card => {
      const title = card.title?.ru || card.title?.en || 'Без названия';
      const thumb = card.images?.[0] || card.cover_image || '';
      const isActive = card.id === currentCardId;
      const isDraft = !card.is_published;

      return `
        <div class="card-list-item ${isActive ? 'active' : ''}" data-id="${card.id}">
          <div class="card-list-thumb" style="background-image: url('${thumb}');"></div>
          <div class="card-list-info">
            <div class="card-list-title">${escapeHtml(title)}</div>
            <div class="card-list-meta">${card.category?.name?.ru || 'Без категории'}</div>
          </div>
          <div class="card-list-status ${isDraft ? 'draft' : ''}"></div>
        </div>
      `;
    }).join('');

    elements.cardsList.querySelectorAll('.card-list-item').forEach(item => {
      item.addEventListener('click', () => {
        const id = item.dataset.id;
        loadCardForEdit(id);
      });
    });
  }

  function renderCategorySelect() {
    if (!elements.categorySelect) return;

    elements.categorySelect.innerHTML = '<option value="">— Без категории —</option>' +
      categories.map(cat => `
        <option value="${cat.id}">${cat.name?.ru || cat.slug}</option>
      `).join('');
  }

  function handleLangTabClick(e) {
    const tab = e.target.closest('.editor-tab');
    if (!tab) return;

    saveSectionsToFormData();

    const newLang = tab.dataset.lang;
    switchLanguage(newLang);
  }

  function switchLanguage(lang) {
    currentLang = lang;

    elements.langTabs?.querySelectorAll('.editor-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.lang === currentLang);
    });

    if (elements.currentLangLabel) {
      elements.currentLangLabel.textContent = LANG_NAMES[currentLang] || currentLang.toUpperCase();
    }

    loadLanguageData();
  }

  function loadLanguageData() {
    if (elements.titleInput) {
      elements.titleInput.value = formData.title[currentLang] || '';
      elements.titleInput.placeholder = `Заголовок (${LANG_NAMES[currentLang]})`;
    }

    if (elements.descriptionInput) {
      elements.descriptionInput.value = formData.description[currentLang] || '';
      elements.descriptionInput.placeholder = `Описание (${LANG_NAMES[currentLang]})`;
    }

    if (elements.checklistInput) {
      elements.checklistInput.value = formData.checklist[currentLang] || '';
      elements.checklistInput.placeholder = `Чек-лист (${LANG_NAMES[currentLang]})\nКаждый пункт с новой строки:\n- Пункт 1\n- Пункт 2`;
    }

    renderSections();
  }

  function renderSections() {
    if (!elements.sectionsList) return;

    elements.sectionsList.innerHTML = '';

    const sections = formData.sections[currentLang] || [];

    if (sections.length === 0) {
      addSection();
    } else {
      sections.forEach((section, index) => {
        addSectionElement(section.title, section.content, section.images, section.nestedSections || [], index);
      });
    }
  }

  function escapeHtmlAttr(text) {
    if (!text) return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function addSection(title = '', content = '', images = [], nestedSections = []) {
    if (!formData.sections[currentLang]) {
      formData.sections[currentLang] = [];
    }

    const index = formData.sections[currentLang].length;
    formData.sections[currentLang].push({ title, content, images, nestedSections });

    addSectionElement(title, content, images, nestedSections, index);
    unsavedChanges = true;
  }

  function addSectionElement(title, content, images, nestedSections, index) {
    if (!elements.sectionsList || !elements.sectionTemplate) return;

    const template = elements.sectionTemplate.content.cloneNode(true);
    const section = template.querySelector('.content-section');
    section.dataset.index = index;

    const titleInput = section.querySelector('.section-title-input');
    const editor = section.querySelector('.rich-editor');

    if (titleInput) {
      titleInput.value = title;
      titleInput.placeholder = `Заголовок секции (${LANG_NAMES[currentLang]})`;
      titleInput.addEventListener('input', () => {
        updateSectionData(index, 'title', titleInput.value);
      });
    }

    if (editor) {
      editor.innerHTML = content;
      editor.dataset.placeholder = `Введите текст (${LANG_NAMES[currentLang]})...`;
      editor.addEventListener('input', () => {
        updateSectionData(index, 'content', editor.innerHTML);
      });
    }

    bindEditorToolbar(section, index);

    const removeBtn = section.querySelector('.section-remove');
    removeBtn?.addEventListener('click', () => {
      removeSection(index);
    });

    renderSectionImages(section, images, index);

    // Nested sections
    const addNestedBtn = section.querySelector('.btn-add-nested');
    if (addNestedBtn) {
      addNestedBtn.addEventListener('click', () => {
        addNestedSection(index);
      });
    }

    elements.sectionsList.appendChild(section);

    // Render existing nested sections after adding to DOM
    if (nestedSections && nestedSections.length > 0) {
      renderNestedSections(section, index, nestedSections);
    }
  }

  // === NESTED SECTIONS ===

  function addNestedSection(parentIndex, title = '', content = '') {
    if (!formData.sections[currentLang]) {
      formData.sections[currentLang] = [];
    }
    if (!formData.sections[currentLang][parentIndex]) {
      formData.sections[currentLang][parentIndex] = { title: '', content: '', images: [], nestedSections: [] };
    }
    if (!formData.sections[currentLang][parentIndex].nestedSections) {
      formData.sections[currentLang][parentIndex].nestedSections = [];
    }

    const nestedIndex = formData.sections[currentLang][parentIndex].nestedSections.length;
    formData.sections[currentLang][parentIndex].nestedSections.push({ title, content, images: [] });

    const parentSection = elements.sectionsList?.querySelector(`[data-index="${parentIndex}"]`);
    if (parentSection) {
      const container = parentSection.querySelector('.nested-sections-list');
      if (container) {
        addNestedSectionElement(container, parentIndex, nestedIndex, { title, content, images: [] });
      }
    }
    unsavedChanges = true;
  }

  function renderNestedSections(parentSection, parentIndex, nestedSections) {
    const container = parentSection.querySelector('.nested-sections-list');
    if (!container) return;

    container.innerHTML = '';

    if (!nestedSections || nestedSections.length === 0) {
      return;
    }

    nestedSections.forEach((nested, nestedIndex) => {
      addNestedSectionElement(container, parentIndex, nestedIndex, nested);
    });
  }

  function addNestedSectionElement(container, parentIndex, nestedIndex, data = {}) {
    const nestedEl = document.createElement('div');
    nestedEl.className = 'nested-section-item';
    nestedEl.dataset.nestedIndex = nestedIndex;
    nestedEl.dataset.parentIndex = parentIndex;

    nestedEl.innerHTML = `
      <div class="nested-section-header">
        <div class="nested-drag-handle">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="9" cy="5" r="1"></circle>
            <circle cx="9" cy="12" r="1"></circle>
            <circle cx="9" cy="19" r="1"></circle>
            <circle cx="15" cy="5" r="1"></circle>
            <circle cx="15" cy="12" r="1"></circle>
            <circle cx="15" cy="19" r="1"></circle>
          </svg>
        </div>
        <input type="text" class="nested-section-title" placeholder="Заголовок подраздела (${LANG_NAMES[currentLang]})" value="${escapeHtmlAttr(data.title || '')}">
        <button type="button" class="nested-section-remove" title="Удалить">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      
      <div class="nested-editor-toolbar">
        <div class="toolbar-group">
          <button type="button" data-command="bold" title="Жирный">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
              <path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"></path>
              <path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"></path>
            </svg>
          </button>
          <button type="button" data-command="italic" title="Курсив">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="19" y1="4" x2="10" y2="4"></line>
              <line x1="14" y1="20" x2="5" y2="20"></line>
              <line x1="15" y1="4" x2="9" y2="20"></line>
            </svg>
          </button>
          <button type="button" data-command="underline" title="Подчёркнутый">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M6 3v7a6 6 0 0 0 6 6 6 6 0 0 0 6-6V3"></path>
              <line x1="4" y1="21" x2="20" y2="21"></line>
            </svg>
          </button>
          <button type="button" data-command="strikeThrough" title="Зачёркнутый">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M4 12h16"></path>
              <path d="M17.3 4.9c-1.5-1.4-3.5-1.9-5.4-1.9-3.2 0-5.9 1.9-5.9 5.3 0 1.6.6 2.8 1.6 3.7"></path>
              <path d="M6.7 19.1c1.5 1.4 3.5 1.9 5.4 1.9 3.2 0 5.9-1.9 5.9-5.3 0-1.6-.6-2.8-1.6-3.7"></path>
            </svg>
          </button>
        </div>
        
        <span class="toolbar-divider"></span>
        
        <div class="toolbar-group">
          <select class="toolbar-select toolbar-format-nested" title="Формат">
            <option value="">Текст</option>
            <option value="h3">Заголовок 3</option>
            <option value="h4">Заголовок 4</option>
            <option value="blockquote">Цитата</option>
            <option value="pre">Код</option>
          </select>
        </div>
        
        <span class="toolbar-divider"></span>
        
        <div class="toolbar-group">
          <select class="toolbar-select toolbar-fontsize-nested" title="Размер">
            <option value="">Размер</option>
            <option value="1">Мелкий</option>
            <option value="2">Маленький</option>
            <option value="3">Обычный</option>
            <option value="4">Средний</option>
            <option value="5">Большой</option>
            <option value="6">Крупный</option>
            <option value="7">Огромный</option>
          </select>
        </div>
        
        <span class="toolbar-divider"></span>
        
        <div class="toolbar-group">
          <button type="button" data-command="insertUnorderedList" title="Маркированный список">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="8" y1="6" x2="21" y2="6"></line>
              <line x1="8" y1="12" x2="21" y2="12"></line>
              <line x1="8" y1="18" x2="21" y2="18"></line>
              <circle cx="4" cy="6" r="1" fill="currentColor"></circle>
              <circle cx="4" cy="12" r="1" fill="currentColor"></circle>
              <circle cx="4" cy="18" r="1" fill="currentColor"></circle>
            </svg>
          </button>
          <button type="button" data-command="insertOrderedList" title="Нумерованный список">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="10" y1="6" x2="21" y2="6"></line>
              <line x1="10" y1="12" x2="21" y2="12"></line>
              <line x1="10" y1="18" x2="21" y2="18"></line>
              <text x="2" y="8" font-size="7" fill="currentColor" stroke="none">1</text>
              <text x="2" y="14" font-size="7" fill="currentColor" stroke="none">2</text>
              <text x="2" y="20" font-size="7" fill="currentColor" stroke="none">3</text>
            </svg>
          </button>
        </div>
        
        <span class="toolbar-divider"></span>
        
        <div class="toolbar-group">
          <button type="button" class="nested-link-btn" title="Ссылка">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
            </svg>
          </button>
          <button type="button" class="nested-image-btn" title="Изображение">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <circle cx="8.5" cy="8.5" r="1.5"></circle>
              <polyline points="21 15 16 10 5 21"></polyline>
            </svg>
          </button>
          <button type="button" class="nested-video-btn" title="YouTube">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="5 3 19 12 5 21 5 3"></polygon>
            </svg>
          </button>
          <button type="button" class="nested-table-btn" title="Таблица">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="3" y1="9" x2="21" y2="9"></line>
              <line x1="3" y1="15" x2="21" y2="15"></line>
              <line x1="9" y1="3" x2="9" y2="21"></line>
              <line x1="15" y1="3" x2="15" y2="21"></line>
            </svg>
          </button>
        </div>
        
        <span class="toolbar-divider"></span>
        
        <div class="toolbar-group">
          <button type="button" data-command="removeFormat" title="Очистить форматирование">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M4 7V4h16v3"></path>
              <path d="M9 20h6"></path>
              <path d="M12 4v16"></path>
              <line x1="2" y1="2" x2="22" y2="22" stroke="currentColor" stroke-width="2"></line>
            </svg>
          </button>
        </div>
      </div>
      
      <div class="nested-rich-editor" contenteditable="true" data-placeholder="Содержимое подраздела (${LANG_NAMES[currentLang]})...">${data.content || ''}</div>
      <div class="nested-section-images"></div>
    `;

    // Title input
    const titleInput = nestedEl.querySelector('.nested-section-title');
    titleInput.addEventListener('input', () => {
      updateNestedSectionData(parentIndex, nestedIndex, 'title', titleInput.value);
    });

    // Content editor
    const editor = nestedEl.querySelector('.nested-rich-editor');
    editor.addEventListener('input', () => {
      updateNestedSectionData(parentIndex, nestedIndex, 'content', editor.innerHTML);
    });

    // Remove button
    const removeBtn = nestedEl.querySelector('.nested-section-remove');
    removeBtn.addEventListener('click', () => {
      removeNestedSection(parentIndex, nestedIndex);
    });

    // Bind toolbar
    bindNestedEditorToolbar(nestedEl, parentIndex, nestedIndex);

    // Render images
    renderNestedSectionImages(nestedEl, data.images || [], parentIndex, nestedIndex);

    container.appendChild(nestedEl);
  }

  function bindNestedEditorToolbar(nestedEl, parentIndex, nestedIndex) {
    const toolbar = nestedEl.querySelector('.nested-editor-toolbar');
    const editor = nestedEl.querySelector('.nested-rich-editor');

    if (!toolbar || !editor) return;

    // Command buttons
    toolbar.querySelectorAll('button[data-command]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const command = btn.dataset.command;
        editor.focus();
        document.execCommand(command, false, null);
        updateNestedSectionData(parentIndex, nestedIndex, 'content', editor.innerHTML);
        updateNestedToolbarState(toolbar);
      });
    });

    // Format select
    const formatSelect = toolbar.querySelector('.toolbar-format-nested');
    if (formatSelect) {
      formatSelect.addEventListener('change', (e) => {
        const value = e.target.value;
        editor.focus();
        if (value) {
          document.execCommand('formatBlock', false, value);
        } else {
          document.execCommand('formatBlock', false, 'p');
        }
        updateNestedSectionData(parentIndex, nestedIndex, 'content', editor.innerHTML);
        e.target.value = '';
      });
    }

    // Font size select
    const fontSizeSelect = toolbar.querySelector('.toolbar-fontsize-nested');
    if (fontSizeSelect) {
      fontSizeSelect.addEventListener('change', (e) => {
        const value = e.target.value;
        if (value) {
          editor.focus();
          document.execCommand('fontSize', false, value);
          updateNestedSectionData(parentIndex, nestedIndex, 'content', editor.innerHTML);
        }
        e.target.value = '';
      });
    }

    // Link button
    const linkBtn = toolbar.querySelector('.nested-link-btn');
    if (linkBtn) {
      linkBtn.addEventListener('click', () => {
        const url = prompt('Введите URL ссылки:', 'https://');
        if (url) {
          editor.focus();
          const selection = window.getSelection();
          const selectedText = selection.toString();
          if (selectedText) {
            document.execCommand('createLink', false, url);
          } else {
            const linkText = prompt('Текст ссылки:', url);
            document.execCommand('insertHTML', false, `<a href="${url}" target="_blank">${linkText || url}</a>`);
          }
          updateNestedSectionData(parentIndex, nestedIndex, 'content', editor.innerHTML);
        }
      });
    }

    // Image button
    const imageBtn = toolbar.querySelector('.nested-image-btn');
    if (imageBtn) {
      imageBtn.addEventListener('click', () => {
        showNestedImageModal(nestedEl, parentIndex, nestedIndex);
      });
    }

    // Video button
    const videoBtn = toolbar.querySelector('.nested-video-btn');
    if (videoBtn) {
      videoBtn.addEventListener('click', () => {
        const url = prompt('Вставьте ссылку на YouTube:', 'https://www.youtube.com/watch?v=');
        if (url) {
          const videoId = extractYouTubeId(url);
          if (videoId) {
            const iframe = `<div class="video-wrapper"><iframe width="560" height="315" src="https://www.youtube.com/embed/${videoId}" frameborder="0" allowfullscreen></iframe></div>`;
            editor.focus();
            document.execCommand('insertHTML', false, iframe);
            updateNestedSectionData(parentIndex, nestedIndex, 'content', editor.innerHTML);
          } else {
            alert('Неверная ссылка на YouTube');
          }
        }
      });
    }

    // Table button
    const tableBtn = toolbar.querySelector('.nested-table-btn');
    if (tableBtn) {
      tableBtn.addEventListener('click', () => {
        const rows = prompt('Количество строк:', '3');
        const cols = prompt('Количество столбцов:', '3');
        if (rows && cols) {
          const r = parseInt(rows) || 3;
          const c = parseInt(cols) || 3;
          let table = '<table><thead><tr>';
          for (let i = 0; i < c; i++) table += '<th>Заголовок</th>';
          table += '</tr></thead><tbody>';
          for (let i = 0; i < r - 1; i++) {
            table += '<tr>';
            for (let j = 0; j < c; j++) table += '<td>Ячейка</td>';
            table += '</tr>';
          }
          table += '</tbody></table>';
          editor.focus();
          document.execCommand('insertHTML', false, table);
          updateNestedSectionData(parentIndex, nestedIndex, 'content', editor.innerHTML);
        }
      });
    }

    // Carousel button
    const carouselBtn = toolbar.querySelector('.nested-carousel-btn');
    if (carouselBtn) {
      carouselBtn.addEventListener('click', () => {
        showNestedCarouselModal(editor, parentIndex, nestedIndex);
      });
    }

    // Background color
    const bgColorInput = toolbar.querySelector('.toolbar-bgcolor-input');
    if (bgColorInput) {
      bgColorInput.addEventListener('input', (e) => {
        editor.focus();
        document.execCommand('hiliteColor', false, e.target.value);
        updateNestedSectionData(parentIndex, nestedIndex, 'content', editor.innerHTML);
        const bar = toolbar.querySelector('.toolbar-color-bar');
        if (bar) bar.style.background = e.target.value;
      });
    }

    // Hotkeys
    editor.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case 'b':
            e.preventDefault();
            document.execCommand('bold', false, null);
            break;
          case 'i':
            e.preventDefault();
            document.execCommand('italic', false, null);
            break;
          case 'u':
            e.preventDefault();
            document.execCommand('underline', false, null);
            break;
        }
        updateNestedSectionData(parentIndex, nestedIndex, 'content', editor.innerHTML);
        updateNestedToolbarState(toolbar);
      }
    });

    editor.addEventListener('keyup', () => updateNestedToolbarState(toolbar));
    editor.addEventListener('mouseup', () => updateNestedToolbarState(toolbar));
  }

  function updateNestedToolbarState(toolbar) {
    toolbar.querySelectorAll('button[data-command]').forEach(btn => {
      const command = btn.dataset.command;
      try {
        const isActive = document.queryCommandState(command);
        btn.classList.toggle('active', isActive);
      } catch (e) {}
    });
  }

  function showNestedImageModal(nestedEl, parentIndex, nestedIndex) {
    const modal = document.createElement('div');
    modal.className = 'image-modal';
    modal.innerHTML = `
      <div class="image-modal-content">
        <h3>Добавить изображение</h3>
        <input type="url" id="nested-image-url" placeholder="https://example.com/image.jpg">
        <label style="display: flex; align-items: center; gap: 8px; margin-top: 12px; cursor: pointer;">
          <input type="checkbox" id="nested-insert-in-editor" checked>
          <span>Вставить в текст</span>
        </label>
        <div class="image-modal-actions">
          <button class="btn-secondary" id="nested-image-cancel">Отмена</button>
          <button class="btn-primary" id="nested-image-add">Добавить</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const urlInput = modal.querySelector('#nested-image-url');
    const insertCheckbox = modal.querySelector('#nested-insert-in-editor');
    const cancelBtn = modal.querySelector('#nested-image-cancel');
    const addBtn = modal.querySelector('#nested-image-add');

    cancelBtn.addEventListener('click', () => modal.remove());

    addBtn.addEventListener('click', () => {
      const url = urlInput.value.trim();
      if (url && url.startsWith('http')) {
        if (!formData.sections[currentLang]?.[parentIndex]?.nestedSections?.[nestedIndex]) {
          modal.remove();
          return;
        }
        
        if (!formData.sections[currentLang][parentIndex].nestedSections[nestedIndex].images) {
          formData.sections[currentLang][parentIndex].nestedSections[nestedIndex].images = [];
        }
        formData.sections[currentLang][parentIndex].nestedSections[nestedIndex].images.push(url);

        renderNestedSectionImages(
          nestedEl,
          formData.sections[currentLang][parentIndex].nestedSections[nestedIndex].images,
          parentIndex,
          nestedIndex
        );

        if (insertCheckbox.checked) {
          const editor = nestedEl.querySelector('.nested-rich-editor');
          if (editor) {
            editor.focus();
            document.execCommand('insertImage', false, url);
            updateNestedSectionData(parentIndex, nestedIndex, 'content', editor.innerHTML);
          }
        }

        unsavedChanges = true;
      }
      modal.remove();
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });

    urlInput.focus();
  }

  function renderNestedSectionImages(nestedEl, images, parentIndex, nestedIndex) {
    const container = nestedEl.querySelector('.nested-section-images');
    if (!container) return;

    if (!images || images.length === 0) {
      container.innerHTML = '';
      return;
    }

    container.innerHTML = images.map((url, idx) => `
      <div class="image-item" style="background-image: url('${url}');" data-index="${idx}">
        <button type="button" class="image-item-remove" data-index="${idx}">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
    `).join('');

    container.querySelectorAll('.image-item-remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.dataset.index);
        
        if (formData.sections[currentLang]?.[parentIndex]?.nestedSections?.[nestedIndex]?.images) {
          formData.sections[currentLang][parentIndex].nestedSections[nestedIndex].images.splice(idx, 1);
          renderNestedSectionImages(
            nestedEl,
            formData.sections[currentLang][parentIndex].nestedSections[nestedIndex].images,
            parentIndex,
            nestedIndex
          );
          unsavedChanges = true;
        }
      });
    });
  }

  function updateNestedSectionData(parentIndex, nestedIndex, field, value) {
    if (!formData.sections[currentLang]?.[parentIndex]?.nestedSections?.[nestedIndex]) return;
    formData.sections[currentLang][parentIndex].nestedSections[nestedIndex][field] = value;
    unsavedChanges = true;
  }

  function removeNestedSection(parentIndex, nestedIndex) {
    if (!formData.sections[currentLang]?.[parentIndex]?.nestedSections) return;
    formData.sections[currentLang][parentIndex].nestedSections.splice(nestedIndex, 1);

    const parentSection = elements.sectionsList?.querySelector(`[data-index="${parentIndex}"]`);
    if (parentSection) {
      renderNestedSections(parentSection, parentIndex, formData.sections[currentLang][parentIndex].nestedSections);
    }
    unsavedChanges = true;
  }

  // === MAIN SECTION FUNCTIONS ===

  function updateSectionData(index, field, value) {
    if (!formData.sections[currentLang]) {
      formData.sections[currentLang] = [];
    }
    if (!formData.sections[currentLang][index]) {
      formData.sections[currentLang][index] = { title: '', content: '', images: [], nestedSections: [] };
    }
    formData.sections[currentLang][index][field] = value;
    unsavedChanges = true;
  }

  function removeSection(index) {
    if (!formData.sections[currentLang]) return;

    formData.sections[currentLang].splice(index, 1);
    renderSections();
    unsavedChanges = true;
  }

  function saveSectionsToFormData() {
    if (!elements.sectionsList) return;

    const sectionElements = elements.sectionsList.querySelectorAll('.content-section');
    const sections = [];

    sectionElements.forEach((section, sectionIdx) => {
      const titleInput = section.querySelector('.section-title-input');
      const editor = section.querySelector('.rich-editor');
      const imagesContainer = section.querySelector('.section-images');

      const title = titleInput?.value || '';
      const content = editor?.innerHTML || '';
      const images = [];

      if (imagesContainer) {
        imagesContainer.querySelectorAll('.image-item').forEach(item => {
          const style = item.style.backgroundImage;
          const url = style.replace(/^url\(['"]?/, '').replace(/['"]?\)$/, '');
          if (url) images.push(url);
        });
      }

      // Save nested sections
      const nestedSections = [];
      const nestedContainer = section.querySelector('.nested-sections-list');
      if (nestedContainer) {
        nestedContainer.querySelectorAll('.nested-section-item').forEach(nestedEl => {
          const nestedTitle = nestedEl.querySelector('.nested-section-title')?.value || '';
          const nestedContent = nestedEl.querySelector('.nested-rich-editor')?.innerHTML || '';
          
          const nestedImages = [];
          const nestedImagesContainer = nestedEl.querySelector('.nested-section-images');
          if (nestedImagesContainer) {
            nestedImagesContainer.querySelectorAll('.image-item').forEach(item => {
              const style = item.style.backgroundImage;
              const url = style.replace(/^url\(['"]?/, '').replace(/['"]?\)$/, '');
              if (url) nestedImages.push(url);
            });
          }
          
          nestedSections.push({ title: nestedTitle, content: nestedContent, images: nestedImages });
        });
      }

      sections.push({ title, content, images, nestedSections });
    });

    formData.sections[currentLang] = sections;
  }

  function bindEditorToolbar(section, index) {
    const toolbar = section.querySelector('.editor-toolbar');
    const editor = section.querySelector('.rich-editor');

    if (!toolbar || !editor) return;

    toolbar.querySelectorAll('button[data-command]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const command = btn.dataset.command;
        const value = btn.dataset.value || null;

        editor.focus();
        document.execCommand(command, false, value);
        
        updateSectionData(index, 'content', editor.innerHTML);
        updateToolbarState(toolbar);
      });
    });

    const formatSelect = toolbar.querySelector('.toolbar-select[data-command="formatBlock"]');
    if (formatSelect) {
      formatSelect.addEventListener('change', (e) => {
        const value = e.target.value;
        editor.focus();

        if (value) {
          document.execCommand('formatBlock', false, value);
        } else {
          document.execCommand('formatBlock', false, 'p');
        }

        updateSectionData(index, 'content', editor.innerHTML);
        e.target.value = '';
      });
    }

    const fontSizeSelect = toolbar.querySelector('.toolbar-fontsize');
    if (fontSizeSelect) {
      fontSizeSelect.addEventListener('change', (e) => {
        const value = e.target.value;
        if (value) {
          editor.focus();
          document.execCommand('fontSize', false, value);
          updateSectionData(index, 'content', editor.innerHTML);
        }
        e.target.value = '';
      });
    }

    const linkBtn = toolbar.querySelector('.toolbar-link-btn');
    if (linkBtn) {
      linkBtn.addEventListener('click', () => {
        const selection = window.getSelection();
        const selectedText = selection.toString();
        
        const url = prompt('Введите URL ссылки:', 'https://');
        if (url) {
          editor.focus();
          if (selectedText) {
            document.execCommand('createLink', false, url);
          } else {
            const linkText = prompt('Текст ссылки:', url);
            const link = `<a href="${url}" target="_blank">${linkText || url}</a>`;
            document.execCommand('insertHTML', false, link);
          }
          updateSectionData(index, 'content', editor.innerHTML);
        }
      });
    }

    const imageBtn = toolbar.querySelector('.toolbar-image-btn');
    if (imageBtn) {
      imageBtn.addEventListener('click', () => {
        showImageModal(index);
      });
    }

    const videoBtn = toolbar.querySelector('.toolbar-video-btn');
    if (videoBtn) {
      videoBtn.addEventListener('click', () => {
        const url = prompt('Вставьте ссылку на YouTube видео:', 'https://www.youtube.com/watch?v=');
        if (url) {
          const videoId = extractYouTubeId(url);
          if (videoId) {
            const iframe = `<div class="video-wrapper"><iframe width="560" height="315" src="https://www.youtube.com/embed/${videoId}" frameborder="0" allowfullscreen></iframe></div>`;
            editor.focus();
            document.execCommand('insertHTML', false, iframe);
            updateSectionData(index, 'content', editor.innerHTML);
          } else {
            alert('Неверная ссылка на YouTube');
          }
        }
      });
    }

    const tableBtn = toolbar.querySelector('.toolbar-table-btn');
    if (tableBtn) {
      tableBtn.addEventListener('click', () => {
        const rows = prompt('Количество строк:', '3');
        const cols = prompt('Количество столбцов:', '3');

        if (rows && cols) {
          const r = parseInt(rows) || 3;
          const c = parseInt(cols) || 3;

          let table = '<table><thead><tr>';
          for (let i = 0; i < c; i++) {
            table += '<th>Заголовок</th>';
          }
          table += '</tr></thead><tbody>';

          for (let i = 0; i < r - 1; i++) {
            table += '<tr>';
            for (let j = 0; j < c; j++) {
              table += '<td>Ячейка</td>';
            }
            table += '</tr>';
          }
          table += '</tbody></table>';

          editor.focus();
          document.execCommand('insertHTML', false, table);
          updateSectionData(index, 'content', editor.innerHTML);
        }
      });
    }

    const carouselBtn = toolbar.querySelector('.toolbar-carousel-btn');
    if (carouselBtn) {
      carouselBtn.addEventListener('click', () => {
        showCarouselModal(index, editor);
      });
    }

    const bgColorInput = toolbar.querySelector('.toolbar-bgcolor-input');
    if (bgColorInput) {
      bgColorInput.addEventListener('input', (e) => {
        editor.focus();
        document.execCommand('hiliteColor', false, e.target.value);
        updateSectionData(index, 'content', editor.innerHTML);
        const bar = toolbar.querySelector('.toolbar-color-bar');
        if (bar) bar.style.background = e.target.value;
      });
    }

    editor.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case 'b':
            e.preventDefault();
            document.execCommand('bold', false, null);
            break;
          case 'i':
            e.preventDefault();
            document.execCommand('italic', false, null);
            break;
          case 'u':
            e.preventDefault();
            document.execCommand('underline', false, null);
            break;
          case 'z':
            if (e.shiftKey) {
              e.preventDefault();
              document.execCommand('redo', false, null);
            }
            break;
        }
        updateSectionData(index, 'content', editor.innerHTML);
        updateToolbarState(toolbar);
      }
    });

    editor.addEventListener('keyup', () => updateToolbarState(toolbar));
    editor.addEventListener('mouseup', () => updateToolbarState(toolbar));

    editor.addEventListener('input', () => {
      updateSectionData(index, 'content', editor.innerHTML);
    });
  }

  function updateToolbarState(toolbar) {
    toolbar.querySelectorAll('button[data-command]').forEach(btn => {
      const command = btn.dataset.command;
      try {
        const isActive = document.queryCommandState(command);
        btn.classList.toggle('active', isActive);
      } catch (e) {}
    });
  }

  function extractYouTubeId(url) {
    const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
    const match = url.match(regex);
    return match ? match[1] : null;
  }

  function renderSectionImages(section, images, sectionIndex) {
    const container = section.querySelector('.section-images');
    if (!container) return;

    if (!images || images.length === 0) {
      container.innerHTML = '';
      return;
    }

    container.innerHTML = images.map((url, idx) => `
      <div class="image-item" style="background-image: url('${url}');" data-index="${idx}">
        <button type="button" class="image-item-remove" data-index="${idx}">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
    `).join('');

    container.querySelectorAll('.image-item-remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.dataset.index);
        
        if (formData.sections[currentLang]?.[sectionIndex]?.images) {
          formData.sections[currentLang][sectionIndex].images.splice(idx, 1);
          renderSectionImages(section, formData.sections[currentLang][sectionIndex].images, sectionIndex);
          unsavedChanges = true;
        }
      });
    });
  }

  function showImageModal(sectionIndex) {
    const modal = document.createElement('div');
    modal.className = 'image-modal';
    modal.innerHTML = `
      <div class="image-modal-content">
        <h3>Добавить изображение</h3>
        <input type="url" id="section-image-url" placeholder="https://example.com/image.jpg">
        <label style="display: flex; align-items: center; gap: 8px; margin-top: 12px; cursor: pointer;">
          <input type="checkbox" id="insert-in-editor" checked>
          <span>Вставить в текст</span>
        </label>
        <div class="image-modal-actions">
          <button class="btn-secondary" id="image-modal-cancel">Отмена</button>
          <button class="btn-primary" id="image-modal-add">Добавить</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const urlInput = modal.querySelector('#section-image-url');
    const insertCheckbox = modal.querySelector('#insert-in-editor');
    const cancelBtn = modal.querySelector('#image-modal-cancel');
    const addBtn = modal.querySelector('#image-modal-add');

    cancelBtn.addEventListener('click', () => modal.remove());

    addBtn.addEventListener('click', () => {
      const url = urlInput.value.trim();
      if (url && url.startsWith('http')) {
        if (!formData.sections[currentLang]) {
          formData.sections[currentLang] = [];
        }
        if (!formData.sections[currentLang][sectionIndex]) {
          formData.sections[currentLang][sectionIndex] = { title: '', content: '', images: [], nestedSections: [] };
        }
        if (!formData.sections[currentLang][sectionIndex].images) {
          formData.sections[currentLang][sectionIndex].images = [];
        }
        formData.sections[currentLang][sectionIndex].images.push(url);

        const sectionEl = elements.sectionsList?.querySelector(`[data-index="${sectionIndex}"]`);
        if (sectionEl) {
          renderSectionImages(sectionEl, formData.sections[currentLang][sectionIndex].images, sectionIndex);
        }

        if (insertCheckbox.checked) {
          const editor = sectionEl?.querySelector('.rich-editor');
          if (editor) {
            editor.focus();
            document.execCommand('insertImage', false, url);
            updateSectionData(sectionIndex, 'content', editor.innerHTML);
          }
        }

        unsavedChanges = true;
      }
      modal.remove();
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });

    urlInput.focus();
  }

  function showCarouselModal(sectionIndex, editor) {
    const modal = document.createElement('div');
    modal.className = 'image-modal';
    modal.innerHTML = `
      <div class="image-modal-content" style="max-width: 600px;">
        <h3>Добавить карусель изображений</h3>
        <p style="font-size: 13px; color: #6b7280; margin-bottom: 16px;">Добавьте URL изображений для карусели (каждый URL с новой строки):</p>
        <textarea id="carousel-urls" rows="6" placeholder="https://example.com/image1.jpg&#10;https://example.com/image2.jpg&#10;https://example.com/image3.jpg" style="width: 100%; resize: vertical;"></textarea>
        <div class="image-modal-actions">
          <button class="btn-secondary" id="carousel-modal-cancel">Отмена</button>
          <button class="btn-primary" id="carousel-modal-add">Вставить карусель</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const urlsInput = modal.querySelector('#carousel-urls');
    const cancelBtn = modal.querySelector('#carousel-modal-cancel');
    const addBtn = modal.querySelector('#carousel-modal-add');

    cancelBtn.addEventListener('click', () => modal.remove());

    addBtn.addEventListener('click', () => {
      const urls = urlsInput.value
        .split('\n')
        .map(url => url.trim())
        .filter(url => url && url.startsWith('http'));

      if (urls.length > 0) {
        let carouselHtml = '<div class="content-carousel-preview" data-carousel="' + urls.join(',') + '" contenteditable="false" style="background: #f3f4f6; border-radius: 12px; padding: 16px; margin: 16px 0; text-align: center;">';
        carouselHtml += '<p style="margin: 0 0 8px; font-weight: 600; color: #1f2933;">Карусель (' + urls.length + ' изобр.)</p>';
        carouselHtml += '<div style="display: flex; gap: 8px; justify-content: center; flex-wrap: wrap;">';
        urls.slice(0, 4).forEach(url => {
          carouselHtml += '<img src="' + url + '" style="width: 80px; height: 60px; object-fit: cover; border-radius: 8px;" />';
        });
        if (urls.length > 4) {
          carouselHtml += '<span style="display: flex; align-items: center; color: #6b7280;">+' + (urls.length - 4) + '</span>';
        }
        carouselHtml += '</div>';
        carouselHtml += '</div>';

        editor.focus();
        document.execCommand('insertHTML', false, carouselHtml);
        updateSectionData(sectionIndex, 'content', editor.innerHTML);
        unsavedChanges = true;
      }
      modal.remove();
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });

    urlsInput.focus();
  }

  function showNestedCarouselModal(editor, parentIndex, nestedIndex) {
    const modal = document.createElement('div');
    modal.className = 'image-modal';
    modal.innerHTML = `
      <div class="image-modal-content" style="max-width: 620px;">
        <h3>Карусель изображений</h3>

        <div style="display:flex; gap:8px; margin-bottom:12px;">
          <button class="btn-small btn-secondary nested-car-tab active" data-tab="url" style="flex:1;">По ссылке</button>
          <button class="btn-small btn-secondary nested-car-tab" data-tab="upload" style="flex:1;">Загрузить файлы</button>
        </div>

        <div id="nested-car-url-panel">
          <p style="font-size:13px;color:#6b7280;margin-bottom:8px;">Каждый URL с новой строки:</p>
          <textarea id="nested-carousel-urls" rows="5" placeholder="https://example.com/image1.jpg&#10;https://example.com/image2.jpg" style="width:100%;resize:vertical;"></textarea>
        </div>

        <div id="nested-car-upload-panel" style="display:none;">
          <div id="nested-car-drop-zone" style="border:2px dashed #d1d5db;border-radius:10px;padding:24px;text-align:center;cursor:pointer;transition:all 0.15s;">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="1.5" style="margin-bottom:8px;"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
            <p style="margin:0 0 4px;font-size:14px;color:#6b7280;">Перетащите изображения или <span style="color:#1b98fb;cursor:pointer;" id="nested-car-file-trigger">выберите файлы</span></p>
            <p style="margin:0;font-size:12px;color:#9ca3af;">JPG, PNG, GIF, WebP</p>
            <input type="file" id="nested-car-file-input" accept="image/*" multiple hidden>
          </div>
          <div id="nested-car-previews" style="display:flex;flex-wrap:wrap;gap:8px;margin-top:12px;"></div>
        </div>

        <div class="image-modal-actions">
          <button class="btn-secondary" id="nested-car-cancel">Отмена</button>
          <button class="btn-primary" id="nested-car-add">Вставить карусель</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    const urlPanel = modal.querySelector('#nested-car-url-panel');
    const uploadPanel = modal.querySelector('#nested-car-upload-panel');
    const urlsInput = modal.querySelector('#nested-carousel-urls');
    const fileInput = modal.querySelector('#nested-car-file-input');
    const dropZone = modal.querySelector('#nested-car-drop-zone');
    const previewsEl = modal.querySelector('#nested-car-previews');
    let uploadedUrls = [];

    // Tab switching
    modal.querySelectorAll('.nested-car-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        modal.querySelectorAll('.nested-car-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        if (tab.dataset.tab === 'url') {
          urlPanel.style.display = '';
          uploadPanel.style.display = 'none';
        } else {
          urlPanel.style.display = 'none';
          uploadPanel.style.display = '';
        }
      });
    });

    // File upload
    modal.querySelector('#nested-car-file-trigger').addEventListener('click', () => fileInput.click());
    dropZone.addEventListener('click', (e) => { if (e.target !== modal.querySelector('#nested-car-file-trigger')) fileInput.click(); });
    dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.style.borderColor = '#1b98fb'; dropZone.style.background = '#eff6ff'; });
    dropZone.addEventListener('dragleave', () => { dropZone.style.borderColor = '#d1d5db'; dropZone.style.background = ''; });
    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.style.borderColor = '#d1d5db';
      dropZone.style.background = '';
      handleFiles(e.dataTransfer.files);
    });
    fileInput.addEventListener('change', () => handleFiles(fileInput.files));

    function handleFiles(files) {
      Array.from(files).forEach(file => {
        if (!file.type.startsWith('image/')) return;
        const reader = new FileReader();
        reader.onload = (e) => {
          uploadedUrls.push(e.target.result);
          const img = document.createElement('img');
          img.src = e.target.result;
          img.style.cssText = 'width:80px;height:60px;object-fit:cover;border-radius:8px;';
          previewsEl.appendChild(img);
        };
        reader.readAsDataURL(file);
      });
    }

    modal.querySelector('#nested-car-cancel').addEventListener('click', () => modal.remove());

    modal.querySelector('#nested-car-add').addEventListener('click', () => {
      const activeTab = modal.querySelector('.nested-car-tab.active').dataset.tab;
      let urls = [];
      if (activeTab === 'url') {
        urls = urlsInput.value.split('\n').map(u => u.trim()).filter(u => u && u.startsWith('http'));
      } else {
        urls = [...uploadedUrls];
      }

      if (urls.length > 0) {
        let html = '<div class="content-carousel-preview" data-carousel="' + urls.join(',') + '" contenteditable="false" style="background:#f3f4f6;border-radius:12px;padding:16px;margin:16px 0;text-align:center;">';
        html += '<p style="margin:0 0 8px;font-weight:600;color:#1f2933;">Карусель (' + urls.length + ' изобр.)</p>';
        html += '<div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;">';
        urls.slice(0, 4).forEach(url => {
          html += '<img src="' + url + '" style="width:80px;height:60px;object-fit:cover;border-radius:8px;" />';
        });
        if (urls.length > 4) {
          html += '<span style="display:flex;align-items:center;color:#6b7280;">+' + (urls.length - 4) + '</span>';
        }
        html += '</div></div>';
        editor.focus();
        document.execCommand('insertHTML', false, html);
        updateNestedSectionData(parentIndex, nestedIndex, 'content', editor.innerHTML);
        unsavedChanges = true;
      }
      modal.remove();
    });

    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
    urlsInput.focus();
  }

  // === CARD OPERATIONS ===

  function createNewCard() {
    if (unsavedChanges && !confirm('Есть несохранённые изменения. Продолжить?')) {
      return;
    }

    currentCardId = null;
    unsavedChanges = false;

    formData = {
      title: {},
      description: {},
      checklist: {},
      sections: {}
    };

    if (elements.editorPlaceholder) elements.editorPlaceholder.style.display = 'none';
    if (elements.editorForm) elements.editorForm.style.display = 'flex';
    if (elements.deleteBtn) elements.deleteBtn.style.display = 'none';

    if (elements.heroImages) elements.heroImages.innerHTML = '';

    if (elements.categorySelect) elements.categorySelect.value = '';
    if (elements.isPublished) elements.isPublished.checked = true;

    switchLanguage('ru');

    renderCardsList();
  }

  function loadCardForEdit(id) {
    if (unsavedChanges && !confirm('Есть несохранённые изменения. Продолжить?')) {
      return;
    }

    const card = cards.find(c => c.id === id);
    if (!card) return;

    currentCardId = id;
    unsavedChanges = false;

    if (elements.editorPlaceholder) elements.editorPlaceholder.style.display = 'none';
    if (elements.editorForm) elements.editorForm.style.display = 'flex';
    if (elements.deleteBtn) elements.deleteBtn.style.display = 'flex';

    formData = {
      title: { ...card.title } || {},
      description: { ...card.description } || {},
      checklist: {},
      sections: {}
    };

    LANGUAGES.forEach(lang => {
      const content = card.content?.[lang];
      if (content) {
        const checklist = content.checklist || [];
        formData.checklist[lang] = checklist.map(item => '- ' + item).join('\n');

        formData.sections[lang] = (content.sections || []).map(s => ({
          title: s.title || '',
          content: s.content || '',
          images: s.images || [],
          nestedSections: (s.nestedSections || []).map(n => ({
            title: n.title || '',
            content: n.content || '',
            images: n.images || []
          }))
        }));
      }
    });

    renderHeroImages(card.images || []);

    if (elements.categorySelect) {
      elements.categorySelect.value = card.category_id || '';
    }

    if (elements.isPublished) {
      elements.isPublished.checked = card.is_published !== false;
    }

    switchLanguage('ru');

    renderCardsList();
  }

  function renderHeroImages(images) {
    if (!elements.heroImages) return;

    elements.heroImages.innerHTML = images.map((url, idx) => `
      <div class="image-item" style="background-image: url('${url}');" data-index="${idx}">
        <button type="button" class="image-item-remove" data-index="${idx}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
    `).join('');

    elements.heroImages.querySelectorAll('.image-item-remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.dataset.index);
        removeHeroImage(idx);
      });
    });
  }

  function addHeroImage(url) {
    if (!url) return;

    const images = getHeroImages();
    images.push(url);
    renderHeroImages(images);
    unsavedChanges = true;
  }

  function removeHeroImage(index) {
    const images = getHeroImages();
    images.splice(index, 1);
    renderHeroImages(images);
    unsavedChanges = true;
  }

  function getHeroImages() {
    if (!elements.heroImages) return [];
    const items = elements.heroImages.querySelectorAll('.image-item');
    return Array.from(items).map(item => {
      const style = item.style.backgroundImage;
      return style.replace(/^url\(['"]?/, '').replace(/['"]?\)$/, '');
    });
  }

  function handleDragOver(e) {
    e.preventDefault();
    e.currentTarget.classList.add('dragover');
  }

  function handleDragLeave(e) {
    e.currentTarget.classList.remove('dragover');
  }

  function handleHeroDrop(e) {
    e.preventDefault();
    e.currentTarget.classList.remove('dragover');
  }

  function handleHeroFileSelect(e) {
    alert('Для загрузки изображений используйте URL.');
  }

  function handleHeroUrlAdd() {
    const url = elements.heroUrlInput?.value?.trim();
    if (url && url.startsWith('http')) {
      addHeroImage(url);
      if (elements.heroUrlInput) elements.heroUrlInput.value = '';
    }
  }

  function collectFormData() {
    saveSectionsToFormData();
    if (elements.titleInput) {
      formData.title[currentLang] = elements.titleInput.value;
    }
    if (elements.descriptionInput) {
      formData.description[currentLang] = elements.descriptionInput.value;
    }
    if (elements.checklistInput) {
      formData.checklist[currentLang] = elements.checklistInput.value;
    }

    const title = {};
    const description = {};
    const content = {};

    LANGUAGES.forEach(lang => {
      if (formData.title[lang]?.trim()) {
        title[lang] = formData.title[lang].trim();
      }

      if (formData.description[lang]?.trim()) {
        description[lang] = formData.description[lang].trim();
      }

      const checklistText = formData.checklist[lang] || '';
      const checklist = checklistText
        .split('\n')
        .map(line => line.replace(/^[-•]\s*/, '').trim())
        .filter(line => line);

      const sections = (formData.sections[lang] || [])
        .filter(s => s.title || s.content || (s.nestedSections && s.nestedSections.length > 0))
        .map(s => ({
          title: s.title || '',
          content: s.content || '',
          images: s.images || [],
          nestedSections: (s.nestedSections || []).filter(n => n.title || n.content).map(n => ({
            title: n.title || '',
            content: n.content || '',
            images: n.images || []
          }))
        }));

      if (sections.length > 0 || checklist.length > 0) {
        content[lang] = { sections, checklist };
      }
    });

    const images = getHeroImages();

    const categoryId = elements.categorySelect?.value || null;
    const isPublished = elements.isPublished?.checked ?? true;

    return {
      title,
      description,
      content,
      images,
      cover_image: images[0] || null,
      category_id: categoryId,
      is_published: isPublished
    };
  }

  let isSaving = false;

  async function saveCard() {
    if (isSaving) return;

    const data = collectFormData();

    if (!data.title.ru && !data.title.en && !data.title.kz) {
      alert('Введите заголовок хотя бы на одном языке');
      return;
    }

    data.updated_at = new Date().toISOString();
    isSaving = true;
    if (elements.saveBtn) elements.saveBtn.disabled = true;

    if (!currentCardId) {
      data.slug = generateSlug(data.title.ru || data.title.en || data.title.kz || 'card');
      data.views_count = 0;
      data.created_at = new Date().toISOString();
    }

    try {
      const allCards = lsGet('techcards_cards');

      if (currentCardId) {
        const idx = allCards.findIndex(c => c.id === currentCardId);
        if (idx !== -1) {
          allCards[idx] = { ...allCards[idx], ...data };
        }
      } else {
        data.id = 'card_' + Date.now();
        data.slug = generateSlug(data.title.ru || data.title.en || data.title.kz || 'card');
        data.views_count = 0;
        data.created_at = new Date().toISOString();
        currentCardId = data.id;
        allCards.unshift(data);
      }

      lsSet('techcards_cards', allCards);
      unsavedChanges = false;
      await loadData();
      alert('Сохранено!');

    } catch (error) {
      console.error('Save error:', error);
      alert('Ошибка сохранения: ' + error.message);
    } finally {
      isSaving = false;
      if (elements.saveBtn) elements.saveBtn.disabled = false;
    }
  }

  async function deleteCard() {
    if (!currentCardId) return;

    if (!confirm('Удалить карточку? Это действие нельзя отменить.')) {
      return;
    }

    try {
      const allCards = lsGet('techcards_cards').filter(c => c.id !== currentCardId);
      lsSet('techcards_cards', allCards);

      currentCardId = null;
      unsavedChanges = false;

      if (elements.editorForm) elements.editorForm.style.display = 'none';
      if (elements.editorPlaceholder) elements.editorPlaceholder.style.display = 'flex';

      await loadData();
      alert('Карточка удалена');

    } catch (error) {
      console.error('Delete error:', error);
      alert('Ошибка удаления: ' + error.message);
    }
  }

  function showPreview() {
    if (!currentCardId) {
      alert('Сначала сохраните карточку');
      return;
    }

    if (elements.previewIframe) {
      elements.previewIframe.src = `card.html?id=${currentCardId}`;
    }

    if (elements.previewModal) {
      elements.previewModal.classList.add('open');
    }
  }

  function hidePreview() {
    if (elements.previewModal) {
      elements.previewModal.classList.remove('open');
    }
    if (elements.previewIframe) {
      elements.previewIframe.src = '';
    }
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // === ПЕРЕВОД ===

  // Language code mapping: admin lang code → Google Translate lang code
  const GT_LANG_MAP = {
    ru: 'ru',
    kz: 'kk',
    uz: 'uz',
    en: 'en',
    tk: 'tk'
  };

  async function translateText(text, targetLang) {
    if (!text || !text.trim()) return '';

    const gtLang = GT_LANG_MAP[targetLang] || targetLang;
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=ru&tl=${gtLang}&dt=t&q=${encodeURIComponent(text)}`;

    const response = await fetch(url);
    if (!response.ok) throw new Error(`Translation error: ${response.status}`);

    const data = await response.json();
    // Response structure: [[["translated", "original", ...], ...], ...]
    return (data[0] || []).map(part => part[0] || '').join('');
  }

  // Translate HTML content — walks text nodes only, preserves all tags/formatting
  async function translateHtml(html, targetLang) {
    if (!html || !html.trim()) return '';

    const div = document.createElement('div');
    div.innerHTML = html;

    // Collect all leaf text nodes that have real content
    const walker = document.createTreeWalker(div, NodeFilter.SHOW_TEXT, null);
    const textNodes = [];
    let node;
    while ((node = walker.nextNode())) {
      if (node.textContent.trim()) textNodes.push(node);
    }

    if (!textNodes.length) return html;

    // Translate each text node individually so HTML structure is fully preserved
    for (const textNode of textNodes) {
      textNode.textContent = await translateText(textNode.textContent, targetLang);
    }

    return div.innerHTML;
  }

  async function handleTranslateClick() {
    // First save current lang data
    saveSectionsToFormData();
    if (elements.titleInput) formData.title[currentLang] = elements.titleInput.value;
    if (elements.descriptionInput) formData.description[currentLang] = elements.descriptionInput.value;
    if (elements.checklistInput) formData.checklist[currentLang] = elements.checklistInput.value;

    const ruTitle = formData.title['ru'] || '';
    const ruDesc = formData.description['ru'] || '';
    const ruChecklist = formData.checklist['ru'] || '';
    const ruSections = formData.sections['ru'] || [];

    if (!ruTitle && !ruDesc && !ruChecklist && ruSections.length === 0) {
      alert('Сначала заполните данные на русском языке.');
      return;
    }

    const targetLangs = LANGUAGES.filter(l => l !== 'ru');

    elements.translateBtn.disabled = true;
    elements.translateBtn.classList.add('translating');
    const origHTML = elements.translateBtn.innerHTML;
    elements.translateBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"></circle>
        <path d="M12 6v6l4 2"></path>
      </svg>
      Перевожу...
    `;

    try {
      for (const lang of targetLangs) {
        // Title
        if (ruTitle) {
          formData.title[lang] = await translateText(ruTitle, lang);
        }

        // Description
        if (ruDesc) {
          formData.description[lang] = await translateText(ruDesc, lang);
        }

        // Checklist (translate each line separately)
        if (ruChecklist) {
          const lines = ruChecklist.split('\n');
          const translatedLines = [];
          for (const line of lines) {
            const prefix = line.match(/^[-•]\s*/)?.[0] || '';
            const content = line.replace(/^[-•]\s*/, '').trim();
            if (content) {
              const translated = await translateText(content, lang);
              translatedLines.push(prefix + translated);
            } else {
              translatedLines.push(line);
            }
          }
          formData.checklist[lang] = translatedLines.join('\n');
        }

        // Sections
        if (ruSections.length > 0) {
          const translatedSections = [];
          for (const section of ruSections) {
            const tSection = {
              title: section.title ? await translateText(section.title, lang) : '',
              content: section.content ? await translateHtml(section.content, lang) : '',
              images: section.images || [],
              nestedSections: []
            };

            if (section.nestedSections && section.nestedSections.length > 0) {
              for (const nested of section.nestedSections) {
                tSection.nestedSections.push({
                  title: nested.title ? await translateText(nested.title, lang) : '',
                  content: nested.content ? await translateHtml(nested.content, lang) : '',
                  images: nested.images || []
                });
              }
            }

            translatedSections.push(tSection);
          }
          formData.sections[lang] = translatedSections;
        }
      }

      // Reload current lang display (in case user is on a target lang tab)
      loadLanguageData();
      unsavedChanges = true;

      elements.translateBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
        Готово!
      `;
      setTimeout(() => {
        elements.translateBtn.innerHTML = origHTML;
        elements.translateBtn.classList.remove('translating');
        elements.translateBtn.disabled = false;
      }, 2000);

    } catch (err) {
      console.error('Translation failed:', err);
      alert('Ошибка перевода. Проверьте интернет-соединение и попробуйте ещё раз.');
      elements.translateBtn.innerHTML = origHTML;
      elements.translateBtn.classList.remove('translating');
      elements.translateBtn.disabled = false;
    }
  }

  function generateSlug(text) {
    const translitMap = {
      'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo',
      'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
      'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
      'ф': 'f', 'х': 'h', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'sch',
      'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya'
    };

    return text
      .toLowerCase()
      .split('')
      .map(char => translitMap[char] || char)
      .join('')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 50) + '-' + Date.now();
  }

})();