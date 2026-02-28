class UrlListParser {
  constructor(urlMatchPattern, httpUrlPattern) {
    this.urlMatchPattern = urlMatchPattern;
    this.httpUrlPattern = httpUrlPattern;
  }

  extractUrls(text) {
    return text.match(this.urlMatchPattern) || [];
  }

  extractUniqueUrls(text) {
    return this.getUniqueValues(this.extractUrls(text));
  }

  countNonEmptyLines(text) {
    return text.split(/\r?\n/).filter((line) => line.trim().length > 0).length;
  }

  extractHttpUrlsFromTabs(tabs) {
    const urls = tabs.map((tab) => tab.url || '').filter((url) => this.httpUrlPattern.test(url));
    return this.getUniqueValues(urls);
  }

  getUniqueValues(values) {
    return [...new Set(values)];
  }
}

class PopupTextFormatter {
  pluralize(count, word) {
    return `${count} ${word}${count === 1 ? '' : 's'}`;
  }

  formatLinkCount(count) {
    return this.pluralize(count, 'link');
  }

  formatDefaultSummary(urlCount, lineCount) {
    if (lineCount === 0) {
      return 'Add URLs or capture your current tabs.';
    }

    return `${this.pluralize(urlCount, 'valid URL')} across ${this.pluralize(lineCount, 'line')}.`;
  }

  formatCapturedTabs(count) {
    return `Captured ${this.pluralize(count, 'tab')}.`;
  }

  formatOpeningProgress(openedCount, totalCount) {
    return `Opening ${openedCount}/${totalCount} tabs...`;
  }

  formatOpeningTabs() {
    return 'Opening tabs...';
  }

  formatOpenedTabs(count) {
    return `Opened ${this.pluralize(count, 'tab')}.`;
  }

  formatCopiedToClipboard() {
    return 'Copied to clipboard.';
  }

  formatClosingTabs(count) {
    return `Closing ${this.pluralize(count, 'tab')}...`;
  }

  formatClosedTabs(count) {
    return `Closed ${this.pluralize(count, 'tab')}.`;
  }
}

class SavedLinksStorage {
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

class BrowserTabsService {
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

class TabsBatchOpener {
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

class PopupDomView {
  constructor(documentRef) {
    this.linkListInputField = documentRef.getElementById('link-list-input');
    this.copyLinksButton = documentRef.getElementById('copy-links-button');
    this.openLinksButton = documentRef.getElementById('open-links-button');
    this.captureTabsButton = documentRef.getElementById('capture-tabs-button');
    this.clearLinksButton = documentRef.getElementById('clear-links-button');
    this.closeListedButton = documentRef.getElementById('close-listed-button');
    this.linkCountLabel = documentRef.getElementById('link-count');
    this.statusMessageLabel = documentRef.getElementById('status-message');
  }

  bindUiHandlers(handlers) {
    this.captureTabsButton.addEventListener('click', handlers.onCaptureTabsClick);
    this.linkListInputField.addEventListener('input', handlers.onInputChange);
    this.copyLinksButton.addEventListener('click', handlers.onCopyClick);
    this.clearLinksButton.addEventListener('click', handlers.onClearClick);
    this.closeListedButton.addEventListener('click', handlers.onCloseListedTabsClick);
    this.openLinksButton.addEventListener('click', handlers.onOpenLinksClick);
  }

  getLinksText() {
    return this.linkListInputField.value;
  }

  setLinksText(text) {
    this.linkListInputField.value = text;
  }

  focusLinksInput() {
    this.linkListInputField.focus();
  }

  setLinkCountText(text) {
    this.linkCountLabel.textContent = text;
  }

  setStatusMessageText(text) {
    this.statusMessageLabel.textContent = text;
  }

  updateControlsState(controlsState) {
    this.openLinksButton.disabled = controlsState.isBusy || !controlsState.hasUrls;
    this.captureTabsButton.disabled = controlsState.isBusy;
    this.copyLinksButton.disabled = controlsState.isBusy || !controlsState.hasText;
    this.clearLinksButton.disabled = controlsState.isBusy || !controlsState.hasText;
    this.closeListedButton.disabled = controlsState.isBusy;
    this.linkListInputField.disabled = controlsState.isBusy;
  }
}

class PopupUiController {
  constructor(dependencies, options) {
    this.popupView = dependencies.popupView;
    this.urlParser = dependencies.urlParser;
    this.textFormatter = dependencies.textFormatter;
    this.savedLinksStorage = dependencies.savedLinksStorage;
    this.tabsService = dependencies.tabsService;
    this.tabsBatchOpener = dependencies.tabsBatchOpener;
    this.writeClipboardText = dependencies.writeClipboardText;
    this.temporaryStatusMs = options.temporaryStatusMs;
    this.autosaveDelayMs = options.autosaveDelayMs;

    this.uiState = {
      isOpeningLinks: false,
      isClosingListedTabs: false,
      statusTimer: null,
      autosaveTimer: null
    };
  }

  async initialize() {
    this.popupView.bindUiHandlers({
      onCaptureTabsClick: () => this.handleCaptureTabsClick(),
      onInputChange: () => this.handleInputChange(),
      onCopyClick: () => this.handleCopyClick(),
      onClearClick: () => this.handleClearClick(),
      onCloseListedTabsClick: () => this.handleCloseListedTabsClick(),
      onOpenLinksClick: () => this.handleOpenLinksClick()
    });

    let savedLinksText = '';
    let isLoadFailed = false;
    try {
      savedLinksText = await this.savedLinksStorage.loadLinksText();
    } catch (_error) {
      isLoadFailed = true;
    }

    this.popupView.setLinksText(savedLinksText);
    this.renderUi(false);
    if (isLoadFailed) {
      this.showTemporaryStatus('Failed to load saved links.');
    }
  }

  renderUi(preserveStatusMessage) {
    const linksText = this.popupView.getLinksText();
    const uniqueUrls = this.urlParser.extractUniqueUrls(linksText);
    const nonEmptyLineCount = this.urlParser.countNonEmptyLines(linksText);

    this.popupView.setLinkCountText(this.textFormatter.formatLinkCount(uniqueUrls.length));
    if (!preserveStatusMessage) {
      this.popupView.setStatusMessageText(
        this.textFormatter.formatDefaultSummary(uniqueUrls.length, nonEmptyLineCount)
      );
    }

    this.popupView.updateControlsState({
      isBusy: this.uiState.isOpeningLinks || this.uiState.isClosingListedTabs,
      hasUrls: uniqueUrls.length > 0,
      hasText: linksText.trim().length > 0
    });

    return uniqueUrls;
  }

  clearStatusTimer() {
    if (this.uiState.statusTimer) {
      clearTimeout(this.uiState.statusTimer);
      this.uiState.statusTimer = null;
    }
  }

  clearAutosaveTimer() {
    if (this.uiState.autosaveTimer) {
      clearTimeout(this.uiState.autosaveTimer);
      this.uiState.autosaveTimer = null;
    }
  }

  isAnyTabOperationActive() {
    return this.uiState.isOpeningLinks || this.uiState.isClosingListedTabs;
  }

  prepareForUserAction(options = {}) {
    const shouldClearAutosave = options.shouldClearAutosave || false;
    this.clearStatusTimer();
    if (shouldClearAutosave) {
      this.clearAutosaveTimer();
    }
  }

  async getOpenTabsOrShowError() {
    try {
      return await this.tabsService.getOpenTabs();
    } catch (_error) {
      this.showTemporaryStatus('Failed to read open tabs.');
      return null;
    }
  }

  async runWithBusyState(stateKey, taskFn) {
    this.uiState[stateKey] = true;
    this.renderUi(true);
    try {
      return await taskFn();
    } finally {
      this.uiState[stateKey] = false;
      this.renderUi(true);
    }
  }

  showTemporaryStatus(message) {
    this.clearStatusTimer();
    this.popupView.setStatusMessageText(message);
    this.uiState.statusTimer = setTimeout(() => {
      this.uiState.statusTimer = null;
      this.renderUi(false);
    }, this.temporaryStatusMs);
  }

  scheduleAutosave() {
    this.clearAutosaveTimer();
    const linksText = this.popupView.getLinksText();
    this.uiState.autosaveTimer = setTimeout(async () => {
      this.uiState.autosaveTimer = null;
      try {
        await this.savedLinksStorage.saveLinksText(linksText);
      } catch (_error) {
        this.showTemporaryStatus('Failed to save links.');
      }
    }, this.autosaveDelayMs);
  }

  handleInputChange() {
    this.prepareForUserAction();
    this.scheduleAutosave();
    this.renderUi(false);
  }

  async handleCaptureTabsClick() {
    if (this.uiState.isOpeningLinks) {
      return;
    }

    this.prepareForUserAction({ shouldClearAutosave: true });
    const openTabs = await this.getOpenTabsOrShowError();
    if (!openTabs) {
      return;
    }

    const capturedUrls = this.urlParser.extractHttpUrlsFromTabs(openTabs);

    this.popupView.setLinksText(capturedUrls.join('\n'));
    try {
      await this.savedLinksStorage.saveLinksText(this.popupView.getLinksText());
    } catch (_error) {
      this.renderUi(false);
      this.showTemporaryStatus('Tabs captured but failed to save.');
      return;
    }
    this.renderUi(false);
    this.showTemporaryStatus(this.textFormatter.formatCapturedTabs(capturedUrls.length));
  }

  async handleClearClick() {
    if (this.uiState.isOpeningLinks) {
      return;
    }

    this.prepareForUserAction({ shouldClearAutosave: true });
    try {
      await this.savedLinksStorage.clearLinksText();
    } catch (_error) {
      this.showTemporaryStatus('Failed to clear links.');
      return;
    }
    this.popupView.setLinksText('');
    this.popupView.focusLinksInput();
    this.renderUi(false);
  }

  async handleCopyClick() {
    if (this.uiState.isOpeningLinks) {
      return;
    }

    this.prepareForUserAction();
    const linksText = this.popupView.getLinksText();
    if (!linksText.trim()) {
      this.showTemporaryStatus('Nothing to copy.');
      return;
    }

    try {
      await this.writeClipboardText(linksText);
      this.showTemporaryStatus(this.textFormatter.formatCopiedToClipboard());
    } catch (_error) {
      this.showTemporaryStatus('Failed to copy text.');
    }
  }

  async handleOpenLinksClick() {
    if (this.isAnyTabOperationActive()) {
      return;
    }

    this.prepareForUserAction();
    const urlsToOpen = this.renderUi(false);
    if (!urlsToOpen.length) {
      return;
    }

    const completionMessage = await this.runWithBusyState('isOpeningLinks', async () => {
      this.popupView.setStatusMessageText(this.textFormatter.formatOpeningTabs());
      try {
        const openedCount = await this.tabsBatchOpener.openUrls(
          urlsToOpen,
          (openedCountValue, totalCount) => {
            this.popupView.setStatusMessageText(
              this.textFormatter.formatOpeningProgress(openedCountValue, totalCount)
            );
          }
        );
        return this.textFormatter.formatOpenedTabs(openedCount);
      } catch (_error) {
        return 'Failed to open tabs.';
      }
    });

    this.showTemporaryStatus(completionMessage);
  }

  async handleCloseListedTabsClick() {
    if (this.isAnyTabOperationActive()) {
      return;
    }

    this.prepareForUserAction();

    const listedUrls = this.urlParser.extractUniqueUrls(this.popupView.getLinksText());
    if (!listedUrls.length) {
      this.showTemporaryStatus('No URLs in the list.');
      return;
    }

    const openTabs = await this.getOpenTabsOrShowError();
    if (!openTabs) {
      return;
    }

    const listedUrlSet = new Set(listedUrls);
    const listedTabIds = openTabs
      .filter((tab) => (
        typeof tab.id === 'number'
        && !tab.active
        && typeof tab.url === 'string'
        && listedUrlSet.has(tab.url)
      ))
      .map((tab) => tab.id);
    if (!listedTabIds.length) {
      this.showTemporaryStatus('No listed tabs to close.');
      return;
    }

    const completionMessage = await this.runWithBusyState('isClosingListedTabs', async () => {
      this.popupView.setStatusMessageText(this.textFormatter.formatClosingTabs(listedTabIds.length));
      try {
        await this.tabsService.closeTabsByIds(listedTabIds);
        return this.textFormatter.formatClosedTabs(listedTabIds.length);
      } catch (_error) {
        return 'Failed to close tabs.';
      }
    });

    this.showTemporaryStatus(completionMessage);
  }
}

const createTimeoutDelay = (milliseconds) => new Promise((resolve) => {
  setTimeout(resolve, milliseconds);
});

const createClipboardTextWriter = (documentRef, navigatorRef) => {
  const clipboard = navigatorRef.clipboard;
  if (clipboard && typeof clipboard.writeText === 'function') {
    return (text) => clipboard.writeText(text);
  }

  return async (text) => {
    const clipboardFallbackTextarea = documentRef.createElement('textarea');
    clipboardFallbackTextarea.value = text;
    clipboardFallbackTextarea.setAttribute('readonly', '');
    clipboardFallbackTextarea.style.position = 'fixed';
    clipboardFallbackTextarea.style.top = '-1000px';
    clipboardFallbackTextarea.style.left = '-1000px';
    documentRef.body.appendChild(clipboardFallbackTextarea);

    let didCopy = false;
    try {
      clipboardFallbackTextarea.focus();
      clipboardFallbackTextarea.select();
      didCopy = documentRef.execCommand('copy');
    } finally {
      clipboardFallbackTextarea.remove();
    }

    if (!didCopy) {
      throw new Error('Copy command failed');
    }
  };
};

document.addEventListener('DOMContentLoaded', async () => {
  const urlParser = new UrlListParser(/https?:\/\/[^\s]+/g, /^https?:\/\//);
  const textFormatter = new PopupTextFormatter();
  const savedLinksStorage = new SavedLinksStorage(chrome.storage.local, 'text');
  const tabsService = new BrowserTabsService(chrome.tabs);
  const writeClipboardText = createClipboardTextWriter(document, navigator);
  const tabsBatchOpener = new TabsBatchOpener(tabsService, {
    batchSize: 6,
    batchDelayMs: 120,
    delayFn: createTimeoutDelay
  });

  const popupView = new PopupDomView(document);
  const popupController = new PopupUiController(
    {
      popupView: popupView,
      urlParser: urlParser,
      textFormatter: textFormatter,
      savedLinksStorage: savedLinksStorage,
      tabsService: tabsService,
      tabsBatchOpener: tabsBatchOpener,
      writeClipboardText: writeClipboardText
    },
    {
      temporaryStatusMs: 1600,
      autosaveDelayMs: 350
    }
  );

  await popupController.initialize();
});
