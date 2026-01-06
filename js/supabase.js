// js/supabase.js

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

      const data = await response.json();
      
      // Сохраняем в localStorage как резервную копию
      this.saveToLocalStorage(endpoint, data);
      
      return data;
    } catch (error) {
      console.warn('[DB] Request failed:', error.message);
      
      // Пробуем получить из localStorage
      const cached = this.getFromLocalStorage(endpoint);
      if (cached) {
        console.log('[DB] Using localStorage cache for:', endpoint);
        return cached;
      }
      
      // Возвращаем пустой массив вместо ошибки
      console.log('[DB] No cache, returning empty array');
      return [];
    }
  },

  // Сохранение в localStorage
  saveToLocalStorage(key, data) {
    try {
      const cacheKey = `db_${key.replace(/[?&=]/g, '_')}`;
      localStorage.setItem(cacheKey, JSON.stringify({
        data,
        timestamp: Date.now()
      }));
    } catch (e) {
      // localStorage может быть переполнен
      console.warn('[DB] localStorage save failed:', e.message);
    }
  },

  // Получение из localStorage
  getFromLocalStorage(key) {
    try {
      const cacheKey = `db_${key.replace(/[?&=]/g, '_')}`;
      const cached = localStorage.getItem(cacheKey);
      
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        // Кэш валиден 7 дней для офлайн
        const maxAge = 7 * 24 * 60 * 60 * 1000;
        if (Date.now() - timestamp < maxAge) {
          return data;
        }
      }
    } catch (e) {
      console.warn('[DB] localStorage read failed:', e.message);
    }
    return null;
  },

  // ============ CATEGORIES ============
  
  async getCategories() {
    return this.request('categories?order=sort_order.asc');
  },

  // ============ TAGS ============
  
  async getTags() {
    return this.request('tags?order=name.asc');
  },

  // ============ CARDS ============
  
  async getCards(options = {}) {
    let query = 'cards?is_published=eq.true';
    query += '&select=*,category:categories(*)';
    
    if (options.orderBy) {
      query += `&order=${options.orderBy}`;
    } else {
      query += '&order=created_at.desc';
    }
    
    if (options.limit) {
      query += `&limit=${options.limit}`;
    }
    
    if (options.categoryId) {
      query += `&category_id=eq.${options.categoryId}`;
    }

    return this.request(query);
  },

  async getPopularCards(limit = 6) {
    return this.getCards({ 
      orderBy: 'views_count.desc', 
      limit 
    });
  },

  async getCardById(id) {
    const data = await this.request(
      `cards?id=eq.${id}&select=*,category:categories(*)`
    );
    return data[0] || null;
  },

  // Увеличить счётчик просмотров (только онлайн)
  async incrementViews(cardId) {
    if (!navigator.onLine) {
      console.log('[DB] Offline, skipping view increment');
      return;
    }
    
    try {
      const card = await this.getCardById(cardId);
      if (!card) return;

      await this.request(`cards?id=eq.${cardId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          views_count: (card.views_count || 0) + 1
        })
      });
    } catch (e) {
      // Игнорируем ошибки счётчика
    }
  }
};

// Предзагрузка данных при первом запуске
(function prefetchData() {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', doFetch);
  } else {
    setTimeout(doFetch, 1000);
  }
  
  async function doFetch() {
    if (!navigator.onLine) return;
    
    console.log('[Prefetch] Loading data for offline...');
    try {
      await Promise.all([
        DB.getCategories(),
        DB.getCards()
      ]);
      console.log('[Prefetch] Done');
    } catch (e) {
      console.warn('[Prefetch] Failed:', e.message);
    }
  }
})();