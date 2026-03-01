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
 * @typedef {Object} UrlOpenerOptions
 * @property {number} batchSize Number of URLs processed concurrently in one batch.
 * @property {number} batchDelayMs Delay between batches, in milliseconds.
 * @property {(ms: number) => Promise<void>} delayFn Async delay implementation.
 */

export class UrlOpener {
  /**
   * @param {TabsGateway} tabs Tabs service abstraction.
   * @param {UrlOpenerOptions} options Batch/opening strategy options.
   */
  constructor(tabs, options) {
    this.tabs = tabs;
    this.batchSize = options.batchSize;
    this.batchDelayMs = options.batchDelayMs;
    this.delayFn = options.delayFn;
  }

  /**
   * Opens provided URLs while deduplicating against already active tabs.
   * Inactive duplicates are closed before opening replacements.
   * @param {string[]} urls URLs to open.
   * @param {(openedCount: number, totalCount: number) => void} onProgress Progress callback.
   * @returns {Promise<number>} Count of newly opened tabs.
   */
  async open(urls, onProgress) {
    const openTabs = await this.tabs.list();
    /** @type {Map<string, ExistingTabRef[]>} */
    const tabsByUrl = new Map();

    openTabs.forEach((tab) => {
      if (!tab.url || typeof tab.id !== 'number') {
        return;
      }

      if (!tabsByUrl.has(tab.url)) {
        tabsByUrl.set(tab.url, []);
      }
      tabsByUrl.get(tab.url).push({
        id: tab.id,
        isActive: Boolean(tab.active)
      });
    });

    const totalTabsToOpen = urls.reduce((count, url) => {
      const hasActiveTab = (tabsByUrl.get(url) || []).some((tab) => tab.isActive);
      return count + (hasActiveTab ? 0 : 1);
    }, 0);
    let openedCount = 0;

    for (let index = 0; index < urls.length; index += this.batchSize) {
      const urlBatch = urls.slice(index, index + this.batchSize);
      const openedPerBatch = await Promise.all(urlBatch.map(async (url) => {
        const tabsWithSameUrl = tabsByUrl.get(url) || [];
        const inactiveTabIds = tabsWithSameUrl
          .filter((tab) => !tab.isActive)
          .map((tab) => tab.id);
        const hasActiveTab = tabsWithSameUrl.some((tab) => tab.isActive);

        if (inactiveTabIds.length) {
          await this.tabs.close(inactiveTabIds);
        }

        if (!hasActiveTab) {
          await this.tabs.open(url);
          return 1;
        }
        return 0;
      }));

      openedCount += openedPerBatch.reduce((sum, value) => sum + value, 0);

      if (totalTabsToOpen > 0) {
        onProgress(openedCount, totalTabsToOpen);
      }

      if (index + this.batchSize < urls.length) {
        await this.delayFn(this.batchDelayMs);
      }
    }

    return openedCount;
  }
}
