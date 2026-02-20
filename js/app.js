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

function renderCards(cards, container, searchQuery) {
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

    const displayTitle = searchQuery ? highlightText(title, searchQuery) : escapeHtml(title);
    const displayDesc = searchQuery ? highlightText(truncateText(description, 100), searchQuery) : escapeHtml(truncateText(description, 100));

    return `
      <div class="astm-card" data-card-id="${card.id}">
        <h3 class="astm-title">${displayTitle}</h3>
        <p class="astm-description">${displayDesc}</p>
        <div class="astm-divider"></div>
        <div class="astm-bottom">
          <div class="astm-meta">
            ${categoryName ? `<span class="astm-category">${escapeHtml(categoryName)}</span>` : ''}
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

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function truncateText(text, length) {
  if (!text) return '';
  if (text.length <= length) return text;
  return text.substring(0, length) + '...';
}

function highlightText(text, query) {
  if (!query || !text) return escapeHtml(text);
  const escaped = escapeHtml(text);
  const words = query.split(/\s+/);
  let result = escaped;
  words.forEach(word => {
    if (word.length > 0) {
      const regex = new RegExp('(' + word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
      result = result.replace(regex, '<mark>$1</mark>');
    }
  });
  return result;
}

function getLocalText(obj, lang) {
  if (!obj) return '';
  if (typeof obj === 'string') return obj;
  return obj[lang] || obj['ru'] || obj['en'] || '';
}

// ============ HOME PAGE ============

let _homeAllCards = [];
let _homeSearchBound = false;

async function initHomePage() {
  const cardsContainer = document.getElementById('cards-container');
  const searchInput = document.getElementById('search-input');
  const searchClear = document.getElementById('search-clear');
  const searchResults = document.getElementById('search-results');

  if (cardsContainer) {
    showSkeletons(cardsContainer, 6);
  }

  try {
    _homeAllCards = await DB.getCards();
    renderHome();
  } catch (error) {
    console.error('Error loading data:', error);
    if (cardsContainer) {
      cardsContainer.innerHTML = `<p class="error">${i18n.t('common.error')}</p>`;
    }
    return;
  }

  if (!_homeSearchBound) {
    _homeSearchBound = true;

    if (searchInput) {
      searchInput.addEventListener('input', debounce(function() {
        if (searchClear) {
          searchClear.style.display = searchInput.value.trim() ? 'flex' : 'none';
        }
        renderHome();
      }, 300));

      searchInput.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
          searchInput.value = '';
          if (searchClear) searchClear.style.display = 'none';
          renderHome();
          searchInput.focus();
        }
        if (e.key === 'Enter') {
          renderHome();
        }
      });
    }

    if (searchClear) {
      searchClear.addEventListener('click', function() {
        if (searchInput) searchInput.value = '';
        searchClear.style.display = 'none';
        renderHome();
        if (searchInput) searchInput.focus();
      });
    }
  }

  function renderHome() {
    if (!cardsContainer) return;

    const query = (searchInput ? searchInput.value : '').trim().toLowerCase();
    const lang = i18n.getLocale();
    let filtered;

    if (query) {
      filtered = _homeAllCards.filter(card => {
        const title = getLocalText(card.title, lang).toLowerCase();
        const desc = getLocalText(card.description, lang).toLowerCase();
        const catName = card.category ? getLocalText(card.category.name, lang).toLowerCase() : '';

        let contentText = '';
        const content = card.content;
        if (content && content[lang]) {
          const lc = content[lang];
          if (lc.sections) {
            lc.sections.forEach(s => {
              if (s.title) contentText += ' ' + s.title;
              if (s.content) contentText += ' ' + s.content.replace(/<[^>]*>/g, '');
            });
          }
          if (lc.checklist) {
            contentText += ' ' + lc.checklist.join(' ');
          }
        }
        contentText = contentText.toLowerCase();

        const words = query.split(/\s+/);
        return words.every(word => {
          if (!word) return true;
          return title.includes(word) || desc.includes(word) ||
                 catName.includes(word) || contentText.includes(word);
        });
      });
    } else {
      filtered = [..._homeAllCards]
        .sort((a, b) => (b.views_count || 0) - (a.views_count || 0));
    }

    if (searchResults) {
      if (query) {
        searchResults.textContent = filtered.length > 0
          ? i18n.t('catalog.found', { count: filtered.length })
          : i18n.t('catalog.noResults');
        searchResults.style.display = 'block';
      } else {
        searchResults.style.display = 'none';
      }
    }

    renderCards(filtered, cardsContainer, query);
  }
}

// ============ CATALOG PAGE ============

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

// ============ CARD PAGE ============

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

// ============ COMMON INIT ============

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

// ============ BOOTSTRAP ============

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
