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
  let sectionsData = [];

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
      checklistReset: document.getElementById('checklist-reset'),
      // Section page elements
      sectionPage: document.getElementById('section-page'),
      sectionPageTitle: document.getElementById('section-page-title'),
      sectionPageContent: document.getElementById('section-page-content'),
      sectionPageBack: document.getElementById('section-page-back')
    };

    loadCard();

    if (elements.checklistBtn) {
      elements.checklistBtn.addEventListener('click', toggleChecklist);
    }

    if (elements.checklistReset) {
      elements.checklistReset.addEventListener('click', resetChecklist);
    }

    // Кнопка назад на странице секции
    if (elements.sectionPageBack) {
      elements.sectionPageBack.addEventListener('click', closeSectionPage);
    }

    document.addEventListener('localeChanged', function() {
      if (cardData) {
        renderCard(cardData);
      }
    });

    // Закрытие по Escape
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        closeSectionPage();
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
      const previewText = getPreviewText(sectionContent);

      html += '<button class="card-section-btn" data-section-index="' + index + '">';
      html += '<div class="card-section-btn-content">';
      html += '<div class="card-section-btn-title">' + escapeHtml(sectionTitle) + '</div>';
      if (previewText) {
        html += '<div class="card-section-btn-preview">' + escapeHtml(previewText) + '</div>';
      }
      html += '</div>';
      html += '<div class="card-section-btn-divider"></div>';
      html += '<div class="card-section-btn-bottom">';
      html += '<div class="card-section-btn-meta">';
      html += '<span class="card-section-btn-category">Раздел ' + (index + 1) + '</span>';
      html += '</div>';
      html += '<div class="card-section-btn-divider-vertical"></div>';
      html += '<div class="card-section-btn-arrow">';
      html += '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">';
      html += '<path d="M5 12h14M12 5l7 7-7 7"/>';
      html += '</svg>';
      html += '</div>';
      html += '</div>';
      html += '</button>';
    });

    elements.sections.innerHTML = html;

    elements.sections.querySelectorAll('.card-section-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var index = parseInt(this.dataset.sectionIndex);
        openSectionPage(index);
      });
    });
  }

  function getPreviewText(html) {
    if (!html) return '';
    var temp = document.createElement('div');
    temp.innerHTML = html;
    var text = temp.textContent || temp.innerText || '';
    text = text.replace(/\s+/g, ' ').trim();
    return text.length > 80 ? text.substring(0, 80) + '...' : text;
  }

  // === Открытие секции ===
  function openSectionPage(index) {
    var section = sectionsData[index];
    if (!section) return;

    if (!elements.sectionPage || !elements.sectionPageTitle || !elements.sectionPageContent) {
      console.error('Section page elements not found');
      return;
    }

    elements.sectionPageTitle.textContent = section.title || 'Секция ' + (index + 1);

    var contentHtml = '';

    if (section.content) {
      contentHtml += '<div class="card-block-content">' + processContent(sanitizeHtml(section.content)) + '</div>';
    }

    var sectionImages = section.images || [];
    if (sectionImages.length > 0) {
      contentHtml += '<div class="card-block-images">';
      sectionImages.forEach(function(imgUrl) {
        contentHtml += '<img src="' + escapeAttr(imgUrl) + '" alt="" class="card-block-image" loading="lazy">';
      });
      contentHtml += '</div>';
    }

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

    elements.sectionPageContent.innerHTML = contentHtml;

    initContentCarousels(elements.sectionPageContent);

    elements.sectionPageContent.querySelectorAll('.nested-section-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var parentIdx = parseInt(this.dataset.parentIndex);
        var nestedIdx = parseInt(this.dataset.nestedIndex);
        openNestedSection(parentIdx, nestedIdx);
      });
    });

    elements.sectionPage.classList.add('open');
    document.body.style.overflow = 'hidden';

    var pageBody = elements.sectionPage.querySelector('.section-page-body');
    if (pageBody) pageBody.scrollTop = 0;
  }

  function openNestedSection(parentIndex, nestedIndex) {
    var parentSection = sectionsData[parentIndex];
    if (!parentSection || !parentSection.nestedSections) return;

    var nested = parentSection.nestedSections[nestedIndex];
    if (!nested) return;

    elements.sectionPageTitle.textContent = nested.title || 'Подраздел ' + (nestedIndex + 1);

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

    contentHtml += '<button class="back-to-parent-btn" data-parent-index="' + parentIndex + '">';
    contentHtml += '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">';
    contentHtml += '<path d="M19 12H5M12 19l-7-7 7-7"/>';
    contentHtml += '</svg>';
    contentHtml += '<span>Назад</span>';
    contentHtml += '</button>';

    elements.sectionPageContent.innerHTML = contentHtml;
    initContentCarousels(elements.sectionPageContent);

    var backBtn = elements.sectionPageContent.querySelector('.back-to-parent-btn');
    if (backBtn) {
      backBtn.addEventListener('click', function() {
        openSectionPage(parseInt(this.dataset.parentIndex));
      });
    }

    var pageBody = elements.sectionPage.querySelector('.section-page-body');
    if (pageBody) pageBody.scrollTop = 0;
  }

  function closeSectionPage() {
    if (elements.sectionPage) {
      elements.sectionPage.classList.remove('open');
      document.body.style.overflow = '';
    }
  }

  // === Обработка контента ===
  function processContent(html) {
    if (!html) return '';

    var temp = document.createElement('div');
    temp.innerHTML = html;

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

      var startX = 0;
      carousel.addEventListener('touchstart', function(e) {
        startX = e.touches[0].clientX;
      });

      carousel.addEventListener('touchend', function(e) {
        var endX = e.changedTouches[0].clientX;
        var diff = startX - endX;
        if (Math.abs(diff) > 50) {
          goToSlide(diff > 0 ? currentIndex + 1 : currentIndex - 1);
        }
      });
    });
  }

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
          if (attr.name === 'href' || attr.name === 'src') {
            const val = attr.value.toLowerCase().trim();
            if (val.startsWith('javascript:') || val.startsWith('data:text')) {
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
      if (elements.checklistBtn) elements.checklistBtn.style.display = 'none';
      if (elements.checklistPanel) elements.checklistPanel.style.display = 'none';
      return;
    }

    if (elements.checklistBtn) elements.checklistBtn.style.display = 'flex';

    let html = '';

    items.forEach(function(item, index) {
      const storageKey = 'checklist_' + cardId + '_' + index;
      const isChecked = localStorage.getItem(storageKey) === 'true';

      html += '<li class="card-checklist-item ' + (isChecked ? 'checked' : '') + '">';
      html += '<label>';
      html += '<input type="checkbox" data-index="' + index + '" ' + (isChecked ? 'checked' : '') + '>';
      html += '<span class="card-checkbox"></span>';
      html += '<span class="card-checkbox-text">' + escapeHtml(item) + '</span>';
      html += '</label>';
      html += '</li>';
    });

    if (elements.checklistItems) {
      elements.checklistItems.innerHTML = html;

      elements.checklistItems.querySelectorAll('input[type="checkbox"]').forEach(function(checkbox) {
        checkbox.addEventListener('change', function() {
          const index = this.getAttribute('data-index');
          localStorage.setItem('checklist_' + cardId + '_' + index, this.checked);
          this.closest('li').classList.toggle('checked', this.checked);
          updateChecklistCounter(items.length);
        });
      });

      updateChecklistCounter(items.length);
    }
  }

  function updateChecklistCounter(total) {
    if (!elements.checklistItems || !elements.checklistBtnText) return;
    const checked = elements.checklistItems.querySelectorAll('input:checked').length;
    elements.checklistBtnText.textContent = 'Чек-лист (' + checked + '/' + total + ')';
  }

  function toggleChecklist() {
    if (elements.checklistPanel) elements.checklistPanel.classList.toggle('open');
    if (elements.checklistBtn) elements.checklistBtn.classList.toggle('open');
  }

  function resetChecklist() {
    if (!elements.checklistItems) return;

    elements.checklistItems.querySelectorAll('input[type="checkbox"]').forEach(function(checkbox) {
      checkbox.checked = false;
      localStorage.removeItem('checklist_' + cardId + '_' + checkbox.getAttribute('data-index'));
      checkbox.closest('li').classList.remove('checked');
    });

    updateChecklistCounter(elements.checklistItems.querySelectorAll('input').length);
  }

  // Глобальные функции
  window.openSectionPage = openSectionPage;
  window.closeSectionPage = closeSectionPage;

})();