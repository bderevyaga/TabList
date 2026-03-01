export class TabsBatchOpener {
  constructor(tabsService, options) {
    this.tabsService = tabsService;
    this.batchSize = options.batchSize;
    this.batchDelayMs = options.batchDelayMs;
    this.delayFn = options.delayFn;
  }

  async openUrls(urls, onProgress) {
    const openTabs = await this.tabsService.getOpenTabs();
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
          await this.tabsService.closeTabsByIds(inactiveTabIds);
        }

        if (!hasActiveTab) {
          await this.tabsService.openBackgroundTab(url);
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
