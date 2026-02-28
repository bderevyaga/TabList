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

  openedTabs(count) {
    return `Opened ${this.pluralize(count, 'tab')}.`;
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
}

class BatchTabOpener {
  constructor(tabService, options) {
    this.tabService = tabService;
    this.batchSize = options.batchSize;
    this.batchDelayMs = options.batchDelayMs;
    this.wait = options.wait;
  }

  async open(urls, onProgress) {
    for (let index = 0; index < urls.length; index += this.batchSize) {
      const batch = urls.slice(index, index + this.batchSize);
      await Promise.all(batch.map((url) => this.tabService.openInactiveTab(url)));

      const openedCount = Math.min(index + this.batchSize, urls.length);
      onProgress(openedCount, urls.length);

      if (openedCount < urls.length) {
        await this.wait(this.batchDelayMs);
      }
    }
  }
}

class PopupView {
  constructor(documentRef) {
    this.input = documentRef.getElementById('input');
    this.open = documentRef.getElementById('open');
    this.tabs = documentRef.getElementById('tabs');
    this.clear = documentRef.getElementById('clear');
    this.status = documentRef.getElementById('status');
    this.summary = documentRef.getElementById('summary');
  }

  bindHandlers(handlers) {
    this.tabs.addEventListener('click', handlers.onCaptureTabs);
    this.input.addEventListener('input', handlers.onInputChanged);
    this.clear.addEventListener('click', handlers.onClear);
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
    this.open.disabled = state.isOpening || !state.hasUrls;
    this.tabs.disabled = state.isOpening;
    this.clear.disabled = state.isOpening || !state.hasText;
    this.input.disabled = state.isOpening;
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
    this.confirm = dependencies.confirm;

    this.largeOpenThreshold = options.largeOpenThreshold;
    this.temporarySummaryMs = options.temporarySummaryMs;
    this.autosaveDelayMs = options.autosaveDelayMs;

    this.state = {
      isOpening: false,
      summaryTimer: null,
      saveTimer: null
    };
  }

  async init() {
    this.view.bindHandlers({
      onCaptureTabs: () => this.handleCaptureTabs(),
      onInputChanged: () => this.handleInputChanged(),
      onClear: () => this.handleClear(),
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
      isOpening: this.state.isOpening,
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

  async handleOpen() {
    if (this.state.isOpening) {
      return;
    }

    this.clearSummaryTimer();
    const urls = this.render(false);
    if (!urls.length) {
      return;
    }

    if (urls.length >= this.largeOpenThreshold) {
      const shouldOpen = this.confirm(`Open ${urls.length} tabs? This may take a few seconds.`);
      if (!shouldOpen) {
        this.showTemporarySummary('Opening canceled.');
        return;
      }
    }

    this.state.isOpening = true;
    this.render(true);
    this.view.setSummary(this.formatter.openingProgress(0, urls.length));

    let finishMessage = null;
    try {
      await this.tabOpener.open(urls, (openedCount, totalCount) => {
        this.view.setSummary(this.formatter.openingProgress(openedCount, totalCount));
      });
      finishMessage = this.formatter.openedTabs(urls.length);
    } catch (_error) {
      finishMessage = 'Failed to open tabs.';
    } finally {
      this.state.isOpening = false;
      this.render(true);
    }

    this.showTemporarySummary(finishMessage);
  }
}

const createDelay = (milliseconds) => new Promise((resolve) => {
  setTimeout(resolve, milliseconds);
});

document.addEventListener('DOMContentLoaded', async () => {
  const parser = new UrlParser(/https?:\/\/[^\s]+/g, /^https?:\/\//);
  const formatter = new TextFormatter();
  const storage = new StorageService(chrome.storage.local, 'text');
  const tabService = new TabService(chrome.tabs);
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
      confirm: window.confirm.bind(window)
    },
    {
      largeOpenThreshold: 30,
      temporarySummaryMs: 1600,
      autosaveDelayMs: 350
    }
  );

  await controller.init();
});
