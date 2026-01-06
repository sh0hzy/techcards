
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

// Показать skeleton загрузку
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

// ============ РЕНДЕР КАРТОЧЕК ============

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
          <a href="1/learn.html" class="astm-button">
            <svg viewBox="0 0 24 24">
              <path d="M9 18l6-6-6-6"/>
            </svg>
          </a>
        </div>
      </div>
    `;
  }).join('');
}

// Рендер категорий
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

// ============ BURGER MENU ============

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

  // Закрыть меню при клике на ссылку
  menu.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      burger.classList.remove('active');
      menu.classList.remove('active');
    });
  });
}

// ============ PWA INSTALL BANNER ============

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

// ============ SERVICE WORKER ============

function initServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js')
      .then(() => console.log('SW registered'))
      .catch((err) => console.log('SW error:', err));
  }
}

// ============ ИНИЦИАЛИЗАЦИЯ СТРАНИЦ ============

// Главная страница
async function initHomePage() {
  const cardsContainer = document.getElementById('cards-container');
  const categoriesContainer = document.getElementById('categories-container');

  // Показываем skeleton
  if (cardsContainer) {
    showSkeletons(cardsContainer, 6);
  }

  try {
    // Загружаем категории
    if (categoriesContainer) {
      const categories = await DB.getCategories();
      renderCategories(categories, categoriesContainer);
    }

    // Загружаем популярные карточки
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

// Страница каталога
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

  // Получаем параметры из URL
  const params = new URLSearchParams(window.location.search);
  currentFilters.categoryId = params.get('category');
  currentFilters.search = params.get('q') || '';

  if (searchInput && currentFilters.search) {
    searchInput.value = currentFilters.search;
  }

  // Показываем skeleton
  showSkeletons(cardsContainer, 6);

  try {
    // Загружаем данные
    [allCards, allCategories] = await Promise.all([
      DB.getCards(),
      DB.getCategories()
    ]);

    // Рендерим фильтры категорий
    if (categoryFilters) {
      categoryFilters.innerHTML = allCategories.map(cat => `
        <label class="filter-checkbox">
          <input type="checkbox" value="${cat.id}" ${currentFilters.categoryId === cat.id ? 'checked' : ''}>
          <span class="checkbox-box"></span>
          <span class="checkbox-label">${i18n.localize(cat.name, cat.slug)}</span>
        </label>
      `).join('');

      // Слушаем изменения
      categoryFilters.querySelectorAll('input').forEach(cb => {
        cb.addEventListener('change', () => {
          const checked = categoryFilters.querySelectorAll('input:checked');
          currentFilters.categoryId = checked.length === 1 ? checked[0].value : null;
          filterAndRender();
        });
      });
    }

    // Поиск с debounce
    if (searchInput) {
      const handleSearch = debounce((value) => {
        currentFilters.search = value;
        filterAndRender();
      }, 300);

      searchInput.addEventListener('input', (e) => {
        handleSearch(e.target.value);
      });
    }

    // Первоначальный рендер
    filterAndRender();

  } catch (error) {
    console.error('Error loading catalog:', error);
    cardsContainer.innerHTML = `<p class="error">${i18n.t('common.error')}</p>`;
  }

  // Функция фильтрации и рендера
  function filterAndRender() {
    let filtered = [...allCards];

    // Фильтр по поиску
    if (currentFilters.search) {
      const q = currentFilters.search.toLowerCase();
      filtered = filtered.filter(card => {
        const title = i18n.localize(card.title, '').toLowerCase();
        const desc = i18n.localize(card.description, '').toLowerCase();
        return title.includes(q) || desc.includes(q);
      });
    }

    // Фильтр по категории
    if (currentFilters.categoryId) {
      filtered = filtered.filter(card => card.category_id === currentFilters.categoryId);
    }

    // Обновляем счётчик
    if (resultsCount) {
      resultsCount.textContent = filtered.length > 0 
        ? i18n.t('catalog.found', { count: filtered.length })
        : '';
    }

    // Рендерим
    renderCards(filtered, cardsContainer);
  }
}

// Страница карточки
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

    // Заполняем данные
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

    // Рендерим секции контента
    if (contentEl && content.sections && content.sections.length > 0) {
      contentEl.innerHTML = content.sections.map(section => `
        <section class="content-section">
          <h3>${section.title}</h3>
          <div class="section-content">${section.content}</div>
        </section>
      `).join('');
    }

    // PDF кнопка
    if (downloadBtn) {
      if (pdfUrl) {
        downloadBtn.href = pdfUrl;
        downloadBtn.style.display = 'inline-flex';
      } else {
        downloadBtn.style.display = 'none';
      }
    }

    // Увеличиваем счётчик просмотров
    DB.incrementViews(cardId);

  } catch (error) {
    console.error('Error loading card:', error);
  }
}

// ============ ГЛОБАЛЬНАЯ ИНИЦИАЛИЗАЦИЯ ============

document.addEventListener('DOMContentLoaded', () => {
  i18n.init();
  i18n.initLanguageSwitcher();
  
  initBurgerMenu();
  initInstallBanner();
  initServiceWorker();
  initOfflineIndicator(); // <-- добавь эту строку

  // Определяем текущую страницу и инициализируем
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

  // Обновляем при смене языка
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

// ============ ОФЛАЙН ИНДИКАТОР ============

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
    <span>${i18n.t('common.offline')}</span>
  `;
  document.body.appendChild(indicator);

  function updateStatus() {
    indicator.classList.toggle('show', !navigator.onLine);
  }

  window.addEventListener('online', updateStatus);
  window.addEventListener('offline', updateStatus);
  updateStatus();
}