import { callChrome } from '../utils/call-chrome.js';

/**
 * @typedef {Object} BrowserTab
 * @property {number} [id] Tab id assigned by browser.
 * @property {string} [url] URL currently loaded in tab.
 * @property {boolean} [active] Whether tab is active.
 */

/**
 * @typedef {Object} TabsApi
 * @property {(queryInfo: object, callback: (tabs: BrowserTab[]) => void) => void} query Reads tab list.
 * @property {(createProperties: { url: string, active: boolean }, callback: () => void) => void} create Creates a new tab.
 * @property {(tabIds: number[], callback: () => void) => void} remove Closes one or more tabs.
 */

export class TabsService {
  /**
   * @param {TabsApi} api `chrome.tabs`-compatible API object.
   */
  constructor(api) {
    this.api = api;
  }

  /**
   * Reads all open tabs.
   * @returns {Promise<BrowserTab[]>}
   */
  list() {
    return /** @type {Promise<BrowserTab[]>} */ (
      callChrome((callback) => {
        this.api.query({}, callback);
      })
    );
  }

  /**
   * Opens URL in a background tab.
   * @param {string} url URL to open.
   * @returns {Promise<void>}
   */
  open(url) {
    return /** @type {Promise<void>} */ (
      callChrome((callback) => {
        this.api.create({ url: url, active: false }, callback);
      })
    );
  }

  /**
   * Closes tabs by id.
   * @param {number[]} ids Tab ids to close.
   * @returns {Promise<void>}
   */
  close(ids) {
    if (!ids.length) {
      return Promise.resolve();
    }

    return /** @type {Promise<void>} */ (
      callChrome((callback) => {
        this.api.remove(ids, callback);
      })
    );
  }
}
