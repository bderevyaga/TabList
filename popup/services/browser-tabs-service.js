export class BrowserTabsService {
  constructor(browserTabsApi) {
    this.browserTabsApi = browserTabsApi;
  }

  getOpenTabs() {
    return new Promise((resolve, reject) => {
      this.browserTabsApi.query({}, (tabs) => {
        const error = chrome.runtime.lastError;
        if (error) {
          reject(new Error(error.message));
          return;
        }
        resolve(tabs);
      });
    });
  }

  openBackgroundTab(url) {
    return new Promise((resolve, reject) => {
      this.browserTabsApi.create({ url: url, active: false }, () => {
        const error = chrome.runtime.lastError;
        if (error) {
          reject(new Error(error.message));
          return;
        }
        resolve();
      });
    });
  }

  closeTabsByIds(tabIds) {
    if (!tabIds.length) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      this.browserTabsApi.remove(tabIds, () => {
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
