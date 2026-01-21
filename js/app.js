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

(function() {
  'use strict';
  let categories = [];
  let cards = [];
  let currentCategory = 'all';
  let searchQuery = '';
  let searchTimeout = null;

  let elements = {};

  document.addEventListener('DOMContentLoaded', init);

  function init() {
    cacheElements();
    bindEvents();
    loadData();
  }

  function cacheElements() {
    elements = {
      categoriesList: document.getElementById('categories-list'),
      cardsGrid: document.getElementById('cards-grid'),
      searchInput: document.getElementById('search-input'),
      searchClear: document.getElementById('search-clear'),
      searchResults: document.getElementById('search-results')
    };
  }

  function bindEvents() {
    if (elements.searchInput) {
      elements.searchInput.addEventListener('input', handleSearchInput);
      elements.searchInput.addEventListener('keydown', handleSearchKeydown);
    }

    if (elements.searchClear) {
      elements.searchClear.addEventListener('click', clearSearch);
    }

    document.addEventListener('localeChanged', function() {
      renderCategories();
      renderFilteredCards();
    });
  }

  function handleSearchInput(e) {
    searchQuery = e.target.value.trim().toLowerCase();

    if (elements.searchClear) {
      elements.searchClear.style.display = searchQuery ? 'flex' : 'none';
    }

    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(function() {
      renderFilteredCards();
    }, 300);
  }

  function handleSearchKeydown(e) {
    if (e.key === 'Enter') {
      clearTimeout(searchTimeout);
      renderFilteredCards();
    }
    if (e.key === 'Escape') {
      clearSearch();
    }
  }

  function clearSearch() {
    searchQuery = '';
    if (elements.searchInput) {
      elements.searchInput.value = '';
    }
    if (elements.searchClear) {
      elements.searchClear.style.display = 'none';
    }
    renderFilteredCards();
    elements.searchInput?.focus();
  }

  async function loadData() {
    showLoading();

    try {

      const categoriesResponse = await fetch(
        CONFIG.SUPABASE_URL + '/rest/v1/categories?order=sort_order.asc',
        {
          headers: {
            'apikey': CONFIG.SUPABASE_ANON_KEY,
            'Authorization': 'Bearer ' + CONFIG.SUPABASE_ANON_KEY
          }
        }
      );
      categories = await categoriesResponse.json();

      const cardsResponse = await fetch(
        CONFIG.SUPABASE_URL + '/rest/v1/cards?is_published=eq.true&select=*,category:categories(*)&order=created_at.desc',
        {
          headers: {
            'apikey': CONFIG.SUPABASE_ANON_KEY,
            'Authorization': 'Bearer ' + CONFIG.SUPABASE_ANON_KEY
          }
        }
      );
      cards = await cardsResponse.json();

      console.log('Loaded cards:', cards.length);
      console.log('Loaded categories:', categories.length);

      renderCategories();
      renderFilteredCards();

    } catch (error) {
      console.error('Ошибка загрузки:', error);
      showError();
    }
  }

  function getFilteredCards() {
    const lang = localStorage.getItem('locale') || 'ru';
    let result = cards;

    if (currentCategory !== 'all') {
      result = result.filter(function(card) {
        return card.category_id === currentCategory;
      });
    }

    if (searchQuery && searchQuery.length > 0) {
      result = result.filter(function(card) {
        var title = getText(card.title, lang).toLowerCase();
        var description = getText(card.description, lang).toLowerCase();
        var categoryName = '';
        
        if (card.category && card.category.name) {
          categoryName = getText(card.category.name, lang).toLowerCase();
        }

        var contentText = '';
        var content = card.content;
        if (content && content[lang]) {
          var langContent = content[lang];
          if (langContent.sections && langContent.sections.length > 0) {
            langContent.sections.forEach(function(section) {
              if (section.title) {
                contentText += ' ' + section.title;
              }
              if (section.content) {
                contentText += ' ' + section.content.replace(/<[^>]*>/g, '');
              }
            });
          }
          if (langContent.checklist && langContent.checklist.length > 0) {
            contentText += ' ' + langContent.checklist.join(' ');
          }
        }
        contentText = contentText.toLowerCase();

        var words = searchQuery.split(/\s+/);
        
        return words.every(function(word) {
          if (word.length === 0) return true;
          return title.indexOf(word) !== -1 || 
                 description.indexOf(word) !== -1 || 
                 categoryName.indexOf(word) !== -1 ||
                 contentText.indexOf(word) !== -1;
        });
      });
    }

    return result;
  }

  function getText(obj, lang) {
    if (!obj) return '';
    if (typeof obj === 'string') return obj;
    return obj[lang] || obj['ru'] || obj['en'] || '';
  }

  function renderCategories() {
    if (!elements.categoriesList) return;

    var lang = localStorage.getItem('locale') || 'ru';
    var html = '';

    html += '<button class="category-btn ' + (currentCategory === 'all' ? 'active' : '') + '" data-id="all">';
    html += '<span class="category-icon">📋</span>';
    html += '<span class="category-name">' + getAllText(lang) + '</span>';
    html += '<span class="category-count">' + cards.length + '</span>';
    html += '</button>';

    categories.forEach(function(cat) {
      var name = getText(cat.name, lang);
      var count = cards.filter(function(c) { return c.category_id === cat.id; }).length;
      var isActive = currentCategory === cat.id;

      html += '<button class="category-btn ' + (isActive ? 'active' : '') + '" data-id="' + cat.id + '">';
      html += '<span class="category-icon">' + (cat.icon || '📁') + '</span>';
      html += '<span class="category-name">' + escapeHtml(name) + '</span>';
      html += '<span class="category-count">' + count + '</span>';
      html += '</button>';
    });

    elements.categoriesList.innerHTML = html;

    elements.categoriesList.querySelectorAll('.category-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var id = this.getAttribute('data-id');
        currentCategory = id;

        elements.categoriesList.querySelectorAll('.category-btn').forEach(function(b) {
          b.classList.remove('active');
        });
        this.classList.add('active');

        renderFilteredCards();
      });
    });
  }

  function getAllText(lang) {
    var texts = {
      ru: 'Все',
      kk: 'Барлығы',
      uz: 'Hammasi',
      en: 'All',
      tk: 'Hemmesi'
    };
    return texts[lang] || texts.ru;
  }

  function renderFilteredCards() {
    var filtered = getFilteredCards();
    
    updateSearchResults(filtered.length);
    
    renderCards(filtered);
  }

  function renderCards(cardsToRender) {
    if (!elements.cardsGrid) return;

    var lang = localStorage.getItem('locale') || 'ru';

    if (cardsToRender.length === 0) {
      elements.cardsGrid.innerHTML = '<div class="empty-state">' +
        '<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">' +
        '<circle cx="11" cy="11" r="8"></circle>' +
        '<path d="m21 21-4.35-4.35"></path>' +
        '</svg>' +
        '<p>' + getNotFoundText(lang) + '</p>' +
        '</div>';
      return;
    }

    var html = '';

    cardsToRender.forEach(function(card) {
      var title = getText(card.title, lang) || 'Без названия';
      var description = getText(card.description, lang) || '';
      var image = card.cover_image || (card.images && card.images[0]) || '';
      var categoryName = card.category ? getText(card.category.name, lang) : '';

      var displayTitle = highlightText(title, searchQuery);
      var displayDesc = highlightText(truncateText(description, 100), searchQuery);

      html += '<a href="card.html?id=' + card.id + '" class="card-item">';
      html += '<div class="card-image"' + (image ? ' style="background-image: url(\'' + image + '\');"' : '') + '>';
      if (!image) {
        html += '<div class="card-image-placeholder"></div>';
      }
      html += '</div>';
      html += '<div class="card-content">';
      if (categoryName) {
        html += '<span class="card-category">' + escapeHtml(categoryName) + '</span>';
      }
      html += '<h3 class="card-title">' + displayTitle + '</h3>';
      if (description) {
        html += '<p class="card-description">' + displayDesc + '</p>';
      }
      html += '</div>';
      html += '</a>';
    });

    elements.cardsGrid.innerHTML = html;
  }

  function updateSearchResults(count) {
    if (!elements.searchResults) return;

    if (searchQuery && searchQuery.length > 0) {
      var lang = localStorage.getItem('locale') || 'ru';
      var text = '';
      
      if (count === 0) {
        text = getNotFoundText(lang);
      } else {
        text = getFoundText(lang, count);
      }

      elements.searchResults.textContent = text;
      elements.searchResults.style.display = 'block';
    } else {
      elements.searchResults.style.display = 'none';
    }
  }

  function getNotFoundText(lang) {
    var texts = {
      ru: 'Ничего не найдено',
      kk: 'Ештеңе табылмады',
      uz: 'Hech narsa topilmadi',
      en: 'Nothing found',
      tk: 'Hiç zat tapylmady'
    };
    return texts[lang] || texts.ru;
  }

  function getFoundText(lang, count) {
    var texts = {
      ru: 'Найдено: ' + count,
      kk: 'Табылды: ' + count,
      uz: 'Topildi: ' + count,
      en: 'Found: ' + count,
      tk: 'Tapyldy: ' + count
    };
    return texts[lang] || texts.ru;
  }

  function highlightText(text, query) {
    if (!query || !text) return escapeHtml(text);

    var escaped = escapeHtml(text);
    var words = query.split(/\s+/);

    words.forEach(function(word) {
      if (word.length > 0) {
        var regex = new RegExp('(' + escapeRegex(word) + ')', 'gi');
        escaped = escaped.replace(regex, '<mark>$1</mark>');
      }
    });

    return escaped;
  }

  function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function showLoading() {
    if (!elements.cardsGrid) return;

    elements.cardsGrid.innerHTML = 
      '<div class="skeleton-card"></div>' +
      '<div class="skeleton-card"></div>' +
      '<div class="skeleton-card"></div>' +
      '<div class="skeleton-card"></div>' +
      '<div class="skeleton-card"></div>' +
      '<div class="skeleton-card"></div>';
  }

  function showError() {
    if (!elements.cardsGrid) return;

    elements.cardsGrid.innerHTML = '<div class="empty-state">' +
      '<p>Ошибка загрузки данных</p>' +
      '<button onclick="location.reload()" style="margin-top:12px;padding:10px 20px;background:#1b98fb;color:#fff;border:none;border-radius:8px;cursor:pointer;">Повторить</button>' +
      '</div>';
  }

  function escapeHtml(text) {
    if (!text) return '';
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function truncateText(text, length) {
    if (!text) return '';
    if (text.length <= length) return text;
    return text.substring(0, length) + '...';
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