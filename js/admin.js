(function() {
  'use strict';

  const ADMIN_PASSWORD = 'kz27';

  let isLoggedIn = false;
  let categories = [];
  let cards = [];
  let currentCardId = null;
  let currentLang = 'ru';
  let unsavedChanges = false;
  const elements = {};

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
    elements.categorySelect = document.getElementById('category-select');
    elements.isPublished = document.getElementById('is-published');
    elements.heroImages = document.getElementById('hero-images');
    elements.heroUploadZone = document.getElementById('hero-upload-zone');
    elements.heroFileInput = document.getElementById('hero-file-input');
    elements.heroUrlInput = document.getElementById('hero-url-input');
    elements.heroUrlAdd = document.getElementById('hero-url-add');
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
    elements.heroUploadZone?.addEventListener('click', () => elements.heroFileInput?.click());
    elements.heroUploadZone?.addEventListener('dragover', handleDragOver);
    elements.heroUploadZone?.addEventListener('dragleave', handleDragLeave);
    elements.heroUploadZone?.addEventListener('drop', handleHeroDrop);
    elements.heroFileInput?.addEventListener('change', handleHeroFileSelect);
    elements.heroUrlAdd?.addEventListener('click', handleHeroUrlAdd);
    elements.addSectionBtn?.addEventListener('click', () => addSection());
    elements.saveBtn?.addEventListener('click', saveCard);
    elements.deleteBtn?.addEventListener('click', deleteCard);
    elements.previewBtn?.addEventListener('click', showPreview);
    elements.previewClose?.addEventListener('click', hidePreview);
    document.addEventListener('input', () => { unsavedChanges = true; });
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
  function renderCardsList() {
    if (!elements.cardsList) return;

    if (cards.length === 0) {
      elements.cardsList.innerHTML = '<p style="padding: 20px; text-align: center; color: #9ca3af;">Пусто</p>';
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

    currentLang = tab.dataset.lang;
    elements.langTabs.querySelectorAll('.editor-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.lang === currentLang);
    });
    document.querySelectorAll('.lang-field').forEach(field => {
      field.style.display = field.dataset.lang === currentLang ? 'block' : 'none';
    });
  }
  function createNewCard() {
    if (unsavedChanges && !confirm('Есть несохранённые изменения. Продолжить?')) {
      return;
    }

    currentCardId = null;
    unsavedChanges = false;
    if (elements.editorPlaceholder) elements.editorPlaceholder.style.display = 'none';
    if (elements.editorForm) elements.editorForm.style.display = 'flex';
    if (elements.deleteBtn) elements.deleteBtn.style.display = 'none';

    clearForm();

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

    fillForm(card);

    renderCardsList();
  }

  function clearForm() {
    currentLang = 'ru';
    elements.langTabs?.querySelectorAll('.editor-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.lang === 'ru');
    });
    document.querySelectorAll('[data-field="title"] .lang-field').forEach(f => {
      f.value = '';
      f.style.display = f.dataset.lang === 'ru' ? 'block' : 'none';
    });

    document.querySelectorAll('[data-field="description"] .lang-field').forEach(f => {
      f.value = '';
      f.style.display = f.dataset.lang === 'ru' ? 'block' : 'none';
    });

    document.querySelectorAll('[data-field="checklist"] .lang-field').forEach(f => {
      f.value = '';
      f.style.display = f.dataset.lang === 'ru' ? 'block' : 'none';
    });

    if (elements.categorySelect) elements.categorySelect.value = '';
    if (elements.isPublished) elements.isPublished.checked = true;

    if (elements.heroImages) elements.heroImages.innerHTML = '';

    if (elements.sectionsList) elements.sectionsList.innerHTML = '';

    addSection();
  }

  function fillForm(card) {
    currentLang = 'ru';
    elements.langTabs?.querySelectorAll('.editor-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.lang === 'ru');
    });
    document.querySelectorAll('[data-field="title"] .lang-field').forEach(f => {
      const lang = f.dataset.lang;
      f.value = card.title?.[lang] || '';
      f.style.display = lang === 'ru' ? 'block' : 'none';
    });

    document.querySelectorAll('[data-field="description"] .lang-field').forEach(f => {
      const lang = f.dataset.lang;
      f.value = card.description?.[lang] || '';
      f.style.display = lang === 'ru' ? 'block' : 'none';
    });
    document.querySelectorAll('[data-field="checklist"] .lang-field').forEach(f => {
      const lang = f.dataset.lang;
      const content = card.content?.[lang];
      const checklist = content?.checklist || [];
      f.value = checklist.map(item => '- ' + item).join('\n');
      f.style.display = lang === 'ru' ? 'block' : 'none';
    });
    if (elements.categorySelect) {
      elements.categorySelect.value = card.category_id || '';
    }

    if (elements.isPublished) {
      elements.isPublished.checked = card.is_published !== false;
    }
    renderHeroImages(card.images || []);
    if (elements.sectionsList) {
      elements.sectionsList.innerHTML = '';
    }

    const ruContent = card.content?.ru;
    const sections = ruContent?.sections || [];

    if (sections.length === 0) {
      addSection();
    } else {
      sections.forEach(section => {
        addSection(section.title, section.content, section.images);
      });
    }
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

    const files = e.dataTransfer?.files;
    if (files?.length) {
      handleHeroFiles(files);
    }
  }

  function handleHeroFileSelect(e) {
    const files = e.target.files;
    if (files?.length) {
      handleHeroFiles(files);
    }
  }

  function handleHeroFiles(files) {
    alert('Для загрузки изображений используйте URL.\n\nВ будущем можно добавить загрузку файлов в Supabase Storage.');
  }

  function handleHeroUrlAdd() {
    const url = elements.heroUrlInput?.value?.trim();
    if (url && url.startsWith('http')) {
      addHeroImage(url);
      if (elements.heroUrlInput) elements.heroUrlInput.value = '';
    }
  }

  function addSection(title = '', content = '', images = []) {
    if (!elements.sectionsList || !elements.sectionTemplate) return;

    const template = elements.sectionTemplate.content.cloneNode(true);
    const section = template.querySelector('.content-section');
    const sectionId = 'section-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);

    section.dataset.sectionId = sectionId;
    const titleInput = section.querySelector('.section-title-input');
    const editor = section.querySelector('.rich-editor');

    if (titleInput) titleInput.value = title;
    if (editor) editor.innerHTML = content;

    renderSectionImages(section, images);

    bindEditorToolbar(section);
    const removeBtn = section.querySelector('.section-remove');
    removeBtn?.addEventListener('click', () => {
      section.remove();
      unsavedChanges = true;
    });

    const imageBtn = section.querySelector('.toolbar-image-btn');
    imageBtn?.addEventListener('click', () => {
      showImageModal(section);
    });

    elements.sectionsList.appendChild(section);
  }

  function bindEditorToolbar(section) {
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
        unsavedChanges = true;

        // Update button state
        updateToolbarState(toolbar);
      });
    });

    // Update toolbar state on selection change
    editor.addEventListener('keyup', () => updateToolbarState(toolbar));
    editor.addEventListener('mouseup', () => updateToolbarState(toolbar));
  }

  function updateToolbarState(toolbar) {
    toolbar.querySelectorAll('button[data-command]').forEach(btn => {
      const command = btn.dataset.command;
      const isActive = document.queryCommandState(command);
      btn.classList.toggle('active', isActive);
    });
  }

  function renderSectionImages(section, images) {
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
        const currentImages = getSectionImages(section);
        currentImages.splice(idx, 1);
        renderSectionImages(section, currentImages);
        unsavedChanges = true;
      });
    });
  }

  function getSectionImages(section) {
    const container = section.querySelector('.section-images');
    if (!container) return [];

    const items = container.querySelectorAll('.image-item');
    return Array.from(items).map(item => {
      const style = item.style.backgroundImage;
      return style.replace(/^url\(['"]?/, '').replace(/['"]?\)$/, '');
    });
  }

  function showImageModal(section) {
    const modal = document.createElement('div');
    modal.className = 'image-modal';
    modal.innerHTML = `
      <div class="image-modal-content">
        <h3>Добавить изображение</h3>
        <input type="url" id="section-image-url" placeholder="https://example.com/image.jpg">
        <div class="image-modal-actions">
          <button class="btn-secondary" id="image-modal-cancel">Отмена</button>
          <button class="btn-primary" id="image-modal-add">Добавить</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const urlInput = modal.querySelector('#section-image-url');
    const cancelBtn = modal.querySelector('#image-modal-cancel');
    const addBtn = modal.querySelector('#image-modal-add');

    cancelBtn.addEventListener('click', () => modal.remove());

    addBtn.addEventListener('click', () => {
      const url = urlInput.value.trim();
      if (url && url.startsWith('http')) {
        const images = getSectionImages(section);
        images.push(url);
        renderSectionImages(section, images);

        // Also insert into editor
        const editor = section.querySelector('.rich-editor');
        if (editor) {
          editor.focus();
          document.execCommand('insertImage', false, url);
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

  // === Collect Form Data ===
  function collectFormData() {
    const title = {};
    const description = {};
    const content = {};

    // Collect multilingual fields
    ['ru', 'kk', 'uz', 'en', 'tk'].forEach(lang => {
      // Title
      const titleField = document.querySelector(`[data-field="title"] .lang-field[data-lang="${lang}"]`);
      if (titleField?.value?.trim()) {
        title[lang] = titleField.value.trim();
      }

      // Description
      const descField = document.querySelector(`[data-field="description"] .lang-field[data-lang="${lang}"]`);
      if (descField?.value?.trim()) {
        description[lang] = descField.value.trim();
      }

      // Checklist
      const checklistField = document.querySelector(`[data-field="checklist"] .lang-field[data-lang="${lang}"]`);
      const checklistText = checklistField?.value || '';
      const checklist = checklistText
        .split('\n')
        .map(line => line.replace(/^[-•]\s*/, '').trim())
        .filter(line => line);

      // Sections (currently only RU)
      const sections = [];
      if (lang === 'ru') {
        elements.sectionsList?.querySelectorAll('.content-section').forEach(section => {
          const sTitle = section.querySelector('.section-title-input')?.value?.trim() || '';
          const sContent = section.querySelector('.rich-editor')?.innerHTML || '';
          const sImages = getSectionImages(section);

          if (sTitle || sContent) {
            sections.push({
              title: sTitle,
              content: sContent,
              images: sImages
            });
          }
        });
      }

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
    if (!data.title.ru && !data.title.en) {
      alert('Введите заголовок хотя бы на одном языке');
      return;
    }

    // Add metadata
    data.updated_at = new Date().toISOString();

    if (!currentCardId) {
      // New card
      data.slug = generateSlug(data.title.ru || data.title.en || 'card');
      data.views_count = 0;
      data.created_at = new Date().toISOString();
    }

    console.log('Saving:', data);

    try {
      let response;

      if (currentCardId) {
        // Update
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
        // Create
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

      // Reload data
      await loadData();

      // If new card, select it
      if (!currentCardId && response.headers.get('content-type')?.includes('json')) {
        const created = await response.json();
        if (created?.[0]?.id) {
          loadCardForEdit(created[0].id);
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

      // Hide editor
      if (elements.editorForm) elements.editorForm.style.display = 'none';
      if (elements.editorPlaceholder) elements.editorPlaceholder.style.display = 'flex';

      // Reload
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