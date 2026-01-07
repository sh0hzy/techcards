const ADMIN_PASSWORD = 'kz27';
let categories = [];
let cards = [];
let currentEditId = null;
let currentLang = 'ru';

const authForm = document.getElementById('auth-form');
const adminPanel = document.getElementById('admin-panel');
const cardsList = document.getElementById('cards-list');
const modalOverlay = document.getElementById('modal-overlay');
const categorySelect = document.getElementById('category-select');
const sectionsContainer = document.getElementById('sections-container');

function checkAuth() {
  const isAuth = sessionStorage.getItem('admin_auth') === 'true';
  if (isAuth) {
    showAdminPanel();
  }
}

document.getElementById('auth-btn')?.addEventListener('click', () => {
  const password = document.getElementById('admin-password').value;
  
  if (password === ADMIN_PASSWORD) {
    sessionStorage.setItem('admin_auth', 'true');
    showAdminPanel();
  } else {
    document.getElementById('auth-error').textContent = 'Неверный пароль';
  }
});

document.getElementById('admin-password')?.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    document.getElementById('auth-btn').click();
  }
});

async function showAdminPanel() {
  authForm.style.display = 'none';
  adminPanel.style.display = 'block';
  
  await loadData();
}
async function loadData() {
  try {
    categories = await loadCategories();
    cards = await loadAllCards();

    renderCardsList();
    renderCategorySelect();
  } catch (e) {
    console.error('Error loading data:', e);
    alert('Ошибка загрузки данных');
  }
}

// Загрузка категорий
async function loadCategories() {
  const url = `${CONFIG.SUPABASE_URL}/rest/v1/categories?order=sort_order.asc`;
  const response = await fetch(url, {
    headers: {
      'apikey': CONFIG.SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${CONFIG.SUPABASE_ANON_KEY}`
    }
  });
  
  if (!response.ok) throw new Error('Failed to load categories');
  return response.json();
}

// Загрузка всех карточек (для админки)
async function loadAllCards() {
  const url = `${CONFIG.SUPABASE_URL}/rest/v1/cards?select=*,category:categories(*)&order=created_at.desc`;
  const response = await fetch(url, {
    headers: {
      'apikey': CONFIG.SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${CONFIG.SUPABASE_ANON_KEY}`
    }
  });
  
  if (!response.ok) throw new Error('Failed to load cards');
  return response.json();
}

// Рендер списка карточек
function renderCardsList() {
  if (cards.length === 0) {
    cardsList.innerHTML = '<p style="color: #9ca3af; text-align: center; padding: 40px;">Карточек пока нет</p>';
    return;
  }

  cardsList.innerHTML = cards.map(card => {
    const title = card.title?.ru || card.title?.en || card.title?.kk || 'Без названия';
    const isPublished = card.is_published;
    const categoryName = card.category?.name?.ru || '';
    
    return `
      <div class="card-item" data-id="${card.id}">
        <span class="card-item-title">
          ${title}
          ${categoryName ? `<small style="color: #9ca3af;"> — ${categoryName}</small>` : ''}
        </span>
        <span class="card-item-badge ${isPublished ? '' : 'draft'}">
          ${isPublished ? 'Опубликовано' : 'Черновик'}
        </span>
      </div>
    `;
  }).join('');

  // Клики на карточки
  cardsList.querySelectorAll('.card-item').forEach(item => {
    item.addEventListener('click', () => {
      const id = item.dataset.id;
      openEditModal(id);
    });
  });
}

// Рендер select категорий
function renderCategorySelect() {
  categorySelect.innerHTML = '<option value="">— Без категории —</option>' +
    categories.map(cat => `
      <option value="${cat.id}">${cat.name?.ru || cat.slug}</option>
    `).join('');
}

// Открыть модалку добавления
document.getElementById('add-card-btn')?.addEventListener('click', () => {
  openAddModal();
});

function openAddModal() {
  currentEditId = null;
  document.getElementById('modal-title').textContent = 'Новая карточка';
  document.getElementById('delete-btn').style.display = 'none';
  
  clearForm();
  modalOverlay.classList.add('open');
}

// Открыть модалку редактирования
function openEditModal(id) {
  const card = cards.find(c => c.id === id);
  if (!card) return;

  currentEditId = id;
  document.getElementById('modal-title').textContent = 'Редактирование';
  document.getElementById('delete-btn').style.display = 'block';
  
  fillForm(card);
  modalOverlay.classList.add('open');
}

// Очистить форму
function clearForm() {
  ['ru', 'kk', 'uz', 'en', 'tk'].forEach(lang => {
    const titleEl = document.getElementById(`title-${lang}`);
    const descEl = document.getElementById(`description-${lang}`);
    const checklistEl = document.getElementById(`checklist-${lang}`);
    
    if (titleEl) titleEl.value = '';
    if (descEl) descEl.value = '';
    if (checklistEl) checklistEl.value = '';
  });
  
  document.getElementById('category-select').value = '';
  document.getElementById('images-input').value = '';
  document.getElementById('is-published').checked = true;
  
  sectionsContainer.innerHTML = '';
  addSectionEditor();
  
  // Сброс на русский язык
  currentLang = 'ru';
  document.querySelectorAll('.lang-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.lang === 'ru');
  });
  document.querySelectorAll('.lang-input').forEach(input => {
    input.style.display = input.dataset.lang === 'ru' ? 'block' : 'none';
  });
}

// Заполнить форму данными карточки
function fillForm(card) {
  ['ru', 'kk', 'uz', 'en', 'tk'].forEach(lang => {
    const titleEl = document.getElementById(`title-${lang}`);
    const descEl = document.getElementById(`description-${lang}`);
    const checklistEl = document.getElementById(`checklist-${lang}`);
    
    if (titleEl) titleEl.value = card.title?.[lang] || '';
    if (descEl) descEl.value = card.description?.[lang] || '';
    
    // Чек-лист из content
    const checklist = card.content?.[lang]?.checklist || [];
    if (checklistEl) checklistEl.value = checklist.join('\n');
  });
  
  document.getElementById('category-select').value = card.category_id || '';
  document.getElementById('images-input').value = (card.images || []).join('\n');
  document.getElementById('is-published').checked = card.is_published !== false;
  
  // Секции (используем русскую версию как основу)
  sectionsContainer.innerHTML = '';
  const sections = card.content?.ru?.sections || [];
  
  if (sections.length === 0) {
    addSectionEditor();
  } else {
    sections.forEach(section => {
      addSectionEditor(section.title || '', section.content || '');
    });
  }
}

// Добавить редактор секции
function addSectionEditor(title = '', content = '') {
  const div = document.createElement('div');
  div.className = 'section-editor';
  div.innerHTML = `
    <div class="section-editor-header">
      <span>Секция</span>
      <button type="button" class="remove-section">Удалить</button>
    </div>
    <input type="text" class="section-title-input" placeholder="Заголовок секции" value="${escapeHtml(title)}">
    <textarea class="section-content-input" placeholder="Содержимое (используйте - для списков)">${escapeHtml(content)}</textarea>
  `;
  
  div.querySelector('.remove-section').addEventListener('click', () => {
    div.remove();
  });
  
  sectionsContainer.appendChild(div);
}

// Экранирование HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

document.getElementById('add-section-btn')?.addEventListener('click', () => {
  addSectionEditor();
});

// Переключение языковых табов
document.querySelectorAll('.lang-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    currentLang = tab.dataset.lang;
    
    document.querySelectorAll('.lang-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    
    document.querySelectorAll('.lang-input').forEach(input => {
      input.style.display = input.dataset.lang === currentLang ? 'block' : 'none';
    });
  });
});

// Закрыть модалку
function closeModal() {
  modalOverlay.classList.remove('open');
}

document.getElementById('modal-close')?.addEventListener('click', closeModal);
document.getElementById('cancel-btn')?.addEventListener('click', closeModal);

modalOverlay?.addEventListener('click', (e) => {
  if (e.target === modalOverlay) closeModal();
});

// Генерация slug из заголовка
function generateSlug(title) {
  return title
    .toLowerCase()
    .replace(/[а-яё]/g, char => {
      const map = {
        'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo',
        'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
        'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
        'ф': 'f', 'х': 'h', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'sch', 'ъ': '',
        'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya'
      };
      return map[char] || char;
    })
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 50);
}

// Сохранить карточку
document.getElementById('save-btn')?.addEventListener('click', async () => {
  // Собираем данные
  const title = {};
  const description = {};
  const content = {};
  
  ['ru', 'kk', 'uz', 'en', 'tk'].forEach(lang => {
    const titleVal = document.getElementById(`title-${lang}`)?.value?.trim() || '';
    const descVal = document.getElementById(`description-${lang}`)?.value?.trim() || '';
    const checklistVal = document.getElementById(`checklist-${lang}`)?.value || '';
    
    if (titleVal) title[lang] = titleVal;
    if (descVal) description[lang] = descVal;
    
    const checklist = checklistVal
      .split('\n')
      .map(line => line.trim())
      .filter(line => line);
    
    // Собираем секции (общие для всех языков пока что)
    const sections = [];
    sectionsContainer.querySelectorAll('.section-editor').forEach(editor => {
      const sTitle = editor.querySelector('.section-title-input')?.value?.trim() || '';
      const sContent = editor.querySelector('.section-content-input')?.value?.trim() || '';
      if (sTitle || sContent) {
        sections.push({ title: sTitle, content: sContent });
      }
    });
    
    content[lang] = { sections, checklist };
  });

  // Проверка обязательных полей
  if (!title.ru && !title.en && !title.kk) {
    alert('Введите заголовок хотя бы на одном языке');
    return;
  }

  const imagesText = document.getElementById('images-input')?.value || '';
  const images = imagesText
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && line.startsWith('http'));
  
  const categoryId = document.getElementById('category-select')?.value || null;
  const isPublished = document.getElementById('is-published')?.checked ?? true;

  // Формируем объект для отправки
  const cardData = {
    title,
    description,
    content,
    images,
    category_id: categoryId || null,
    is_published: isPublished,
    updated_at: new Date().toISOString()
  };

  // Для новой карточки добавляем slug
  if (!currentEditId) {
    cardData.slug = generateSlug(title.ru || title.en || title.kk || 'card') + '-' + Date.now();
    cardData.views_count = 0;
    cardData.created_at = new Date().toISOString();
  }

  // Если изображения есть, первое делаем обложкой
  if (images.length > 0) {
    cardData.cover_image = images[0];
  }

  console.log('Saving card data:', cardData);

  try {
    let response;
    
    if (currentEditId) {
      // Обновление
      response = await fetch(`${CONFIG.SUPABASE_URL}/rest/v1/cards?id=eq.${currentEditId}`, {
        method: 'PATCH',
        headers: {
          'apikey': CONFIG.SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${CONFIG.SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify(cardData)
      });
    } else {
      // Создание
      response = await fetch(`${CONFIG.SUPABASE_URL}/rest/v1/cards`, {
        method: 'POST',
        headers: {
          'apikey': CONFIG.SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${CONFIG.SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify(cardData)
      });
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Save error response:', errorText);
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    closeModal();
    await loadData();
    alert('Сохранено!');
    
  } catch (e) {
    console.error('Save error:', e);
    alert('Ошибка сохранения: ' + e.message);
  }
});

// Удалить карточку
document.getElementById('delete-btn')?.addEventListener('click', async () => {
  if (!currentEditId) return;
  
  if (!confirm('Точно удалить карточку? Это действие нельзя отменить.')) return;

  try {
    const response = await fetch(`${CONFIG.SUPABASE_URL}/rest/v1/cards?id=eq.${currentEditId}`, {
      method: 'DELETE',
      headers: {
        'apikey': CONFIG.SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${CONFIG.SUPABASE_ANON_KEY}`
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    closeModal();
    await loadData();
    alert('Карточка удалена');
    
  } catch (e) {
    console.error('Delete error:', e);
    alert('Ошибка удаления: ' + e.message);
  }
});

// Инициализация
document.addEventListener('DOMContentLoaded', checkAuth);