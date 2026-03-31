// Data store: tries localhost:8000 (dev server) first, falls back to static JSON files
window.Store = (() => {
  const SERVER = 'http://localhost:8000';

  // In-memory cache for static data (avoid re-fetching on every call)
  let _staticCategories = null;
  let _staticCards = null;

  async function apiFetch(path, options) {
    const r = await fetch(SERVER + path, options);
    if (!r.ok) throw new Error(`API ${path} -> ${r.status}`);
    return r.json();
  }

  async function staticGet(key) {
    if (key === 'techcards_categories') {
      if (!_staticCategories) {
        const r = await fetch('data/categories.json');
        if (!r.ok) throw new Error('categories.json not found');
        _staticCategories = await r.json();
      }
      return _staticCategories;
    }
    if (key === 'techcards_cards') {
      if (!_staticCards) {
        const r = await fetch('data/cards.json');
        if (!r.ok) throw new Error('cards.json not found');
        _staticCards = await r.json();
      }
      return _staticCards;
    }
    return [];
  }

  return {
    async get(key) {
      // Try dev server first
      try {
        if (key === 'techcards_cards')      return await apiFetch('/api/cards');
        if (key === 'techcards_categories') return await apiFetch('/api/categories');
        return [];
      } catch (e) {
        // Fall back to static JSON files (GitHub Pages / offline)
        try {
          return await staticGet(key);
        } catch (e2) {
          console.warn('Store.get failed:', e2.message);
          return [];
        }
      }
    },

    async set(key, value) {
      // Write to dev server if available; update in-memory cache either way
      try {
        if (key === 'techcards_cards') {
          await apiFetch('/api/sync/cards', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(value)
          });
        } else if (key === 'techcards_categories') {
          await apiFetch('/api/sync/categories', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(value)
          });
        }
      } catch (e) {
        // Server unavailable — update only in-memory cache
      }
      // Always update in-memory so the page reflects changes in this session
      if (key === 'techcards_categories') _staticCategories = value;
      if (key === 'techcards_cards')      _staticCards = value;
    }
  };
})();

window.DB = {
  async getCategories() {
    const cats = await Store.get('techcards_categories');
    return cats.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  },

  async getTags() {
    return Store.get('techcards_tags');
  },

  async getCards(options = {}) {
    const cats = await Store.get('techcards_categories');
    let cards = (await Store.get('techcards_cards'))
      .filter(c => c.is_published)
      .map(c => ({ ...c, category: cats.find(x => x.id === c.category_id) || null }));

    if (options.categoryId) {
      cards = cards.filter(c => c.category_id === options.categoryId);
    }
    if (options.orderBy === 'views_count.desc') {
      cards.sort((a, b) => (b.views_count || 0) - (a.views_count || 0));
    } else {
      cards.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }
    if (options.limit) cards = cards.slice(0, options.limit);
    return cards;
  },

  async getPopularCards(limit = 6) {
    return this.getCards({ orderBy: 'views_count.desc', limit });
  },

  async getCardById(id) {
    const cards = await Store.get('techcards_cards');
    const card = cards.find(c => c.id === id);
    if (!card) return null;
    const cats = await Store.get('techcards_categories');
    return { ...card, category: cats.find(x => x.id === card.category_id) || null };
  },

  async incrementViews(cardId) {
    const cards = await Store.get('techcards_cards');
    const i = cards.findIndex(c => c.id === cardId);
    if (i !== -1) {
      cards[i].views_count = (cards[i].views_count || 0) + 1;
      await Store.set('techcards_cards', cards);
    }
  }
};
