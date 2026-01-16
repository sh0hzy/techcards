function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// js/app.js

(function() {
  'use strict';

  // === Состояние ===
  let categories = [];
  let cards = [];
  let filteredCards = [];
  let currentCategory = 'all';
  let searchQuery = '';
  let searchTimeout = null;

  // === Элементы ===
  const elements = {};

  // === Инициализация ===
  document.addEventListener('DOMContentLoaded', init);

  function init() {
    cacheElements();
    bindEvents();
    loadData();
    initBurgerMenu();
    initLanguageSwitcher();
  }

  function cacheElements() {
    elements.categoriesList = document.getElementById('categories-list');
    elements.cardsGrid = document.getElementById('cards-grid');
    elements.searchInput = document.getElementById('search-input');
    elements.searchClear = document.getElementById('search-clear');
    elements.searchResults = document.getElementById('search-results');
    elements.sortSelect = document.getElementById('sort-select');
    elements.burger = document.getElementById('burger');
    elements.menu = document.getElementById('menu');
  }

  function bindEvents() {
    // Поиск с debounce
    elements.searchInput?.addEventListener('input', (e) => {
      searchQuery = e.target.value.trim();
      
      // Показываем/скрываем кнопку очистки
      if (elements.searchClear) {
        elements.searchClear.style.display = searchQuery ? 'flex' : 'none';
      }

      // Debounce поиска
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        filterAndRenderCards();
      }, 300);
    });

    // Очистка поиска
    elements.searchClear?.addEventListener('click', () => {
      if (elements.searchInput) {
        elements.searchInput.value = '';
        searchQuery = '';
        elements.searchClear.style.display = 'none';
        filterAndRenderCards();
        elements.searchInput.focus();
      }
    });

    // Поиск по Enter
    elements.searchInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        clearTimeout(searchTimeout);
        filterAndRenderCards();
      }
      if (e.key === 'Escape') {
        elements.searchInput.value = '';
        searchQuery = '';
        elements.searchClear.style.display = 'none';
        filterAndRenderCards();
      }
    });

    // Сортировка
    elements.sortSelect?.addEventListener('change', () => {
      filterAndRenderCards();
    });

    // Смена языка
    document.addEventListener('localeChanged', () => {
      renderCategories();
      filterAndRenderCards();
    });
  }

  // === Загрузка данных ===
  async function loadData() {
    showLoadingState();

    try {
      const [categoriesData, cardsData] = await Promise.all([
        fetchFromSupabase('categories?order=sort_order.asc'),
        fetchFromSupabase('cards?is_published=eq.true&select=*,category:categories(*)&order=created_at.desc')
      ]);

      categories = categoriesData || [];
      cards = cardsData || [];

      renderCategories();
      filterAndRenderCards();

    } catch (error) {
      console.error('Load error:', error);
      showErrorState();
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

  // === Фильтрация и поиск ===
  function filterAndRenderCards() {
    const lang = localStorage.getItem('locale') || 'ru';
    const sortBy = elements.sortSelect?.value || 'newest';

    // Фильтрация по категории
    let result = cards;
    
    if (currentCategory !== 'all') {
      result = result.filter(card => card.category_id === currentCategory);
    }

    // Поиск
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const queryWords = query.split(/\s+/).filter(w => w.length > 0);

      result = result.filter(card => {
        const title = getLocalized(card.title, lang).toLowerCase();
        const description = getLocalized(card.description, lang).toLowerCase();
        const categoryName = card.category ? getLocalized(card.category.name, lang).toLowerCase() : '';
        
        // Поиск в контенте
        const content = getLocalized(card.content, lang);
        let contentText = '';
        if (content?.sections) {
          content.sections.forEach(section => {
            contentText += ' ' + (section.title || '') + ' ' + stripHtml(section.content || '');
          });
        }
        if (content?.checklist) {
          contentText += ' ' + content.checklist.join(' ');
        }
        contentText = contentText.toLowerCase();

        // Все слова должны найтись хотя бы в одном поле
        return queryWords.every(word => 
          title.includes(word) || 
          description.includes(word) || 
          categoryName.includes(word) ||
          contentText.includes(word)
        );
      });
    }

    // Сортировка
    result = sortCards(result, sortBy, lang);

    filteredCards = result;

    // Обновляем счётчик результатов
    updateSearchResults();

    // Рендерим
    renderCards(result);
  }

  function sortCards(cards, sortBy, lang) {
    const sorted = [...cards];

    switch (sortBy) {
      case 'newest':
        sorted.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        break;
      case 'oldest':
        sorted.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        break;
      case 'alphabetical':
        sorted.sort((a, b) => {
          const titleA = getLocalized(a.title, lang).toLowerCase();
          const titleB = getLocalized(b.title, lang).toLowerCase();
          return titleA.localeCompare(titleB, lang);
        });
        break;
      case 'popular':
        sorted.sort((a, b) => (b.views_count || 0) - (a.views_count || 0));
        break;
    }

    return sorted;
  }

  function updateSearchResults() {
    if (!elements.searchResults) return;

    if (searchQuery) {
      const count = filteredCards.length;
      const lang = localStorage.getItem('locale') || 'ru';
      
      let text = '';
      if (count === 0) {
        text = getSearchText('noResults', lang);
      } else {
        text = getSearchText('found', lang).replace('{count}', count);
      }

      elements.searchResults.textContent = text;
      elements.searchResults.style.display = 'block';
    } else {
      elements.searchResults.style.display = 'none';
    }
  }

  function getSearchText(key, lang) {
    const texts = {
      noResults: {
        ru: 'Ничего не найдено',
        kk: 'Ештеңе табылмады',
        uz: 'Hech narsa topilmadi',
        en: 'Nothing found',
        tk: 'Hiç zat tapylmady'
      },
      found: {
        ru: 'Найдено: {count}',
        kk: 'Табылды: {count}',
        uz: 'Topildi: {count}',
        en: 'Found: {count}',
        tk: 'Tapyldy: {count}'
      }
    };

    return texts[key]?.[lang] || texts[key]?.ru || '';
  }

  function stripHtml(html) {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  }

  // === Рендер категорий ===
  function renderCategories() {
    if (!elements.categoriesList) return;

    const lang = localStorage.getItem('locale') || 'ru';

    // Считаем карточки в категориях
    const categoryCounts = {};
    cards.forEach(card => {
      if (card.category_id) {
        categoryCounts[card.category_id] = (categoryCounts[card.category_id] || 0) + 1;
      }
    });

    let html = `
      <button class="category-btn ${currentCategory === 'all' ? 'active' : ''}" data-category="all">
        <span class="category-icon">📋</span>
        <span class="category-name">${getCategoryAllText(lang)}</span>
        <span class="category-count">${cards.length}</span>
      </button>
    `;

    categories.forEach(cat => {
      const name = getLocalized(cat.name, lang);
      const count = categoryCounts[cat.id] || 0;
      const isActive = currentCategory === cat.id;

      html += `
        <button class="category-btn ${isActive ? 'active' : ''}" data-category="${cat.id}">
          <span class="category-icon">${cat.icon || '📁'}</span>
          <span class="category-name">${escapeHtml(name)}</span>
          <span class="category-count">${count}</span>
        </button>
      `;
    });

    elements.categoriesList.innerHTML = html;

    // Обработчики
    elements.categoriesList.querySelectorAll('.category-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        currentCategory = btn.dataset.category;
        
        // Обновляем активную категорию
        elements.categoriesList.querySelectorAll('.category-btn').forEach(b => {
          b.classList.toggle('active', b.dataset.category === currentCategory);
        });

        filterAndRenderCards();
      });
    });
  }

  function getCategoryAllText(lang) {
    const texts = {
      ru: 'Все карточки',
      kk: 'Барлық карталар',
      uz: 'Barcha kartalar',
      en: 'All cards',
      tk: 'Ähli kartalar'
    };
    return texts[lang] || texts.ru;
  }

  // === Рендер карточек ===
  function renderCards(cardsToRender) {
    if (!elements.cardsGrid) return;

    if (cardsToRender.length === 0) {
      elements.cardsGrid.innerHTML = `
        <div class="empty-state">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
            <circle cx="11" cy="11" r="8"></circle>
            <path d="m21 21-4.35-4.35"></path>
          </svg>
          <p>${getEmptyText()}</p>
        </div>
      `;
      return;
    }

    const lang = localStorage.getItem('locale') || 'ru';

    elements.cardsGrid.innerHTML = cardsToRender.map(card => {
      const title = getLocalized(card.title, lang);
      const description = getLocalized(card.description, lang);
      const image = card.cover_image || card.images?.[0] || '';
      const categoryName = card.category ? getLocalized(card.category.name, lang) : '';

      // Подсветка поискового запроса
      const highlightedTitle = highlightSearch(title, searchQuery);
      const highlightedDesc = highlightSearch(truncate(description, 100), searchQuery);

      return `
        <a href="card.html?id=${card.id}" class="card-item">
          <div class="card-image" style="background-image: url('${image}');">
            ${!image ? '<div class="card-image-placeholder"></div>' : ''}
          </div>
          <div class="card-content">
            ${categoryName ? `<span class="card-category">${escapeHtml(categoryName)}</span>` : ''}
            <h3 class="card-title">${highlightedTitle}</h3>
            ${description ? `<p class="card-description">${highlightedDesc}</p>` : ''}
          </div>
        </a>
      `;
    }).join('');
  }

  function highlightSearch(text, query) {
    if (!query || !text) return escapeHtml(text);

    const escaped = escapeHtml(text);
    const words = query.split(/\s+/).filter(w => w.length > 0);

    let result = escaped;
    words.forEach(word => {
      const regex = new RegExp(`(${escapeRegex(word)})`, 'gi');
      result = result.replace(regex, '<mark>$1</mark>');
    });

    return result;
  }

  function escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function getEmptyText() {
    const lang = localStorage.getItem('locale') || 'ru';
    const texts = {
      ru: 'Карточки не найдены',
      kk: 'Карталар табылмады',
      uz: 'Kartalar topilmadi',
      en: 'No cards found',
      tk: 'Kartalar tapylmady'
    };
    return texts[lang] || texts.ru;
  }

  // === Состояния загрузки ===
  function showLoadingState() {
    if (!elements.cardsGrid) return;

    elements.cardsGrid.innerHTML = `
      <div class="skeleton-card"></div>
      <div class="skeleton-card"></div>
      <div class="skeleton-card"></div>
      <div class="skeleton-card"></div>
      <div class="skeleton-card"></div>
      <div class="skeleton-card"></div>
    `;
  }

  function showErrorState() {
    if (!elements.cardsGrid) return;

    elements.cardsGrid.innerHTML = `
      <div class="empty-state error">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
        <p>Ошибка загрузки данных</p>
        <button class="btn-retry" onclick="location.reload()">Повторить</button>
      </div>
    `;
  }

  // === Helpers ===
  function getLocalized(obj, lang) {
    if (!obj) return '';
    if (typeof obj === 'string') return obj;
    return obj[lang] || obj['ru'] || obj['en'] || '';
  }

  function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function truncate(text, length) {
    if (!text) return '';
    if (text.length <= length) return text;
    return text.substring(0, length) + '...';
  }

  // === Burger Menu ===
  function initBurgerMenu() {
    elements.burger?.addEventListener('click', () => {
      elements.burger.classList.toggle('active');
      elements.menu?.classList.toggle('open');
    });
  }

  // === Language Switcher ===
  function initLanguageSwitcher() {
    document.querySelectorAll('.lang-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const lang = btn.dataset.lang;
        localStorage.setItem('locale', lang);

        document.querySelectorAll('.lang-btn').forEach(b => {
          b.classList.toggle('active', b.dataset.lang === lang);
        });

        document.dispatchEvent(new CustomEvent('localeChanged', { detail: { lang } }));
      });
    });

    // Установить активный язык
    const currentLang = localStorage.getItem('locale') || 'ru';
    document.querySelectorAll('.lang-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.lang === currentLang);
    });
  }

})();
function showSkeletons(container, count = 6) {
  if (!container) return;
  container.innerHTML = Array(count).fill(`
    <div class="astm-card skeleton">
      <div class="skeleton-title"></div>
      <div class="skeleton-text"></div>
      <div class="skeleton-text short"></div>
    </div>
  `).join('');
}
function renderCards(cards, container) {
  if (!container) return;

  if (cards.length === 0) {
    container.innerHTML = `
      <div class="no-results">
        <p>${i18n.t('catalog.noResults')}</p>
      </div>
    `;
    return;
  }

  container.innerHTML = cards.map(card => {
    const title = i18n.localize(card.title, 'Без названия');
    const description = i18n.localize(card.description, '');
    const categoryName = card.category ? i18n.localize(card.category.name, '') : '';

    return `
      <div class="astm-card" data-card-id="${card.id}">
        <h3 class="astm-title">${title}</h3>
        <p class="astm-description">${description}</p>
        <div class="astm-divider"></div>
        <div class="astm-bottom">
          <div class="astm-meta">
            ${categoryName ? `<span class="astm-category">${categoryName}</span>` : ''}
          </div>
          <div class="astm-divider-vertical"></div>
          <a href="card.html?id=${card.id}" class="astm-button">
            <svg viewBox="0 0 24 24">
              <path d="M9 18l6-6-6-6"/>
            </svg>
          </a>
        </div>
      </div>
    `;
  }).join('');
}
function renderCategories(categories, container) {
  if (!container) return;

  container.innerHTML = categories.map(cat => {
    const name = i18n.localize(cat.name, cat.slug);
    return `
      <a href="catalog.html?category=${cat.id}" class="category-card">
        <span class="category-icon">${cat.icon || '📁'}</span>
        <span class="category-name">${name}</span>
      </a>
    `;
  }).join('');
}
function initBurgerMenu() {
  const burger = document.getElementById('burger');
  const menu = document.getElementById('menu');

  if (!burger || !menu) return;

  const toggleMenu = () => {
    burger.classList.toggle('active');
    menu.classList.toggle('active');
  };

  burger.addEventListener('click', toggleMenu);
  burger.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggleMenu();
    }
  });

  menu.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      burger.classList.remove('active');
      menu.classList.remove('active');
    });
  });
}

function initInstallBanner() {
  let deferredPrompt;
  const installBanner = document.getElementById('installBanner');
  const installBtn = document.getElementById('installBtn');
  const dismissBtn = document.getElementById('dismissBtn');

  if (!installBanner) return;

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    installBanner.classList.add('show');
  });

  if (installBtn) {
    installBtn.addEventListener('click', () => {
      installBanner.classList.remove('show');
      if (deferredPrompt) {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then(() => {
          deferredPrompt = null;
        });
      }
    });
  }

  if (dismissBtn) {
    dismissBtn.addEventListener('click', () => {
      installBanner.classList.remove('show');
    });
  }
}

function initServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js')
      .then(() => console.log('SW registered'))
      .catch((err) => console.log('SW error:', err));
  }
}
async function initHomePage() {
  const cardsContainer = document.getElementById('cards-container');
  const categoriesContainer = document.getElementById('categories-container');

  if (cardsContainer) {
    showSkeletons(cardsContainer, 6);
  }

  try {
    if (categoriesContainer) {
      const categories = await DB.getCategories();
      renderCategories(categories, categoriesContainer);
    }
    if (cardsContainer) {
      const cards = await DB.getPopularCards(6);
      renderCards(cards, cardsContainer);
    }
  } catch (error) {
    console.error('Error loading data:', error);
    if (cardsContainer) {
      cardsContainer.innerHTML = `<p class="error">${i18n.t('common.error')}</p>`;
    }
  }
}

async function initCatalogPage() {
  const cardsContainer = document.getElementById('cards-container');
  const searchInput = document.getElementById('search-input');
  const resultsCount = document.getElementById('results-count');
  const categoryFilters = document.getElementById('category-filters');

  let allCards = [];
  let allCategories = [];
  let currentFilters = {
    search: '',
    categoryId: null
  };

  const params = new URLSearchParams(window.location.search);
  currentFilters.categoryId = params.get('category');
  currentFilters.search = params.get('q') || '';

  if (searchInput && currentFilters.search) {
    searchInput.value = currentFilters.search;
  }
  showSkeletons(cardsContainer, 6);

  try {
    [allCards, allCategories] = await Promise.all([
      DB.getCards(),
      DB.getCategories()
    ]);
    if (categoryFilters) {
      categoryFilters.innerHTML = allCategories.map(cat => `
        <label class="filter-checkbox">
          <input type="checkbox" value="${cat.id}" ${currentFilters.categoryId === cat.id ? 'checked' : ''}>
          <span class="checkbox-box"></span>
          <span class="checkbox-label">${i18n.localize(cat.name, cat.slug)}</span>
        </label>
      `).join('');

      categoryFilters.querySelectorAll('input').forEach(cb => {
        cb.addEventListener('change', () => {
          const checked = categoryFilters.querySelectorAll('input:checked');
          currentFilters.categoryId = checked.length === 1 ? checked[0].value : null;
          filterAndRender();
        });
      });
    }

    if (searchInput) {
      const handleSearch = debounce((value) => {
        currentFilters.search = value;
        filterAndRender();
      }, 300);

      searchInput.addEventListener('input', (e) => {
        handleSearch(e.target.value);
      });
    }

    filterAndRender();

  } catch (error) {
    console.error('Error loading catalog:', error);
    cardsContainer.innerHTML = `<p class="error">${i18n.t('common.error')}</p>`;
  }

  function filterAndRender() {
    let filtered = [...allCards];

    if (currentFilters.search) {
      const q = currentFilters.search.toLowerCase();
      filtered = filtered.filter(card => {
        const title = i18n.localize(card.title, '').toLowerCase();
        const desc = i18n.localize(card.description, '').toLowerCase();
        return title.includes(q) || desc.includes(q);
      });
    }

    if (currentFilters.categoryId) {
      filtered = filtered.filter(card => card.category_id === currentFilters.categoryId);
    }

    if (resultsCount) {
      resultsCount.textContent = filtered.length > 0 
        ? i18n.t('catalog.found', { count: filtered.length })
        : '';
    }

    renderCards(filtered, cardsContainer);
  }
}

async function initCardPage() {
  const params = new URLSearchParams(window.location.search);
  const cardId = params.get('id');

  if (!cardId) {
    window.location.href = 'index.html';
    return;
  }

  const titleEl = document.getElementById('card-title');
  const descriptionEl = document.getElementById('card-description');
  const categoryEl = document.getElementById('card-category');
  const viewsEl = document.getElementById('card-views');
  const contentEl = document.getElementById('card-content');
  const downloadBtn = document.getElementById('download-btn');

  try {
    const card = await DB.getCardById(cardId);

    if (!card) {
      window.location.href = 'index.html';
      return;
    }

    const title = i18n.localize(card.title, '');
    const description = i18n.localize(card.description, '');
    const content = i18n.localize(card.content, { sections: [] });
    const categoryName = card.category ? i18n.localize(card.category.name, '') : '';
    const pdfUrl = i18n.localize(card.pdf_urls, null);

    document.title = `${title} — KAZARBUILD`;
    
    if (titleEl) titleEl.textContent = title;
    if (descriptionEl) descriptionEl.textContent = description;
    if (categoryEl) categoryEl.textContent = categoryName;
    if (viewsEl) viewsEl.textContent = card.views_count || 0;

    if (contentEl && content.sections && content.sections.length > 0) {
      contentEl.innerHTML = content.sections.map(section => `
        <section class="content-section">
          <h3>${section.title}</h3>
          <div class="section-content">${section.content}</div>
        </section>
      `).join('');
    }

    if (downloadBtn) {
      if (pdfUrl) {
        downloadBtn.href = pdfUrl;
        downloadBtn.style.display = 'inline-flex';
      } else {
        downloadBtn.style.display = 'none';
      }
    }

    DB.incrementViews(cardId);

  } catch (error) {
    console.error('Error loading card:', error);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  i18n.init();
  i18n.initLanguageSwitcher();
  
  initBurgerMenu();
  initInstallBanner();
  initServiceWorker();
  initOfflineIndicator();
  const page = document.body.dataset.page;
  
  switch (page) {
    case 'home':
      initHomePage();
      break;
    case 'catalog':
      initCatalogPage();
      break;
    case 'card':
      initCardPage();
      break;
  }

  document.addEventListener('localeChanged', () => {
    switch (page) {
      case 'home':
        initHomePage();
        break;
      case 'catalog':
        initCatalogPage();
        break;
      case 'card':
        initCardPage();
        break;
    }
  });
});

// ============ OFFLINE ============

function initOfflineIndicator() {
  const indicator = document.createElement('div');
  indicator.className = 'offline-indicator';
  indicator.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <line x1="1" y1="1" x2="23" y2="23"></line>
      <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"></path>
      <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"></path>
      <path d="M10.71 5.05A16 16 0 0 1 22.58 9"></path>
      <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"></path>
      <path d="M8.53 16.11a6 6 0 0 1 6.95 0"></path>
      <line x1="12" y1="20" x2="12.01" y2="20"></line>
    </svg>
    <span>${i18n.t('Offline')}</span>
  `;
  document.body.appendChild(indicator);

  function updateStatus() {
    indicator.classList.toggle('show', !navigator.onLine);
  }

  window.addEventListener('online', updateStatus);
  window.addEventListener('offline', updateStatus);
  updateStatus();
}