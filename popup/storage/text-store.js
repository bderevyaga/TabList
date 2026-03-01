import { callChrome } from '../utils/call-chrome.js';

/**
 * @typedef {Object} StorageArea
 * @property {(keys: string[], callback: (result: Record<string, unknown>) => void) => void} get Reads values by keys.
 * @property {(items: Record<string, unknown>, callback: () => void) => void} set Writes values by keys.
 * @property {(keys: string[], callback: () => void) => void} remove Removes values by keys.
 */

export class TextStore {
  /**
   * @param {StorageArea} area `chrome.storage.*` area adapter.
   * @param {string} key Storage key used by this store instance.
   */
  constructor(area, key) {
    this.area = area;
    this.key = key;
  }

  /**
   * Reads stored text value.
   * @returns {Promise<string>} Stored value or empty string when key is missing.
   */
  async get() {
    /** @type {Record<string, unknown>} */
    const result = /** @type {Record<string, unknown>} */ (
      await callChrome((callback) => {
        this.area.get([this.key], callback);
      })
    );
    return typeof result[this.key] === 'string' ? result[this.key] : '';
  }

  /**
   * Persists text value.
   * @param {string} text Value to store.
   * @returns {Promise<void>}
   */
  set(text) {
    return /** @type {Promise<void>} */ (
      callChrome((callback) => {
        this.area.set({ [this.key]: text }, callback);
      })
    );
  }

  /**
   * Removes stored value for configured key.
   * @returns {Promise<void>}
   */
  clear() {
    return /** @type {Promise<void>} */ (
      callChrome((callback) => {
        this.area.remove([this.key], callback);
      })
    );
  }
}
