class HistoryStore extends DataStore {
  #history = [];
  #pointer = -1;

  constructor() {
    super();
    this.store.subscribe('change', () => {
      this.#history = this.#history.slice(0, this.#pointer + 1);
      this.#history.push(structuredClone(this.store.data));
      this.#pointer++;
    });
  }

  undo() {
    if (this.#pointer > 0) {
      this.#pointer--;
      this.setData(this.#history[this.#pointer]);
    }
  }

  redo() {
    if (this.#pointer < this.#history.length - 1) {
      this.#pointer++;
      this.setData(this.#history[this.#pointer]);
    }
  }
}