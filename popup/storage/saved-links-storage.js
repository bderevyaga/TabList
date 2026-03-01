export class SavedLinksStorage {
  constructor(storageArea, storageKey) {
    this.storageArea = storageArea;
    this.storageKey = storageKey;
  }

  loadLinksText() {
    return new Promise((resolve, reject) => {
      this.storageArea.get([this.storageKey], (result) => {
        const error = chrome.runtime.lastError;
        if (error) {
          reject(new Error(error.message));
          return;
        }
        resolve(typeof result[this.storageKey] === 'string' ? result[this.storageKey] : '');
      });
    });
  }

  saveLinksText(text) {
    return new Promise((resolve, reject) => {
      this.storageArea.set({ [this.storageKey]: text }, () => {
        const error = chrome.runtime.lastError;
        if (error) {
          reject(new Error(error.message));
          return;
        }
        resolve();
      });
    });
  }

  clearLinksText() {
    return new Promise((resolve, reject) => {
      this.storageArea.remove([this.storageKey], () => {
        const error = chrome.runtime.lastError;
        if (error) {
          reject(new Error(error.message));
          return;
        }
        resolve();
      });
    });
  }
}
