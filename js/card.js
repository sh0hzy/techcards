

(function() {
  // Получаем ID карточки из URL
  const params = new URLSearchParams(window.location.search);
  const cardId = params.get('id');

  if (!cardId) {
    window.location.href = 'index.html';
    return;
  }

  // Элементы страницы
  const heroTitle = document.getElementById('hero-title');
  const heroCategory = document.getElementById('hero-category');
  const carousel = document.getElementById('carousel');
  const cardDescription = document.getElementById('card-description');
  const contentSections = document.getElementById('content-sections');
  const checklistWrapper = document.getElementById('checklist-wrapper');
  const checklistToggle = document.getElementById('checklist-toggle');
  const checklistUl = document.getElementById('checklist');
  const checklistReset = document.getElementById('checklist-reset');
//   const viewsCount = document.getElementById('views-count');

  let currentCard = null;
  let carouselIndex = 0;
  let carouselInterval = null;

  // Загрузка карточки
  async function loadCard() {
    try {
      const card = await DB.getCardById(cardId);
      
      if (!card) {
        window.location.href = 'index.html';
        return;
      }

      currentCard = card;
      renderCard(card);
      
      // Увеличиваем просмотры
      DB.incrementViews(cardId);

    } catch (error) {
      console.error('Error loading card:', error);
      heroTitle.textContent = i18n.t('common.error');
    }
  }

  // Рендер карточки
  function renderCard(card) {
    const title = i18n.localize(card.title, 'Без названия');
    const description = i18n.localize(card.description, '');
    const content = i18n.localize(card.content, { sections: [], checklist: [] });
    const images = card.images || [];
    const categoryName = card.category ? i18n.localize(card.category.name, '') : '';

    // Заголовок страницы
    document.title = `${title} — KAZARBUILD`;

    // Hero
    heroTitle.textContent = title;
    heroCategory.textContent = categoryName;

    // Карусель изображений
    renderCarousel(images);

    // Описание
    cardDescription.textContent = description;

    // Секции контента
    renderSections(content.sections || []);

    // Чек-лист
    renderChecklist(content.checklist || []);

    // Просмотры
    viewsCount.textContent = card.views_count || 0;
  }

  // Рендер карусели
  function renderCarousel(images) {
    if (images.length === 0) {
      // Placeholder если нет изображений
      carousel.innerHTML = `
        <div class="slide" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);"></div>
      `;
      return;
    }

    carousel.innerHTML = images.map((img, idx) => `
      <div class="slide" style="background-image: url('${img}');" data-index="${idx}"></div>
    `).join('');

    // Запускаем автопрокрутку если больше 1 слайда
    if (images.length > 1) {
      startCarousel(images.length);
    }
  }

  // Автопрокрутка карусели
  function startCarousel(total) {
    if (carouselInterval) clearInterval(carouselInterval);
    
    carouselInterval = setInterval(() => {
      carouselIndex = (carouselIndex + 1) % total;
      carousel.style.transform = `translateX(-${carouselIndex * 100}%)`;
    }, 4000);
  }

  // Рендер секций контента
  function renderSections(sections) {
    if (!sections || sections.length === 0) {
      contentSections.innerHTML = '';
      return;
    }

    contentSections.innerHTML = sections.map(section => `
      <section class="card-section">
        <h3 class="section-title">${section.title || ''}</h3>
        <div class="section-content">${formatContent(section.content || '')}</div>
      </section>
    `).join('');
  }

  // Форматирование контента (поддержка списков)
  function formatContent(content) {
    // Простое преобразование переносов строк в параграфы
    // И поддержка маркированных списков (строки начинающиеся с -)
    const lines = content.split('\n');
    let html = '';
    let inList = false;

    lines.forEach(line => {
      const trimmed = line.trim();
      
      if (trimmed.startsWith('- ') || trimmed.startsWith('• ')) {
        if (!inList) {
          html += '<ul>';
          inList = true;
        }
        html += `<li>${trimmed.substring(2)}</li>`;
      } else {
        if (inList) {
          html += '</ul>';
          inList = false;
        }
        if (trimmed) {
          html += `<p>${trimmed}</p>`;
        }
      }
    });

    if (inList) html += '</ul>';
    
    return html || `<p>${content}</p>`;
  }

  // Рендер чек-листа
  function renderChecklist(items) {
    if (!items || items.length === 0) {
      checklistToggle.style.display = 'none';
      checklistWrapper.style.display = 'none';
      return;
    }

    checklistToggle.style.display = 'flex';

    checklistUl.innerHTML = items.map((item, idx) => {
      const key = `card_${cardId}_chk_${idx}`;
      const checked = localStorage.getItem(key) === 'true';
      
      return `
        <li>
          <label>
            <input type="checkbox" data-key="${key}" ${checked ? 'checked' : ''}>
            <span class="checkbox-custom"></span>
            <span class="checkbox-text">${item}</span>
          </label>
        </li>
      `;
    }).join('');

    // Обработчики чекбоксов
    checklistUl.querySelectorAll('input[type="checkbox"]').forEach(cb => {
      cb.addEventListener('change', () => {
        localStorage.setItem(cb.dataset.key, cb.checked);
        updateChecklistProgress();
      });
    });

    updateChecklistProgress();
  }

  // Прогресс чек-листа
  function updateChecklistProgress() {
    const total = checklistUl.querySelectorAll('input[type="checkbox"]').length;
    const checked = checklistUl.querySelectorAll('input[type="checkbox"]:checked').length;
    
    // Можно добавить прогресс-бар если нужно
    checklistToggle.querySelector('span').textContent = 
      `${i18n.t('card.checklist')} (${checked}/${total})`;
  }

  // Сброс чек-листа
  checklistReset?.addEventListener('click', () => {
    checklistUl.querySelectorAll('input[type="checkbox"]').forEach(cb => {
      cb.checked = false;
      localStorage.removeItem(cb.dataset.key);
    });
    updateChecklistProgress();
  });

  // Toggle чек-листа
  checklistToggle?.addEventListener('click', () => {
    checklistWrapper.classList.toggle('open');
    checklistToggle.classList.toggle('open');
  });

  // Обновление при смене языка
  document.addEventListener('localeChanged', () => {
    if (currentCard) {
      renderCard(currentCard);
    }
  });

  // Запуск
  document.addEventListener('DOMContentLoaded', loadCard);
})();
