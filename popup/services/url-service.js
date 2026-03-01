import { delay } from '../utils/delay.js';

/**
 * @typedef {Object} BrowserTab
 * @property {number} [id] Browser tab id.
 * @property {string} [url] Browser tab URL.
 * @property {boolean} [active] Whether tab is active.
 */

/**
 * @typedef {Object} ExistingTabRef
 * @property {number} id Browser tab id.
 * @property {boolean} isActive Whether tab is currently active.
 */

/**
 * @typedef {Object} TabsGateway
 * @property {() => Promise<BrowserTab[]>} list Returns currently open tabs.
 * @property {(ids: number[]) => Promise<void>} close Closes tabs by id.
 * @property {(url: string) => Promise<void>} open Opens URL in background tab.
 */

/**
 * @typedef {Object} UrlServiceOptions
 * @property {number} batchSize Number of URLs processed concurrently in one batch.
 * @property {number} batchDelayMs Delay between batches, in milliseconds.
 */

export class UrlService {
  /**
   * @param {TabsGateway} tabs Tabs service abstraction.
   * @param {UrlServiceOptions} options Batch/opening strategy options.
   */
  constructor(tabs, options) {
    this.tabs = tabs;
    this.batchSize = options.batchSize;
    this.batchDelayMs = options.batchDelayMs;
  }

  /**
   * Opens provided URLs while deduplicating against already active tabs.
   * Inactive duplicates are closed before opening replacements.
   * @param {string[]} urls URLs to open.
   * @param {(openedCount: number, totalCount: number) => void} [onProgress] Progress callback.
   * @returns {Promise<number>} Count of newly opened tabs.
   */
  async open(urls, onProgress = () => {}) {
    const tabs = await this.tabs.list();
    const tabsByUrl = tabs.reduce((map, tab) => {
      if (!tab?.url || typeof tab.id !== "number") return map;

      const list = map.get(tab.url) ?? [];
      list.push(tab);
      map.set(tab.url, list);

      return map;
    }, new Map());

    let totalToOpen = 0;

    for (const url of urls) {
      const tabs = tabsByUrl.get(url) || [];
      const hasActive = tabs.some(tab => tab.active);

      if (!hasActive) {
        totalToOpen += 1;
      }
    }

    let openedCount = 0;

    for (let index = 0; index < urls.length; index += this.batchSize) {
      const batch = urls.slice(index, index + this.batchSize);

      for (const url of batch) {
        const tabs = tabsByUrl.get(url) || [];

        const activeTabs = tabs.filter(tab => tab.active);
        const inactiveTabs = tabs.filter(tab => !tab.active);

        if (inactiveTabs.length) {
          const ids = inactiveTabs.map(tab => tab.id);
          await this.tabs.close(ids);
        }

        if (activeTabs.length === 0) {
          await this.tabs.open(url);
          openedCount += 1;
        }
      }

      if (totalToOpen > 0) {
        onProgress(openedCount, totalToOpen);
      }

      if (index + this.batchSize < urls.length) {
        await delay(this.batchDelayMs);
      }
    }

    return openedCount;
  }

  /**
   * Closes inactive tabs that match provided URLs.
   * @param {string[]} urls URLs used for tab matching.
   * @param {(closedCount: number, totalCount: number) => void} [onProgress] Progress callback.
   * @returns {Promise<number>} Count of closed tabs.
   */
  async close(urls, onProgress = () => {}) {
    const tabs = await this.tabs.list();

    const listedSet = new Set(urls);
    const listedIds = tabs
      .filter((tab) => (listedSet.has(tab.url) && !tab.active))
      .map((tab) => tab.id);

    if (!listedIds.length) {
      return 0;
    }

    const totalTabsToClose = listedIds.length;
    let closedCount = 0;

    for (let index = 0; index < listedIds.length; index += this.batchSize) {
      const idsBatch = listedIds.slice(index, index + this.batchSize);

      await this.tabs.close(idsBatch);

      closedCount += idsBatch.length;

      onProgress(closedCount, totalTabsToClose);

      if (index + this.batchSize < listedIds.length) {
        await delay(this.batchDelayMs);
      }
    }

    return closedCount;
  }
}
