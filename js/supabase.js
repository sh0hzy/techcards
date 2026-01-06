const DB = {
  // Базовый fetch запрос
  async request(endpoint, options = {}) {
    const url = `${CONFIG.SUPABASE_URL}/rest/v1/${endpoint}`;
    
    const headers = {
      'apikey': CONFIG.SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${CONFIG.SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers: { ...headers, ...options.headers }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Supabase error:', error);
      throw error;
    }
  },

  // ============ CATEGORIES ============
  
  async getCategories() {
    return this.request('categories?order=sort_order.asc');
  },

  async getCategoryBySlug(slug) {
    const data = await this.request(`categories?slug=eq.${slug}`);
    return data[0] || null;
  },

  // ============ TAGS ============
  
  async getTags() {
    return this.request('tags?order=name.asc');
  },

  // ============ CARDS ============
  
  // Получить все опубликованные карточки
  async getCards(options = {}) {
    let query = 'cards?is_published=eq.true';
    
    // Выборка с категорией
    query += '&select=*,category:categories(*)';
    
    // Сортировка
    if (options.orderBy) {
      query += `&order=${options.orderBy}`;
    } else {
      query += '&order=created_at.desc';
    }
    
    // Лимит
    if (options.limit) {
      query += `&limit=${options.limit}`;
    }
    
    // Фильтр по категории
    if (options.categoryId) {
      query += `&category_id=eq.${options.categoryId}`;
    }

    return this.request(query);
  },

  // Получить популярные карточки
  async getPopularCards(limit = 6) {
    return this.getCards({ 
      orderBy: 'views_count.desc', 
      limit 
    });
  },

  // Получить карточку по ID
  async getCardById(id) {
    const data = await this.request(
      `cards?id=eq.${id}&select=*,category:categories(*)`
    );
    return data[0] || null;
  },

  // Получить карточку по slug
  async getCardBySlug(slug) {
    const data = await this.request(
      `cards?slug=eq.${slug}&select=*,category:categories(*)`
    );
    return data[0] || null;
  },

  // Поиск карточек
  async searchCards(query, locale = 'ru') {
    // Поиск по JSON полю title
    const cards = await this.getCards();
    
    if (!query) return cards;
    
    const q = query.toLowerCase();
    return cards.filter(card => {
      const title = i18n.localize(card.title, '').toLowerCase();
      const description = i18n.localize(card.description, '').toLowerCase();
      return title.includes(q) || description.includes(q);
    });
  },

  // Увеличить счётчик просмотров
  async incrementViews(cardId) {
    try {
      // Получаем текущее значение
      const card = await this.getCardById(cardId);
      if (!card) return;

      // Обновляем
      await this.request(`cards?id=eq.${cardId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          views_count: (card.views_count || 0) + 1
        })
      });

      // Записываем в статистику
      await this.request('card_views', {
        method: 'POST',
        body: JSON.stringify({
          card_id: cardId,
          locale: i18n.getLocale()
        })
      });
    } catch (e) {
      console.error('Error incrementing views:', e);
    }
  },

  // ============ ADMIN (для будущего) ============
  
  async createCard(data) {
    return this.request('cards', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async updateCard(id, data) {
    return this.request(`cards?id=eq.${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    });
  },

  async deleteCard(id) {
    return this.request(`cards?id=eq.${id}`, {
      method: 'DELETE'
    });
  },

  // ============ STORAGE ============
  
  getPublicUrl(bucket, path) {
    return `${CONFIG.SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
  },

  async uploadFile(bucket, path, file) {
    const url = `${CONFIG.SUPABASE_URL}/storage/v1/object/${bucket}/${path}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'apikey': CONFIG.SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${CONFIG.SUPABASE_ANON_KEY}`
      },
      body: file
    });

    if (!response.ok) {
      throw new Error('Upload failed');
    }

    return this.getPublicUrl(bucket, path);
  }
};
