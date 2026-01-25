(function() {
  'use strict';

  const urlParams = new URLSearchParams(window.location.search);
  const cardId = urlParams.get('id');

  if (!cardId) {
    window.location.href = 'index.html';
    return;
  }

  let elements = {};
  let cardData = null;
  let carouselIndex = 0;
  let carouselTimer = null;

  document.addEventListener('DOMContentLoaded', init);

  function init() {
    elements = {
      title: document.getElementById('card-title'),
      category: document.getElementById('card-category'),
      carousel: document.getElementById('card-carousel'),
      description: document.getElementById('card-description'),
      descriptionBlock: document.getElementById('description-block'),
      sections: document.getElementById('card-sections'),
      checklistBtn: document.getElementById('checklist-btn'),
      checklistBtnText: document.getElementById('checklist-btn-text'),
      checklistPanel: document.getElementById('checklist-panel'),
      checklistItems: document.getElementById('checklist-items'),
      checklistReset: document.getElementById('checklist-reset')
    };

    loadCard();

    if (elements.checklistBtn) {
      elements.checklistBtn.addEventListener('click', toggleChecklist);
    }

    if (elements.checklistReset) {
      elements.checklistReset.addEventListener('click', resetChecklist);
    }

    document.addEventListener('localeChanged', function() {
      if (cardData) {
        renderCard(cardData);
      }
    });
  }

  async function loadCard() {
    try {
      const url = `${CONFIG.SUPABASE_URL}/rest/v1/cards?id=eq.${cardId}&select=*,category:categories(*)`;
      
      const response = await fetch(url, {
        headers: {
          'apikey': CONFIG.SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${CONFIG.SUPABASE_ANON_KEY}`
        }
      });

      if (!response.ok) {
        throw new Error('Ошибка загрузки');
      }

      const result = await response.json();

      if (!result || result.length === 0) {
        window.location.href = 'index.html';
        return;
      }

      cardData = result[0];
      console.log('Card loaded:', cardData);

      renderCard(cardData);

    } catch (error) {
      console.error('Load error:', error);
      if (elements.title) {
        elements.title.textContent = 'Ошибка загрузки';
      }
    }
  }

  function renderCard(card) {
    const lang = localStorage.getItem('locale') || 'ru';

    const title = getLocalized(card.title, lang) || 'Без названия';
    if (elements.title) {
      elements.title.textContent = title;
    }
    document.title = title + ' — KAZARBUILD';

    const categoryName = card.category ? getLocalized(card.category.name, lang) : '';
    if (elements.category) {
      elements.category.textContent = categoryName;
      elements.category.style.display = categoryName ? 'inline-block' : 'none';
    }

    const description = getLocalized(card.description, lang) || '';
    if (elements.description) {
      elements.description.textContent = description;
    }
    if (elements.descriptionBlock) {
      elements.descriptionBlock.style.display = description ? 'block' : 'none';
    }

    renderCarousel(card.images || [], card.cover_image);

    const content = getLocalized(card.content, lang) || {};
    renderSections(content.sections || []);

    renderChecklist(content.checklist || []);
  }

  function getLocalized(obj, lang) {
    if (!obj) return '';
    if (typeof obj === 'string') return obj;
    return obj[lang] || obj['ru'] || obj['en'] || obj['kk'] || '';
  }

  function renderCarousel(images, coverImage) {
    if (!elements.carousel) return;

    if (carouselTimer) {
      clearInterval(carouselTimer);
      carouselTimer = null;
    }

    let slides = [];

    if (images && images.length > 0) {
      slides = images;
    } else if (coverImage) {
      slides = [coverImage];
    }

    if (slides.length > 0) {
      elements.carousel.innerHTML = slides.map(function(img) {
        return '<div class="card-slide" style="background-image: url(\'' + img + '\');"></div>';
      }).join('');

      if (slides.length > 1) {
        carouselIndex = 0;
        carouselTimer = setInterval(function() {
          carouselIndex = (carouselIndex + 1) % slides.length;
          elements.carousel.style.transform = 'translateX(-' + (carouselIndex * 100) + '%)';
        }, 4000);
      }
    } else {
      elements.carousel.innerHTML = '<div class="card-slide card-slide-placeholder"></div>';
    }
  }

  // === Хранение данных секций для модального окна ===
  let sectionsData = [];

// === Рендер секций как кнопок ===
function renderSections(sections) {
  if (!elements.sections) return;

  if (!sections || sections.length === 0) {
    elements.sections.innerHTML = '';
    sectionsData = [];
    return;
  }

  sectionsData = sections;
  let html = '';

  sections.forEach(function(section, index) {
    const sectionTitle = section.title || 'Секция ' + (index + 1);
    const sectionContent = section.content || '';

    // Получаем превью текста (убираем HTML и обрезаем)
    const previewText = getPreviewText(sectionContent);

    html += '<button class="card-section-btn" data-section-index="' + index + '">';
    
    // Контент (заголовок + превью)
    html += '<div class="card-section-btn-content">';
    html += '<div class="card-section-btn-title">' + escapeHtml(sectionTitle) + '</div>';
    if (previewText) {
      html += '<div class="card-section-btn-preview">' + escapeHtml(previewText) + '</div>';
    }
    html += '</div>';
    
    // Разделитель
    html += '<div class="card-section-btn-divider"></div>';
    
    // Нижняя часть (как в карточках index.html)
    html += '<div class="card-section-btn-bottom">';
    
    // Мета-информация
    html += '<div class="card-section-btn-meta">';
    html += '<span class="card-section-btn-category">Раздел ' + (index + 1) + '</span>';
    html += '</div>';
    
    // Вертикальный разделитель
    html += '<div class="card-section-btn-divider-vertical"></div>';
    
    // Кнопка-стрелка
    html += '<div class="card-section-btn-arrow">';
    html += '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">';
    html += '<path d="M5 12h14M12 5l7 7-7 7"/>';
    html += '</svg>';
    html += '</div>';
    
    html += '</div>'; // card-section-btn-bottom
    html += '</button>';
  });

  elements.sections.innerHTML = html;

  // Привязываем обработчики кликов
  elements.sections.querySelectorAll('.card-section-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var index = parseInt(this.dataset.sectionIndex);
      openSectionModal(index);
    });
  });
}

// === Получение превью текста ===
function getPreviewText(html) {
  if (!html) return '';
  var temp = document.createElement('div');
  temp.innerHTML = html;
  var text = temp.textContent || temp.innerText || '';
  text = text.replace(/\s+/g, ' ').trim();
  return text.length > 80 ? text.substring(0, 80) + '...' : text;
}

  // === Открытие секции в полноэкранном режиме ===
  var sectionHistory = []; // История навигации для кнопки "Назад"

  // Поддержка кнопки "Назад" браузера
  window.addEventListener('popstate', function(e) {
    if (e.state && e.state.sectionOpen) {
      // Не делаем ничего - пользователь нажал вперёд
    } else {
      closeSectionPage();
    }
  });

// === Открытие секции в модальном окне ===
function openSectionModal(index) {
  var section = sectionsData[index];
  if (!section) return;

  var modal = document.getElementById('section-modal');
  var modalTitle = document.getElementById('section-modal-title');
  var modalContent = document.getElementById('section-modal-content');
  var modalClose = document.getElementById('section-modal-close');

  if (!modal || !modalTitle || !modalContent) return;

  // Заполняем контент
  modalTitle.textContent = section.title || 'Секция ' + (index + 1);

  var contentHtml = '';

  // Основной контент
  if (section.content) {
    contentHtml += '<div class="card-block-content">' + processContent(sanitizeHtml(section.content)) + '</div>';
  }

  // Изображения секции
  var sectionImages = section.images || [];
  if (sectionImages.length > 0) {
    contentHtml += '<div class="card-block-images">';
    sectionImages.forEach(function(imgUrl) {
      contentHtml += '<img src="' + escapeAttr(imgUrl) + '" alt="" class="card-block-image" loading="lazy">';
    });
    contentHtml += '</div>';
  }

  // Вложенные секции (если есть)
  var nestedSections = section.nestedSections || [];
  if (nestedSections.length > 0) {
    nestedSections.forEach(function(nested, nestedIndex) {
      contentHtml += '<button class="nested-section-btn" data-parent-index="' + index + '" data-nested-index="' + nestedIndex + '">';
      contentHtml += '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">';
      contentHtml += '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>';
      contentHtml += '<polyline points="14 2 14 8 20 8"></polyline>';
      contentHtml += '</svg>';
      contentHtml += '<span>' + escapeHtml(nested.title || 'Подраздел ' + (nestedIndex + 1)) + '</span>';
      contentHtml += '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-left:auto;">';
      contentHtml += '<polyline points="9 18 15 12 9 6"></polyline>';
      contentHtml += '</svg>';
      contentHtml += '</button>';
    });
  }

  modalContent.innerHTML = contentHtml;

  // Инициализируем карусели в контенте
  initContentCarousels(modalContent);

  // Привязываем обработчики для вложенных секций
  modalContent.querySelectorAll('.nested-section-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var parentIdx = parseInt(this.dataset.parentIndex);
      var nestedIdx = parseInt(this.dataset.nestedIndex);
      openNestedSection(parentIdx, nestedIdx);
    });
  });

  // Открываем модальное окно
  modal.classList.add('open');
  document.body.style.overflow = 'hidden';

  // Кнопка закрытия
  if (modalClose) {
    modalClose.onclick = function() {
      closeSectionModal();
    };
  }

  // Закрытие по клику на фон
  modal.onclick = function(e) {
    if (e.target === modal) {
      closeSectionModal();
    }
  };

  // Закрытие по Escape
  document.addEventListener('keydown', handleEscapeKey);

  // Скроллим контент наверх
  var modalBody = modal.querySelector('.section-modal-body');
  if (modalBody) modalBody.scrollTop = 0;
}

function openNestedSection(parentIndex, nestedIndex) {
  var parentSection = sectionsData[parentIndex];
  if (!parentSection || !parentSection.nestedSections) return;

  var nested = parentSection.nestedSections[nestedIndex];
  if (!nested) return;

  var modalTitle = document.getElementById('section-modal-title');
  var modalContent = document.getElementById('section-modal-content');

  if (!modalTitle || !modalContent) return;

  modalTitle.textContent = nested.title || 'Подраздел ' + (nestedIndex + 1);

  var contentHtml = '';
  if (nested.content) {
    contentHtml += '<div class="card-block-content">' + processContent(sanitizeHtml(nested.content)) + '</div>';
  }

  var nestedImages = nested.images || [];
  if (nestedImages.length > 0) {
    contentHtml += '<div class="card-block-images">';
    nestedImages.forEach(function(imgUrl) {
      contentHtml += '<img src="' + escapeAttr(imgUrl) + '" alt="" class="card-block-image" loading="lazy">';
    });
    contentHtml += '</div>';
  }

  // Кнопка "Назад" к родительской секции
  contentHtml += '<button class="back-to-parent-btn" data-parent-index="' + parentIndex + '">';
  contentHtml += '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">';
  contentHtml += '<path d="M19 12H5M12 19l-7-7 7-7"/>';
  contentHtml += '</svg>';
  contentHtml += '<span>Назад</span>';
  contentHtml += '</button>';

  modalContent.innerHTML = contentHtml;
  initContentCarousels(modalContent);

  // Обработчик кнопки "Назад"
  var backBtn = modalContent.querySelector('.back-to-parent-btn');
  if (backBtn) {
    backBtn.addEventListener('click', function() {
      openSectionModal(parseInt(this.dataset.parentIndex));
    });
  }

  // Скроллим наверх
  var modal = document.getElementById('section-modal');
  var modalBody = modal.querySelector('.section-modal-body');
  if (modalBody) modalBody.scrollTop = 0;
}

function closeSectionModal() {
  var modal = document.getElementById('section-modal');
  if (modal) {
    modal.classList.remove('open');
    document.body.style.overflow = '';
  }
  document.removeEventListener('keydown', handleEscapeKey);
}

function handleEscapeKey(e) {
  if (e.key === 'Escape') {
    closeSectionModal();
  }
}

// Делаем функции глобальными
window.openSectionModal = openSectionModal;
window.closeSectionModal = closeSectionModal;

  // === Обработка контента (карусели, видео и т.д.) ===
  function processContent(html) {
    if (!html) return '';

    // Преобразуем data-carousel в интерактивные карусели
    var temp = document.createElement('div');
    temp.innerHTML = html;

    // Находим все карусели и преобразуем их
    temp.querySelectorAll('[data-carousel]').forEach(function(carousel) {
      var images = carousel.dataset.carousel.split(',');
      if (images.length > 0) {
        var carouselHtml = '<div class="content-carousel" data-images="' + images.join(',') + '">';
        carouselHtml += '<div class="content-carousel-track">';
        images.forEach(function(img) {
          carouselHtml += '<div class="content-carousel-slide"><img src="' + img.trim() + '" alt="" loading="lazy"></div>';
        });
        carouselHtml += '</div>';
        if (images.length > 1) {
          carouselHtml += '<button class="content-carousel-btn prev"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"></polyline></svg></button>';
          carouselHtml += '<button class="content-carousel-btn next"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg></button>';
          carouselHtml += '<div class="content-carousel-nav">';
          images.forEach(function(img, idx) {
            carouselHtml += '<button class="content-carousel-dot' + (idx === 0 ? ' active' : '') + '" data-index="' + idx + '"></button>';
          });
          carouselHtml += '</div>';
        }
        carouselHtml += '</div>';
        carousel.outerHTML = carouselHtml;
      }
    });

    return temp.innerHTML;
  }

  // === Инициализация каруселей в контенте ===
  function initContentCarousels(container) {
    container.querySelectorAll('.content-carousel').forEach(function(carousel) {
      var track = carousel.querySelector('.content-carousel-track');
      var dots = carousel.querySelectorAll('.content-carousel-dot');
      var prevBtn = carousel.querySelector('.content-carousel-btn.prev');
      var nextBtn = carousel.querySelector('.content-carousel-btn.next');
      var slides = carousel.querySelectorAll('.content-carousel-slide');
      var currentIndex = 0;

      function goToSlide(index) {
        if (index < 0) index = slides.length - 1;
        if (index >= slides.length) index = 0;
        currentIndex = index;
        track.style.transform = 'translateX(-' + (currentIndex * 100) + '%)';
        dots.forEach(function(dot, i) {
          dot.classList.toggle('active', i === currentIndex);
        });
      }

      if (prevBtn) {
        prevBtn.addEventListener('click', function() {
          goToSlide(currentIndex - 1);
        });
      }

      if (nextBtn) {
        nextBtn.addEventListener('click', function() {
          goToSlide(currentIndex + 1);
        });
      }

      dots.forEach(function(dot) {
        dot.addEventListener('click', function() {
          goToSlide(parseInt(this.dataset.index));
        });
      });

      // Свайп поддержка
      var startX = 0;
      var endX = 0;

      carousel.addEventListener('touchstart', function(e) {
        startX = e.touches[0].clientX;
      });

      carousel.addEventListener('touchend', function(e) {
        endX = e.changedTouches[0].clientX;
        var diff = startX - endX;
        if (Math.abs(diff) > 50) {
          if (diff > 0) {
            goToSlide(currentIndex + 1);
          } else {
            goToSlide(currentIndex - 1);
          }
        }
      });
    });
  }

  // Делаем функции глобальными
  window.openSectionModal = openSectionModal;
  window.closeSectionPage = closeSectionPage;

  function sanitizeHtml(html) {
    if (!html) return '';

    const temp = document.createElement('div');
    temp.innerHTML = html;

    const allowedTags = [
      'p', 'br', 'b', 'strong', 'i', 'em', 'u', 's', 'strike',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'ul', 'ol', 'li',
      'a', 'img', 'iframe',
      'blockquote', 'pre', 'code',
      'div', 'span', 'font',
      'table', 'thead', 'tbody', 'tr', 'th', 'td',
      'button'
    ];

    const allowedAttrs = {
      'a': ['href', 'target', 'rel'],
      'img': ['src', 'alt', 'width', 'height', 'style', 'loading'],
      'iframe': ['src', 'width', 'height', 'frameborder', 'allowfullscreen', 'allow'],
      'div': ['style', 'class', 'data-carousel', 'data-images'],
      'button': ['class', 'data-index', 'onclick'],
      'font': ['size', 'color', 'face'],
      '*': ['style', 'class']
    };

    function cleanNode(node) {
      if (node.nodeType === Node.TEXT_NODE) {
        return node.textContent;
      }

      if (node.nodeType !== Node.ELEMENT_NODE) {
        return '';
      }

      const tagName = node.tagName.toLowerCase();

      if (!allowedTags.includes(tagName)) {
        let content = '';
        node.childNodes.forEach(function(child) {
          content += cleanNode(child);
        });
        return content;
      }

      let result = '<' + tagName;

      const tagAttrs = allowedAttrs[tagName] || [];
      const globalAttrs = allowedAttrs['*'] || [];
      const allAllowedAttrs = [...tagAttrs, ...globalAttrs];

      Array.from(node.attributes).forEach(function(attr) {
        if (allAllowedAttrs.includes(attr.name)) {
          if (attr.name === 'href') {
            const href = attr.value.toLowerCase().trim();
            if (href.startsWith('javascript:') || href.startsWith('data:')) {
              return;
            }
          }

          if (attr.name === 'src') {
            const src = attr.value.toLowerCase().trim();
            if (src.startsWith('javascript:') || src.startsWith('data:text')) {
              return;
            }
          }
          result += ' ' + attr.name + '="' + escapeAttr(attr.value) + '"';
        }
      });

      result += '>';

      node.childNodes.forEach(function(child) {
        result += cleanNode(child);
      });

      const selfClosing = ['img', 'br', 'hr', 'input'];
      if (!selfClosing.includes(tagName)) {
        result += '</' + tagName + '>';
      }

      return result;
    }

    let cleaned = '';
    temp.childNodes.forEach(function(child) {
      cleaned += cleanNode(child);
    });

    return cleaned;
  }

  function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function escapeAttr(text) {
    if (!text) return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function renderChecklist(items) {
    if (!items || items.length === 0) {
      if (elements.checklistBtn) {
        elements.checklistBtn.style.display = 'none';
      }
      if (elements.checklistPanel) {
        elements.checklistPanel.style.display = 'none';
      }
      return;
    }

    if (elements.checklistBtn) {
      elements.checklistBtn.style.display = 'flex';
    }

    let html = '';

    items.forEach(function(item, index) {
      const storageKey = 'checklist_' + cardId + '_' + index;
      const isChecked = localStorage.getItem(storageKey) === 'true';
      const checkedAttr = isChecked ? 'checked' : '';
      const checkedClass = isChecked ? 'checked' : '';

      html += '<li class="card-checklist-item ' + checkedClass + '">';
      html += '<label>';
      html += '<input type="checkbox" data-index="' + index + '" ' + checkedAttr + '>';
      html += '<span class="card-checkbox"></span>';
      html += '<span class="card-checkbox-text">' + escapeHtml(item) + '</span>';
      html += '</label>';
      html += '</li>';
    });

    if (elements.checklistItems) {
      elements.checklistItems.innerHTML = html;

      const checkboxes = elements.checklistItems.querySelectorAll('input[type="checkbox"]');
      checkboxes.forEach(function(checkbox) {
        checkbox.addEventListener('change', function() {
          const index = this.getAttribute('data-index');
          const storageKey = 'checklist_' + cardId + '_' + index;
          localStorage.setItem(storageKey, this.checked);

          const li = this.closest('li');
          if (li) {
            li.classList.toggle('checked', this.checked);
          }

          updateChecklistCounter(items.length);
        });
      });

      updateChecklistCounter(items.length);
    }
  }

  function updateChecklistCounter(total) {
    if (!elements.checklistItems || !elements.checklistBtnText) return;

    const checked = elements.checklistItems.querySelectorAll('input[type="checkbox"]:checked').length;
    elements.checklistBtnText.textContent = 'Чек-лист (' + checked + '/' + total + ')';
  }

  function toggleChecklist() {
    if (elements.checklistPanel) {
      elements.checklistPanel.classList.toggle('open');
    }
    if (elements.checklistBtn) {
      elements.checklistBtn.classList.toggle('open');
    }
  }

  function resetChecklist() {
    if (!elements.checklistItems) return;

    const checkboxes = elements.checklistItems.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(function(checkbox) {
      checkbox.checked = false;
      const index = checkbox.getAttribute('data-index');
      const storageKey = 'checklist_' + cardId + '_' + index;
      localStorage.removeItem(storageKey);

      const li = checkbox.closest('li');
      if (li) {
        li.classList.remove('checked');
      }
    });

    updateChecklistCounter(checkboxes.length);
  }

})();