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

/**
 * @typedef {Object} UrlOperation
 * @property {string} url URL to process.
 * @property {number[]} inactiveIds Matching inactive tab ids that should be closed.
 * @property {boolean} hasActive Whether URL already has an active tab.
 */

/**
 * @typedef {Object} BatchProgressOptions
 * @property {(processedCount: number, totalCount: number) => void} onProgress Progress callback.
 * @property {number} totalCount Total amount of progress units.
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
    const operations = (await this.buildUrlOperations(urls)).filter(
      (operation) => operation.inactiveIds.length || !operation.hasActive
    );

    const totalToOpen = operations.reduce(
      (count, operation) => (operation.hasActive ? count : count + 1),
      0
    );

    return this.processInBatches(
      operations,
      async (batch) => {
        let openedInBatch = 0;

        for (const operation of batch) {
          if (operation.inactiveIds.length) {
            await this.tabs.close(operation.inactiveIds);
          }

          if (!operation.hasActive) {
            await this.tabs.open(operation.url);
            openedInBatch += 1;
          }
        }

        return openedInBatch;
      },
      { onProgress, totalCount: totalToOpen }
    );
  }

  /**
   * Closes inactive tabs that match provided URLs.
   * @param {string[]} urls URLs used for tab matching.
   * @param {(closedCount: number, totalCount: number) => void} [onProgress] Progress callback.
   * @returns {Promise<number>} Count of closed tabs.
   */
  async close(urls, onProgress = () => {}) {
    const operations = (await this.buildUrlOperations(urls)).filter(
      (operation) => operation.inactiveIds.length > 0
    );

    const totalToClose = operations.reduce(
      (count, operation) => count + operation.inactiveIds.length,
      0
    );

    if (!totalToClose) {
      return 0;
    }

    return this.processInBatches(
      operations,
      async (batch) => {
        let closedInBatch = 0;

        for (const operation of batch) {
          await this.tabs.close(operation.inactiveIds);
          closedInBatch += operation.inactiveIds.length;
        }

        return closedInBatch;
      },
      { onProgress, totalCount: totalToClose }
    );
  }

  /**
   * @param {string[]} urls URLs to resolve against current tabs snapshot.
   * @returns {Promise<UrlOperation[]>} URL operations with tab activity metadata.
   */
  async buildUrlOperations(urls) {
    const listedUrls = [...new Set(urls)];
    const tabsByUrl = this.mapTabsByUrl(await this.tabs.list());

    return listedUrls.map((url) => {
      const refs = tabsByUrl.get(url) ?? [];

      return {
        url,
        inactiveIds: this.inactiveIds(refs),
        hasActive: refs.some((ref) => ref.isActive)
      };
    });
  }

  /**
   * @param {BrowserTab[]} tabs Current browser tabs snapshot.
   * @returns {Map<string, ExistingTabRef[]>} Valid tab refs grouped by URL.
   */
  mapTabsByUrl(tabs) {
    return tabs.reduce((map, tab) => {
      if (!tab?.url || typeof tab.id !== 'number') {
        return map;
      }

      const refs = map.get(tab.url) ?? [];
      refs.push({ id: tab.id, isActive: Boolean(tab.active) });
      map.set(tab.url, refs);

      return map;
    }, new Map());
  }

  /**
   * @param {ExistingTabRef[]} refs Tab refs for one URL.
   * @returns {number[]} Inactive tab ids.
   */
  inactiveIds(refs) {
    return refs.filter((ref) => !ref.isActive).map((ref) => ref.id);
  }

  /**
   * Runs items in batches and tracks custom progress units.
   * @template T
   * @param {T[]} items Items to process.
   * @param {(batch: T[]) => Promise<number>} processBatch Batch processor that returns completed unit count.
   * @param {BatchProgressOptions} options Progress options.
   * @returns {Promise<number>} Completed unit count.
   */
  async processInBatches(items, processBatch, options) {
    const { onProgress, totalCount } = options;
    let processedCount = 0;

    for (let index = 0; index < items.length; index += this.batchSize) {
      const batch = items.slice(index, index + this.batchSize);

      processedCount += await processBatch(batch);

      if (totalCount > 0) {
        onProgress(processedCount, totalCount);
      }

      if (index + this.batchSize < items.length) {
        await delay(this.batchDelayMs);
      }
    }

    return processedCount;
  }
}
