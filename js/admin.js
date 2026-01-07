
const ADMIN_PASSWORD = 'kazarbuild2024'; // Поменяй на свой пароль

let categories = [];
let cards = [];
let currentEditId = null;
let currentLang = 'ru';

// Элементы
const authForm = document.getElementById('auth-form');
const adminPanel = document.getElementById('admin-panel');
const cardsList = document.getElementById('cards-list');
const modalOverlay = document.getElementById('modal-overlay');
const categorySelect = document.getElementById('category-select');
const sectionsContainer = document.getElementById('sections-container');

// Проверка авторизации
function checkAuth() {
  const isAuth = sessionStorage.getItem('admin_auth') === 'true';
  if (isAuth) {
    showAdminPanel();
  }
}

// Авторизация
document.getElementById('auth-btn')?.addEventListener('click', () => {
  const password = document.getElementById('admin-password').value;
  
  if (password === ADMIN_PASSWORD) {
    sessionStorage.setItem('admin_auth', 'true');
    showAdminPanel();
  } else {
    document.getElementById('auth-error').textContent = 'Неверный пароль';
  }
});

// Показать админ-панель
async function showAdminPanel() {
  authForm.style.display = 'none';
  adminPanel.style.display = 'block';
  
  await loadData();
}

// Загрузка данных
async function loadData() {
  try {
    [categories, cards] = await Promise.all([
      DB.getCategories(),
      DB.request('cards?select=*,category:categories(*)&order=created_at.desc')
    ]);

    renderCardsList();
    renderCategorySelect();
  } catch (e) {
    console.error('Error loading data:', e);
  }
}

// Рендер списка карточек
function renderCardsList() {
  cardsList.innerHTML = cards.map(card => {
    const title = card.title?.ru || card.title?.en || 'Без названия';
    const isPublished = card.is_published;
    
    return `
      <div class="card-item" data-id="${card.id}">
        <span class="card-item-title">${title}</span>
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
  categorySelect.innerHTML = '<option value="">-- Выберите --</option>' +
    categories.map(cat => `
      <option value="${cat.id}">${cat.name?.ru || cat.slug}</option>
    `).join('');
}

// Открыть модалку добавления
document.getElementById('add-card-btn')?.addEventListener('click', () => {
  openAddModal();
});

// Открыть модалку добавления
function openAddModal() {
  currentEditId = null;
  document.getElementById('modal-title').textContent = 'Новая карточка';
  document.getElementById('delete-btn').style.display = 'none';
  
  // Очистить форму
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
  
  // Заполнить форму
  fillForm(card);
  
  modalOverlay.classList.add('open');
}

// Очистить форму
function clearForm() {
  document.getElementById('card-id').value = '';
  
  ['ru', 'kk', 'uz', 'en', 'tk'].forEach(lang => {
    document.getElementById(`title-${lang}`).value = '';
    document.getElementById(`description-${lang}`).value = '';
    document.getElementById(`checklist-${lang}`).value = '';
  });
  
  document.getElementById('category-select').value = '';
  document.getElementById('images-input').value = '';
  document.getElementById('is-published').checked = true;
  
  sectionsContainer.innerHTML = '';
  addSectionEditor();
}

// Заполнить форму данными карточки
function fillForm(card) {
  ['ru', 'kk', 'uz', 'en', 'tk'].forEach(lang => {
    document.getElementById(`title-${lang}`).value = card.title?.[lang] || '';
    document.getElementById(`description-${lang}`).value = card.description?.[lang] || '';
    
    const checklist = card.content?.[lang]?.checklist || [];
    document.getElementById(`checklist-${lang}`).value = checklist.join('\n');
  });
  
  document.getElementById('category-select').value = card.category_id || '';
  document.getElementById('images-input').value = (card.images || []).join('\n');
  document.getElementById('is-published').checked = card.is_published;
  
  // Секции (используем русскую версию как основу)
  sectionsContainer.innerHTML = '';
  const sections = card.content?.ru?.sections || [];
  
  if (sections.length === 0) {
    addSectionEditor();
  } else {
    sections.forEach(section => {
      addSectionEditor(section.title, section.content);
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
    <input type="text" class="section-title-input" placeholder="Заголовок секции" value="${title}">
    <textarea class="section-content-input" placeholder="Содержимое секции">${content}</textarea>
  `;
  
  div.querySelector('.remove-section').addEventListener('click', () => {
    div.remove();
  });
  
  sectionsContainer.appendChild(div);
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

// Сохранить карточку
document.getElementById('save-btn')?.addEventListener('click', async () => {
  const title = {};
  const description = {};
  const content = {};
  
  ['ru', 'kk', 'uz', 'en', 'tk'].forEach(lang => {
    title[lang] = document.getElementById(`title-${lang}`).value;
    description[lang] = document.getElementById(`description-${lang}`).value;
    
    const checklistText = document.getElementById(`checklist-${lang}`).value;
    const checklist = checklistText.split('\n').filter(line => line.trim());
    
    // Собираем секции (пока только на русском языке)
    const sections = [];
    sectionsContainer.querySelectorAll('.section-editor').forEach(editor => {
      const sTitle = editor.querySelector('.section-title-input').value;
      const sContent = editor.querySelector('.section-content-input').value;
      if (sTitle || sContent) {
        sections.push({ title: sTitle, content: sContent });
      }
    });
    
    content[lang] = { sections, checklist };
  });

  const imagesText = document.getElementById('images-input').value;
  const images = imagesText.split('\n').filter(line => line.trim());
  
  const categoryId = document.getElementById('category-select').value || null;
  const isPublished = document.getElementById('is-published').checked;

  const cardData = {
    title,
    description,
    content,
    images,
    category_id: categoryId,
    is_published: isPublished
  };

  try {
    if (currentEditId) {
      // Обновление
      await DB.request(`cards?id=eq.${currentEditId}`, {
        method: 'PATCH',
        body: JSON.stringify(cardData)
      });
    } else {
      // Создание
      await DB.request('cards', {
        method: 'POST',
        body: JSON.stringify(cardData)
      });
    }

    closeModal();
    await loadData();
    
  } catch (e) {
    console.error('Save error:', e);
    alert('Ошибка сохранения');
  }
});

// Удалить карточку
document.getElementById('delete-btn')?.addEventListener('click', async () => {
  if (!currentEditId) return;
  
  if (!confirm('Удалить карточку?')) return;

  try {
    await DB.request(`cards?id=eq.${currentEditId}`, {
      method: 'DELETE'
    });
    
    closeModal();
    await loadData();
    
  } catch (e) {
    console.error('Delete error:', e);
    alert('Ошибка удаления');
  }
});
