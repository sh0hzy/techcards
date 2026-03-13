// IndexedDB key-value store (no size limit vs localStorage's 5MB)
const Store = (() => {
  const DB_NAME = 'techcards_db';
  const STORE_NAME = 'kv';
  let _db = null;

  function open() {
    if (_db) return Promise.resolve(_db);
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = e => e.target.result.createObjectStore(STORE_NAME);
      req.onsuccess = e => { _db = e.target.result; resolve(_db); };
      req.onerror = () => reject(req.error);
    });
  }

  return {
    async get(key) {
      try {
        const db = await open();
        return await new Promise((resolve, reject) => {
          const req = db.transaction(STORE_NAME, 'readonly')
            .objectStore(STORE_NAME).get(key);
          req.onsuccess = () => resolve(req.result ?? []);
          req.onerror = () => reject(req.error);
        });
      } catch { return []; }
    },
    async set(key, value) {
      try {
        const db = await open();
        await new Promise((resolve, reject) => {
          const req = db.transaction(STORE_NAME, 'readwrite')
            .objectStore(STORE_NAME).put(value, key);
          req.onsuccess = () => resolve();
          req.onerror = () => reject(req.error);
        });
      } catch(e) { console.warn('Store.set failed:', e); }
    }
  };
})();

const DB = {
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
