const DB = {
  _get(key) {
    try { return JSON.parse(localStorage.getItem(key) || '[]'); }
    catch { return []; }
  },

  _set(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
  },

  async getCategories() {
    const cats = this._get('techcards_categories');
    return cats.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  },

  async getTags() {
    return this._get('techcards_tags');
  },

  async getCards(options = {}) {
    const cats = this._get('techcards_categories');
    let cards = this._get('techcards_cards')
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
    const cards = this._get('techcards_cards');
    const card = cards.find(c => c.id === id);
    if (!card) return null;
    const cats = this._get('techcards_categories');
    return { ...card, category: cats.find(x => x.id === card.category_id) || null };
  },

  async incrementViews(cardId) {
    const cards = this._get('techcards_cards');
    const i = cards.findIndex(c => c.id === cardId);
    if (i !== -1) {
      cards[i].views_count = (cards[i].views_count || 0) + 1;
      this._set('techcards_cards', cards);
    }
  }
};
