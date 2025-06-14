class PersistentStore extends DataStore {
  constructor() {
    super();
    this._loadFromStorage();
    this.store.subscribe('change', () => this._saveToStorage());
  }

  _loadFromStorage() {
    const data = localStorage.getItem('store-data');
    if (data) this.setData(JSON.parse(data));
  }

  _saveToStorage() {
    localStorage.setItem('store-data', JSON.stringify(this.store.data));
  }
}