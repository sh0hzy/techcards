// Local file-based store — backed by server.py running on localhost:8000
// Store.get / Store.set mirror the same interface as before so admin.js is unchanged.
window.Store = (() => {
  const SERVER = 'http://localhost:8000';

  async function apiFetch(path, options) {
    const r = await fetch(SERVER + path, options);
    if (!r.ok) throw new Error(`API ${path} -> ${r.status}`);
    return r.json();
  }

  return {
    async get(key) {
      try {
        if (key === 'techcards_cards')      return apiFetch('/api/cards');
        if (key === 'techcards_categories') return apiFetch('/api/categories');
        return [];
      } catch(e) {
        console.warn('Store.get failed (is server.py running?):', e.message);
        return [];
      }
    },

    async set(key, value) {
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
      } catch(e) {
        console.warn('Store.set failed (is server.py running?):', e.message);
      }
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
