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


  function renderSections(sections) {
    if (!elements.sections) return;

    if (!sections || sections.length === 0) {
      elements.sections.innerHTML = '';
      return;
    }

    let html = '';

    sections.forEach(function(section) {
      const sectionTitle = section.title || '';
      const sectionContent = section.content || '';
      const sectionImages = section.images || [];

      html += '<section class="card-block">';
      
      if (sectionTitle) {
        html += '<h3 class="card-block-title">' + escapeHtml(sectionTitle) + '</h3>';
      }
      
      if (sectionContent) {
        html += '<div class="card-block-content">' + sanitizeHtml(sectionContent) + '</div>';
      }
      
      if (sectionImages.length > 0) {
        html += '<div class="card-block-images">';
        sectionImages.forEach(function(imgUrl) {
          html += '<img src="' + escapeAttr(imgUrl) + '" alt="" class="card-block-image" loading="lazy">';
        });
        html += '</div>';
      }
      
      html += '</section>';
    });

    elements.sections.innerHTML = html;
  }

  function sanitizeHtml(html) {
    if (!html) return '';

    const temp = document.createElement('div');
    temp.innerHTML = html;

    const allowedTags = [
      'p', 'br', 'b', 'strong', 'i', 'em', 'u', 's', 'strike',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'ul', 'ol', 'li',
      'a', 'img',
      'blockquote', 'pre', 'code',
      'div', 'span'
    ];

    const allowedAttrs = {
      'a': ['href', 'target', 'rel'],
      'img': ['src', 'alt', 'width', 'height', 'style'],
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