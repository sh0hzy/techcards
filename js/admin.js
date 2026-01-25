// js/admin.js

(function() {
  'use strict';

  // === Конфигурация ===
  const ADMIN_PASSWORD = 'kz27';
  const LANGUAGES = ['ru', 'kk', 'uz', 'en', 'tk'];
  const LANG_NAMES = {
    ru: 'Русский',
    kk: 'Қазақша',
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
    sections: {} // sections[lang] = [{title, content, images, nestedSections: []}, ...]
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
  }

  function bindEvents() {
    elements.authForm?.addEventListener('submit', handleLogin);
    elements.logoutBtn?.addEventListener('click', handleLogout);
    elements.langTabs?.addEventListener('click', handleLangTabClick);
    elements.addCardBtn?.addEventListener('click', createNewCard);
    
    // Hero images
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

    // Title, Description, Checklist - сохраняем при изменении
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

    // Sections
    elements.addSectionBtn?.addEventListener('click', () => addSection());

    // Actions
    elements.saveBtn?.addEventListener('click', saveCard);
    elements.deleteBtn?.addEventListener('click', deleteCard);
    elements.previewBtn?.addEventListener('click', showPreview);
    elements.previewClose?.addEventListener('click', hidePreview);

    // Warn before leaving
    window.addEventListener('beforeunload', (e) => {
      if (unsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    });
  }

  // === Auth ===
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

  // === Data Loading ===
  async function loadData() {
    try {
      const [categoriesData, cardsData] = await Promise.all([
        fetchFromSupabase('categories?order=sort_order.asc'),
        fetchFromSupabase('cards?select=*,category:categories(*)&order=created_at.desc')
      ]);

      categories = categoriesData || [];
      cards = cardsData || [];

      renderCardsList();
      renderCategorySelect();
    } catch (error) {
      console.error('Load error:', error);
      alert('Ошибка загрузки данных');
    }
  }

  async function fetchFromSupabase(endpoint) {
    const response = await fetch(`${CONFIG.SUPABASE_URL}/rest/v1/${endpoint}`, {
      headers: {
        'apikey': CONFIG.SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${CONFIG.SUPABASE_ANON_KEY}`
      }
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }

  // === Render Cards List ===
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

  // === Language Tabs ===
  function handleLangTabClick(e) {
    const tab = e.target.closest('.editor-tab');
    if (!tab) return;

    // Сохраняем текущие данные секций перед переключением
    saveSectionsToFormData();

    const newLang = tab.dataset.lang;
    switchLanguage(newLang);
  }

  function switchLanguage(lang) {
    currentLang = lang;

    // Update tabs
    elements.langTabs?.querySelectorAll('.editor-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.lang === currentLang);
    });

    // Update label
    if (elements.currentLangLabel) {
      elements.currentLangLabel.textContent = LANG_NAMES[currentLang] || currentLang.toUpperCase();
    }

    // Загружаем данные для нового языка
    loadLanguageData();
  }

  function loadLanguageData() {
    // Title
    if (elements.titleInput) {
      elements.titleInput.value = formData.title[currentLang] || '';
      elements.titleInput.placeholder = `Заголовок (${LANG_NAMES[currentLang]})`;
    }

    // Description
    if (elements.descriptionInput) {
      elements.descriptionInput.value = formData.description[currentLang] || '';
      elements.descriptionInput.placeholder = `Описание (${LANG_NAMES[currentLang]})`;
    }

    // Checklist
    if (elements.checklistInput) {
      elements.checklistInput.value = formData.checklist[currentLang] || '';
      elements.checklistInput.placeholder = `Чек-лист (${LANG_NAMES[currentLang]})\nКаждый пункт с новой строки:\n- Пункт 1\n- Пункт 2`;
    }

    // Sections
    renderSections();
  }

  // === Sections ===
  function renderSections() {
    if (!elements.sectionsList) return;

    elements.sectionsList.innerHTML = '';

    const sections = formData.sections[currentLang] || [];

    if (sections.length === 0) {
      // Добавляем пустую секцию
      addSection();
    } else {
      sections.forEach((section, index) => {
        addSectionElement(section.title, section.content, section.images, index);
      });
    }
  }

  // Helper to escape HTML in nested section inputs
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

    addSectionElement(title, content, images, index);
    unsavedChanges = true;
  }

  function addSectionElement(title, content, images, index) {
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

    // Toolbar
    bindEditorToolbar(section, index);

    // Remove button
    const removeBtn = section.querySelector('.section-remove');
    removeBtn?.addEventListener('click', () => {
      removeSection(index);
    });

    // Image button
    const imageBtn = section.querySelector('.toolbar-image-btn');
    imageBtn?.addEventListener('click', () => {
      showImageModal(index);
    });

    // Render section images
    renderSectionImages(section, images, index);

    // Nested sections
    const nestedContainer = section.querySelector('.nested-sections-list');
    const addNestedBtn = section.querySelector('.btn-add-nested');

    if (addNestedBtn) {
      addNestedBtn.addEventListener('click', () => {
        addNestedSection(index);
      });
    }

    // Render existing nested sections
    const nestedSections = formData.sections[currentLang]?.[index]?.nestedSections || [];
    renderNestedSections(section, index, nestedSections);

    elements.sectionsList.appendChild(section);
  }

  // === Nested Sections ===
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

    formData.sections[currentLang][parentIndex].nestedSections.push({ title, content, images: [] });

    const parentSection = elements.sectionsList?.querySelector(`[data-index="${parentIndex}"]`);
    if (parentSection) {
      renderNestedSections(parentSection, parentIndex, formData.sections[currentLang][parentIndex].nestedSections);
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
      const nestedEl = document.createElement('div');
      nestedEl.className = 'nested-section-item';
      nestedEl.dataset.nestedIndex = nestedIndex;

      nestedEl.innerHTML = `
        <div class="nested-section-header">
          <input type="text" class="nested-section-title" placeholder="Заголовок подраздела" value="${escapeHtmlAttr(nested.title || '')}">
          <button type="button" class="nested-section-remove" title="Удалить">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <div class="nested-section-editor" contenteditable="true" data-placeholder="Содержимое подраздела...">${nested.content || ''}</div>
      `;

      // Title input
      const titleInput = nestedEl.querySelector('.nested-section-title');
      titleInput.addEventListener('input', () => {
        updateNestedSectionData(parentIndex, nestedIndex, 'title', titleInput.value);
      });

      // Content editor
      const editor = nestedEl.querySelector('.nested-section-editor');
      editor.addEventListener('input', () => {
        updateNestedSectionData(parentIndex, nestedIndex, 'content', editor.innerHTML);
      });

      // Remove button
      const removeBtn = nestedEl.querySelector('.nested-section-remove');
      removeBtn.addEventListener('click', () => {
        removeNestedSection(parentIndex, nestedIndex);
      });

      container.appendChild(nestedEl);
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
          const nestedContent = nestedEl.querySelector('.nested-section-editor')?.innerHTML || '';
          nestedSections.push({ title: nestedTitle, content: nestedContent, images: [] });
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

  // Команды форматирования
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

  // Select для заголовков
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
      e.target.value = ''; // Reset select
    });
  }

  // Select для размера шрифта
  const fontSizeSelect = toolbar.querySelector('.toolbar-fontsize');
  if (fontSizeSelect) {
    fontSizeSelect.addEventListener('change', (e) => {
      const value = e.target.value;
      if (value) {
        editor.focus();
        document.execCommand('fontSize', false, value);
        updateSectionData(index, 'content', editor.innerHTML);
      }
      e.target.value = ''; // Reset select
    });
  }

  // Кнопка ссылки
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

  // Кнопка изображения
  const imageBtn = toolbar.querySelector('.toolbar-image-btn');
  if (imageBtn) {
    imageBtn.addEventListener('click', () => {
      showImageModal(index);
    });
  }

  // Кнопка видео
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

  // Кнопка таблицы
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

  // Кнопка карусели
  const carouselBtn = toolbar.querySelector('.toolbar-carousel-btn');
  if (carouselBtn) {
    carouselBtn.addEventListener('click', () => {
      showCarouselModal(index, editor);
    });
  }

  // Горячие клавиши
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

  // Обновление состояния toolbar при изменении выделения
  editor.addEventListener('keyup', () => updateToolbarState(toolbar));
  editor.addEventListener('mouseup', () => updateToolbarState(toolbar));
  
  // Сохранение при вводе
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
    } catch (e) {
      // Некоторые команды не поддерживают queryCommandState
    }
  });
}

function extractYouTubeId(url) {
  const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
  const match = url.match(regex);
  return match ? match[1] : null;
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
        // Add to section images array
        if (!formData.sections[currentLang]) {
          formData.sections[currentLang] = [];
        }
        if (!formData.sections[currentLang][sectionIndex]) {
          formData.sections[currentLang][sectionIndex] = { title: '', content: '', images: [] };
        }
        if (!formData.sections[currentLang][sectionIndex].images) {
          formData.sections[currentLang][sectionIndex].images = [];
        }
        formData.sections[currentLang][sectionIndex].images.push(url);

        // Re-render section images
        const sectionEl = elements.sectionsList?.querySelector(`[data-index="${sectionIndex}"]`);
        if (sectionEl) {
          renderSectionImages(sectionEl, formData.sections[currentLang][sectionIndex].images, sectionIndex);
        }

        // Insert into editor if checked
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

  // === Carousel Modal ===
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
        // Создаём HTML для карусели
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

  // === Create New Card ===
  function createNewCard() {
    if (unsavedChanges && !confirm('Есть несохранённые изменения. Продолжить?')) {
      return;
    }

    currentCardId = null;
    unsavedChanges = false;

    // Reset form data
    formData = {
      title: {},
      description: {},
      checklist: {},
      sections: {}
    };

    // Show editor
    if (elements.editorPlaceholder) elements.editorPlaceholder.style.display = 'none';
    if (elements.editorForm) elements.editorForm.style.display = 'flex';
    if (elements.deleteBtn) elements.deleteBtn.style.display = 'none';

    // Clear hero images
    if (elements.heroImages) elements.heroImages.innerHTML = '';

    // Reset category & status
    if (elements.categorySelect) elements.categorySelect.value = '';
    if (elements.isPublished) elements.isPublished.checked = true;

    // Switch to RU and load empty data
    switchLanguage('ru');

    // Update sidebar
    renderCardsList();
  }

  // === Load Card for Edit ===
  function loadCardForEdit(id) {
    if (unsavedChanges && !confirm('Есть несохранённые изменения. Продолжить?')) {
      return;
    }

    const card = cards.find(c => c.id === id);
    if (!card) return;

    currentCardId = id;
    unsavedChanges = false;

    // Show editor
    if (elements.editorPlaceholder) elements.editorPlaceholder.style.display = 'none';
    if (elements.editorForm) elements.editorForm.style.display = 'flex';
    if (elements.deleteBtn) elements.deleteBtn.style.display = 'flex';

    // Load card data into formData
    formData = {
      title: { ...card.title } || {},
      description: { ...card.description } || {},
      checklist: {},
      sections: {}
    };

    // Load checklist and sections for each language
    LANGUAGES.forEach(lang => {
      const content = card.content?.[lang];
      if (content) {
        // Checklist
        const checklist = content.checklist || [];
        formData.checklist[lang] = checklist.map(item => '- ' + item).join('\n');

        // Sections
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

    // Hero images
    renderHeroImages(card.images || []);

    // Category
    if (elements.categorySelect) {
      elements.categorySelect.value = card.category_id || '';
    }

    // Status
    if (elements.isPublished) {
      elements.isPublished.checked = card.is_published !== false;
    }

    // Switch to RU and load data
    switchLanguage('ru');

    // Update sidebar
    renderCardsList();
  }

  // === Hero Images ===
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

  // === Collect Form Data for Save ===
  function collectFormData() {
    // Сохраняем текущие секции
    saveSectionsToFormData();

    // Сохраняем текущие поля
    if (elements.titleInput) {
      formData.title[currentLang] = elements.titleInput.value;
    }
    if (elements.descriptionInput) {
      formData.description[currentLang] = elements.descriptionInput.value;
    }
    if (elements.checklistInput) {
      formData.checklist[currentLang] = elements.checklistInput.value;
    }

    // Собираем title и description
    const title = {};
    const description = {};
    const content = {};

    LANGUAGES.forEach(lang => {
      // Title
      if (formData.title[lang]?.trim()) {
        title[lang] = formData.title[lang].trim();
      }

      // Description
      if (formData.description[lang]?.trim()) {
        description[lang] = formData.description[lang].trim();
      }

      // Content (sections + checklist)
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

      content[lang] = { sections, checklist };
    });

    // Images
    const images = getHeroImages();

    // Category & status
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

  // === Save Card ===
  async function saveCard() {
    const data = collectFormData();

    // Validate
    if (!data.title.ru && !data.title.en && !data.title.kk) {
      alert('Введите заголовок хотя бы на одном языке');
      return;
    }

    // Add metadata
    data.updated_at = new Date().toISOString();

    if (!currentCardId) {
      data.slug = generateSlug(data.title.ru || data.title.en || data.title.kk || 'card');
      data.views_count = 0;
      data.created_at = new Date().toISOString();
    }

    console.log('Saving:', data);

    try {
      let response;

      if (currentCardId) {
        response = await fetch(`${CONFIG.SUPABASE_URL}/rest/v1/cards?id=eq.${currentCardId}`, {
          method: 'PATCH',
          headers: {
            'apikey': CONFIG.SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${CONFIG.SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify(data)
        });
      } else {
        response = await fetch(`${CONFIG.SUPABASE_URL}/rest/v1/cards`, {
          method: 'POST',
          headers: {
            'apikey': CONFIG.SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${CONFIG.SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
          },
          body: JSON.stringify(data)
        });
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText);
      }

      unsavedChanges = false;

      await loadData();

      if (!currentCardId && response.headers.get('content-type')?.includes('json')) {
        const created = await response.json();
        if (created?.[0]?.id) {
          currentCardId = created[0].id;
          renderCardsList();
        }
      }

      alert('Сохранено!');

    } catch (error) {
      console.error('Save error:', error);
      alert('Ошибка сохранения: ' + error.message);
    }
  }

  // === Delete Card ===
  async function deleteCard() {
    if (!currentCardId) return;

    if (!confirm('Удалить карточку? Это действие нельзя отменить.')) {
      return;
    }

    try {
      const response = await fetch(`${CONFIG.SUPABASE_URL}/rest/v1/cards?id=eq.${currentCardId}`, {
        method: 'DELETE',
        headers: {
          'apikey': CONFIG.SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${CONFIG.SUPABASE_ANON_KEY}`
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

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

  // === Preview ===
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

  // === Helpers ===
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
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