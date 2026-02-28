class UrlParser {
  constructor(urlPattern, httpPattern) {
    this.urlPattern = urlPattern;
    this.httpPattern = httpPattern;
  }

  extract(text) {
    return text.match(this.urlPattern) || [];
  }

  extractUnique(text) {
    return this.makeUnique(this.extract(text));
  }

  countNonEmptyLines(text) {
    return text.split(/\r?\n/).filter((line) => line.trim().length > 0).length;
  }

  fromTabs(tabs) {
    const urls = tabs.map((tab) => tab.url || '').filter((url) => this.httpPattern.test(url));
    return this.makeUnique(urls);
  }

  makeUnique(values) {
    return [...new Set(values)];
  }
}

class TextFormatter {
  pluralize(count, word) {
    return `${count} ${word}${count === 1 ? '' : 's'}`;
  }

  linkBadge(count) {
    return this.pluralize(count, 'link');
  }

  defaultSummary(urlCount, lineCount) {
    if (lineCount === 0) {
      return 'Add URLs or capture your current tabs.';
    }

    return `${this.pluralize(urlCount, 'valid URL')} across ${this.pluralize(lineCount, 'line')}.`;
  }

  capturedTabs(count) {
    return `Captured ${this.pluralize(count, 'tab')}.`;
  }

  openingProgress(openedCount, totalCount) {
    return `Opening ${openedCount}/${totalCount} tabs...`;
  }

  openingTabs() {
    return 'Opening tabs...';
  }

  openedTabs(count) {
    return `Opened ${this.pluralize(count, 'tab')}.`;
  }

  copiedToClipboard() {
    return 'Copied to clipboard.';
  }

  closingTabs(count) {
    return `Closing ${this.pluralize(count, 'tab')}...`;
  }

  closedTabs(count) {
    return `Closed ${this.pluralize(count, 'tab')}.`;
  }
}

class StorageService {
  constructor(storageArea, key) {
    this.storageArea = storageArea;
    this.key = key;
  }

  loadText() {
    return new Promise((resolve, reject) => {
      this.storageArea.get([this.key], (result) => {
        const error = chrome.runtime.lastError;
        if (error) {
          reject(new Error(error.message));
          return;
        }
        resolve(typeof result[this.key] === 'string' ? result[this.key] : '');
      });
    });
  }

  saveText(text) {
    return new Promise((resolve, reject) => {
      this.storageArea.set({ [this.key]: text }, () => {
        const error = chrome.runtime.lastError;
        if (error) {
          reject(new Error(error.message));
          return;
        }
        resolve();
      });
    });
  }

  clearText() {
    return new Promise((resolve, reject) => {
      this.storageArea.remove([this.key], () => {
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

class TabService {
  constructor(tabsApi) {
    this.tabsApi = tabsApi;
  }

  getAllTabs() {
    return new Promise((resolve, reject) => {
      this.tabsApi.query({}, (tabs) => {
        const error = chrome.runtime.lastError;
        if (error) {
          reject(new Error(error.message));
          return;
        }
        resolve(tabs);
      });
    });
  }

  openInactiveTab(url) {
    return new Promise((resolve, reject) => {
      this.tabsApi.create({ url: url, active: false }, () => {
        const error = chrome.runtime.lastError;
        if (error) {
          reject(new Error(error.message));
          return;
        }
        resolve();
      });
    });
  }

  closeTabs(tabIds) {
    if (!tabIds.length) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      this.tabsApi.remove(tabIds, () => {
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

class BatchTabOpener {
  constructor(tabService, options) {
    this.tabService = tabService;
    this.batchSize = options.batchSize;
    this.batchDelayMs = options.batchDelayMs;
    this.wait = options.wait;
  }

  async open(urls, onProgress) {
    const existingTabs = await this.tabService.getAllTabs();
    const tabsByUrl = new Map();

    existingTabs.forEach((tab) => {
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

    const totalToOpen = urls.reduce((count, url) => {
      const hasActiveTab = (tabsByUrl.get(url) || []).some((tab) => tab.isActive);
      return count + (hasActiveTab ? 0 : 1);
    }, 0);
    let openedCount = 0;

    for (let index = 0; index < urls.length; index += this.batchSize) {
      const batch = urls.slice(index, index + this.batchSize);
      const openedInBatch = await Promise.all(batch.map(async (url) => {
        const existingTabsForUrl = tabsByUrl.get(url) || [];
        const closableIds = existingTabsForUrl
          .filter((tab) => !tab.isActive)
          .map((tab) => tab.id);
        const hasActiveTab = existingTabsForUrl.some((tab) => tab.isActive);

        if (closableIds.length) {
          await this.tabService.closeTabs(closableIds);
        }

        if (!hasActiveTab) {
          await this.tabService.openInactiveTab(url);
          return 1;
        }
        return 0;
      }));

      openedCount += openedInBatch.reduce((sum, value) => sum + value, 0);

      if (totalToOpen > 0) {
        onProgress(openedCount, totalToOpen);
      }

      if (index + this.batchSize < urls.length) {
        await this.wait(this.batchDelayMs);
      }
    }

    return openedCount;
  }
}

class PopupView {
  constructor(documentRef) {
    this.input = documentRef.getElementById('input');
    this.copy = documentRef.getElementById('copy');
    this.open = documentRef.getElementById('open');
    this.tabs = documentRef.getElementById('tabs');
    this.clear = documentRef.getElementById('clear');
    this.closeAll = documentRef.getElementById('close-all');
    this.status = documentRef.getElementById('status');
    this.summary = documentRef.getElementById('summary');
  }

  bindHandlers(handlers) {
    this.tabs.addEventListener('click', handlers.onCaptureTabs);
    this.input.addEventListener('input', handlers.onInputChanged);
    this.copy.addEventListener('click', handlers.onCopy);
    this.clear.addEventListener('click', handlers.onClear);
    this.closeAll.addEventListener('click', handlers.onCloseAllTabs);
    this.open.addEventListener('click', handlers.onOpen);
  }

  getInputText() {
    return this.input.value;
  }

  setInputText(text) {
    this.input.value = text;
  }

  focusInput() {
    this.input.focus();
  }

  setStatus(text) {
    this.status.textContent = text;
  }

  setSummary(text) {
    this.summary.textContent = text;
  }

  setControlsState(state) {
    this.open.disabled = state.isBusy || !state.hasUrls;
    this.tabs.disabled = state.isBusy;
    this.copy.disabled = state.isBusy || !state.hasText;
    this.clear.disabled = state.isBusy || !state.hasText;
    this.closeAll.disabled = state.isBusy;
    this.input.disabled = state.isBusy;
  }
}

class PopupController {
  constructor(dependencies, options) {
    this.view = dependencies.view;
    this.parser = dependencies.parser;
    this.formatter = dependencies.formatter;
    this.storage = dependencies.storage;
    this.tabService = dependencies.tabService;
    this.tabOpener = dependencies.tabOpener;
    this.copyText = dependencies.copyText;
    this.temporarySummaryMs = options.temporarySummaryMs;
    this.autosaveDelayMs = options.autosaveDelayMs;

    this.state = {
      isOpening: false,
      isClosingAll: false,
      summaryTimer: null,
      saveTimer: null
    };
  }

  async init() {
    this.view.bindHandlers({
      onCaptureTabs: () => this.handleCaptureTabs(),
      onInputChanged: () => this.handleInputChanged(),
      onCopy: () => this.handleCopy(),
      onClear: () => this.handleClear(),
      onCloseAllTabs: () => this.handleCloseAllTabs(),
      onOpen: () => this.handleOpen()
    });

    let savedText = '';
    let loadFailed = false;
    try {
      savedText = await this.storage.loadText();
    } catch (_error) {
      loadFailed = true;
    }

    this.view.setInputText(savedText);
    this.render(false);
    if (loadFailed) {
      this.showTemporarySummary('Failed to load saved links.');
    }
  }

  render(preserveSummary) {
    const text = this.view.getInputText();
    const urls = this.parser.extractUnique(text);
    const lineCount = this.parser.countNonEmptyLines(text);

    this.view.setStatus(this.formatter.linkBadge(urls.length));
    if (!preserveSummary) {
      this.view.setSummary(this.formatter.defaultSummary(urls.length, lineCount));
    }

    this.view.setControlsState({
      isBusy: this.state.isOpening || this.state.isClosingAll,
      hasUrls: urls.length > 0,
      hasText: text.trim().length > 0
    });

    return urls;
  }

  clearSummaryTimer() {
    if (this.state.summaryTimer) {
      clearTimeout(this.state.summaryTimer);
      this.state.summaryTimer = null;
    }
  }

  clearSaveTimer() {
    if (this.state.saveTimer) {
      clearTimeout(this.state.saveTimer);
      this.state.saveTimer = null;
    }
  }

  showTemporarySummary(message) {
    this.clearSummaryTimer();
    this.view.setSummary(message);
    this.state.summaryTimer = setTimeout(() => {
      this.state.summaryTimer = null;
      this.render(false);
    }, this.temporarySummaryMs);
  }

  scheduleAutosave() {
    this.clearSaveTimer();
    const text = this.view.getInputText();
    this.state.saveTimer = setTimeout(async () => {
      this.state.saveTimer = null;
      try {
        await this.storage.saveText(text);
      } catch (_error) {
        this.showTemporarySummary('Failed to save links.');
      }
    }, this.autosaveDelayMs);
  }

  handleInputChanged() {
    this.clearSummaryTimer();
    this.scheduleAutosave();
    this.render(false);
  }

  async handleCaptureTabs() {
    if (this.state.isOpening) {
      return;
    }

    this.clearSummaryTimer();
    this.clearSaveTimer();

    let tabs = [];
    try {
      tabs = await this.tabService.getAllTabs();
    } catch (_error) {
      this.showTemporarySummary('Failed to read open tabs.');
      return;
    }

    const urls = this.parser.fromTabs(tabs);

    this.view.setInputText(urls.join('\n'));
    try {
      await this.storage.saveText(this.view.getInputText());
    } catch (_error) {
      this.render(false);
      this.showTemporarySummary('Tabs captured but failed to save.');
      return;
    }
    this.render(false);
    this.showTemporarySummary(this.formatter.capturedTabs(urls.length));
  }

  async handleClear() {
    if (this.state.isOpening) {
      return;
    }

    this.clearSummaryTimer();
    this.clearSaveTimer();
    try {
      await this.storage.clearText();
    } catch (_error) {
      this.showTemporarySummary('Failed to clear links.');
      return;
    }
    this.view.setInputText('');
    this.view.focusInput();
    this.render(false);
  }

  async handleCopy() {
    if (this.state.isOpening) {
      return;
    }

    this.clearSummaryTimer();
    const text = this.view.getInputText();
    if (!text.trim()) {
      this.showTemporarySummary('Nothing to copy.');
      return;
    }

    try {
      await this.copyText(text);
      this.showTemporarySummary(this.formatter.copiedToClipboard());
    } catch (_error) {
      this.showTemporarySummary('Failed to copy text.');
    }
  }

  async handleOpen() {
    if (this.state.isOpening || this.state.isClosingAll) {
      return;
    }

    this.clearSummaryTimer();
    const urls = this.render(false);
    if (!urls.length) {
      return;
    }

    this.state.isOpening = true;
    this.render(true);
    this.view.setSummary(this.formatter.openingTabs());

    let finishMessage = null;
    try {
      const openedCount = await this.tabOpener.open(urls, (openedCountValue, totalCount) => {
        this.view.setSummary(this.formatter.openingProgress(openedCountValue, totalCount));
      });
      finishMessage = this.formatter.openedTabs(openedCount);
    } catch (_error) {
      finishMessage = 'Failed to open tabs.';
    } finally {
      this.state.isOpening = false;
      this.render(true);
    }

    this.showTemporarySummary(finishMessage);
  }

  async handleCloseAllTabs() {
    if (this.state.isOpening || this.state.isClosingAll) {
      return;
    }

    this.clearSummaryTimer();

    const listedUrls = this.parser.extractUnique(this.view.getInputText());
    if (!listedUrls.length) {
      this.showTemporarySummary('No URLs in the list.');
      return;
    }

    let tabs = [];
    try {
      tabs = await this.tabService.getAllTabs();
    } catch (_error) {
      this.showTemporarySummary('Failed to read open tabs.');
      return;
    }

    const listedUrlSet = new Set(listedUrls);
    const tabIds = tabs
      .filter((tab) => (
        typeof tab.id === 'number'
        && !tab.active
        && typeof tab.url === 'string'
        && listedUrlSet.has(tab.url)
      ))
      .map((tab) => tab.id);
    if (!tabIds.length) {
      this.showTemporarySummary('No listed tabs to close.');
      return;
    }

    this.state.isClosingAll = true;
    this.render(true);
    this.view.setSummary(this.formatter.closingTabs(tabIds.length));

    let finishMessage = null;
    try {
      await this.tabService.closeTabs(tabIds);
      finishMessage = this.formatter.closedTabs(tabIds.length);
    } catch (_error) {
      finishMessage = 'Failed to close tabs.';
    } finally {
      this.state.isClosingAll = false;
      this.render(true);
    }

    this.showTemporarySummary(finishMessage);
  }
}

const createDelay = (milliseconds) => new Promise((resolve) => {
  setTimeout(resolve, milliseconds);
});

const createClipboardWriter = (documentRef, navigatorRef) => {
  const clipboard = navigatorRef.clipboard;
  if (clipboard && typeof clipboard.writeText === 'function') {
    return (text) => clipboard.writeText(text);
  }

  return async (text) => {
    const helper = documentRef.createElement('textarea');
    helper.value = text;
    helper.setAttribute('readonly', '');
    helper.style.position = 'fixed';
    helper.style.top = '-1000px';
    helper.style.left = '-1000px';
    documentRef.body.appendChild(helper);

    let copied = false;
    try {
      helper.focus();
      helper.select();
      copied = documentRef.execCommand('copy');
    } finally {
      helper.remove();
    }

    if (!copied) {
      throw new Error('Copy command failed');
    }
  };
};

document.addEventListener('DOMContentLoaded', async () => {
  const parser = new UrlParser(/https?:\/\/[^\s]+/g, /^https?:\/\//);
  const formatter = new TextFormatter();
  const storage = new StorageService(chrome.storage.local, 'text');
  const tabService = new TabService(chrome.tabs);
  const copyText = createClipboardWriter(document, navigator);
  const tabOpener = new BatchTabOpener(tabService, {
    batchSize: 6,
    batchDelayMs: 120,
    wait: createDelay
  });

  const view = new PopupView(document);
  const controller = new PopupController(
    {
      view: view,
      parser: parser,
      formatter: formatter,
      storage: storage,
      tabService: tabService,
      tabOpener: tabOpener,
      copyText: copyText
    },
    {
      temporarySummaryMs: 1600,
      autosaveDelayMs: 350
    }
  );

  await controller.init();
});
