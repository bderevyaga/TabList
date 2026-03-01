import { createFailureTracker } from '../utils/create-failure-tracker.js';

/**
 * @typedef {Object} BrowserTab
 * @property {number} [id] Unique browser tab identifier.
 * @property {boolean} [active] Whether the tab is currently active.
 * @property {string} [url] Current tab URL.
 */

/**
 * @typedef {Object} ControllerDeps
 * @property {import('../view/view.js').View} view DOM adapter for reading/writing UI state.
 * @property {import('../parsers/url-parser.js').UrlParser} parser URL parsing and filtering utility.
 * @property {import('../formatters/text.js').Text} text User-facing text formatter.
 * @property {{ get: () => Promise<string>, set: (text: string) => Promise<void>, clear: () => Promise<void> }} textStore Storage for text input value.
 * @property {{ get: () => Promise<string>, set: (text: string) => Promise<void>, clear: () => Promise<void> }} filterStore Storage for capture filter value.
 * @property {{ list: () => Promise<BrowserTab[]>, close: (ids: number[]) => Promise<void> }} tabs Browser tabs service.
 * @property {{ open: (urls: string[], onProgress: (openedCount: number, totalCount: number) => void) => Promise<number> }} opener URL opening orchestrator.
 * @property {(text: string) => Promise<void>} copyText Clipboard writer function.
 */

/**
 * @typedef {Object} ControllerOptions
 * @property {number} statusMs How long transient status messages stay visible.
 * @property {number} saveDelayMs Debounce delay for persisting text/filter input changes.
 */

/**
 * @typedef {Object} ControllerState
 * @property {boolean} opening Whether URL opening flow is currently running.
 * @property {boolean} closing Whether tab closing flow is currently running.
 * @property {ReturnType<typeof setTimeout> | null} statusTimer Active status reset timer.
 * @property {ReturnType<typeof setTimeout> | null} saveTimer Active delayed save timer.
 */

export class Controller {
  /**
   * @param {ControllerDeps} deps Runtime services and UI abstractions.
   * @param {ControllerOptions} options UI timing configuration.
   */
  constructor(deps, options) {
    this.view = deps.view;
    this.parser = deps.parser;
    this.text = deps.text;
    this.textStore = deps.textStore;
    this.filterStore = deps.filterStore;
    this.tabs = deps.tabs;
    this.opener = deps.opener;
    this.copyText = deps.copyText;
    this.statusMs = options.statusMs;
    this.saveDelayMs = options.saveDelayMs;

    /** @type {ControllerState} */
    this.state = {
      opening: false,
      closing: false,
      statusTimer: null,
      saveTimer: null
    };
  }

  /**
   * Wires UI handlers, restores persisted values, and renders the initial state.
   * @returns {Promise<void>}
   */
  async init() {
    const onTextChange = () => this.onTextChange();

    this.view.bind({
      onCapture: () => this.onCapture(),
      onInput: onTextChange,
      onFilterInput: onTextChange,
      onCopy: () => this.onCopy(),
      onClear: () => this.onClear(),
      onClose: () => this.onClose(),
      onOpen: () => this.onOpen()
    });

    const { markFailed, hasFailed } = createFailureTracker();

    const [text, filter] = await Promise.all([
      this.textStore.get().catch(markFailed('')),
      this.filterStore.get().catch(markFailed('')),
    ]);

    this.view.setText(text);
    this.view.setFilter(filter);

    this.render(false);

    if (hasFailed()) {
      this.flash(this.text.loadError());
    }
  }

  /**
   * Recomputes derived UI values from current text input content.
   * @param {boolean} keepStatus Whether current status text should be preserved.
   * @returns {void}
   */
  render(keepStatus) {
    const text = this.view.getText();
    const urls = this.parser.unique(text);
    const lineCount = this.parser.lineCount(text);

    this.view.setCount(this.text.linkCount(urls.length));
    if (!keepStatus) {
      this.view.setStatus(this.text.summary(urls.length, lineCount));
    }

    this.view.setControls({
      isBusy: this.busy(),
      hasUrls: urls.length > 0,
      hasText: text.trim().length > 0
    });
  }

  /**
   * Cancels an existing status reset timer, if any.
   * @returns {void}
   */
  clearStatus() {
    if (this.state.statusTimer) {
      clearTimeout(this.state.statusTimer);
      this.state.statusTimer = null;
    }
  }

  /**
   * Cancels an existing debounced save timer, if any.
   * @returns {void}
   */
  clearSave() {
    if (this.state.saveTimer) {
      clearTimeout(this.state.saveTimer);
      this.state.saveTimer = null;
    }
  }

  /**
   * @returns {boolean} Whether any long-running action is active.
   */
  busy() {
    return this.state.opening || this.state.closing;
  }

  /**
   * Clears transient timers before running an action.
   * @param {{ clearSave?: boolean }} [options] Optional cleanup flags.
   * @returns {void}
   */
  prepare(options = {}) {
    this.clearStatus();
    if (options.clearSave) {
      this.clearSave();
    }
  }

  /**
   * Reads open browser tabs and handles user-visible errors.
   * @returns {Promise<BrowserTab[] | null>} Tabs list or `null` on failure.
   */
  async readTabs() {
    try {
      return await this.tabs.list();
    } catch (_error) {
      this.flash(this.text.readTabsError());
      return null;
    }
  }

  /**
   * Runs an async task while toggling busy state and forcing control re-render.
   * @template T
   * @param {'opening' | 'closing'} key State key to toggle for task lifetime.
   * @param {() => Promise<T>} task Async operation to execute.
   * @returns {Promise<T>}
   */
  async withBusy(key, task) {
    this.state[key] = true;
    this.render(true);
    try {
      return await task();
    } finally {
      this.state[key] = false;
      this.render(true);
    }
  }

  /**
   * Displays temporary status text and restores default summary after timeout.
   * @param {string} message Status text to display.
   * @returns {void}
   */
  flash(message) {
    this.clearStatus();
    this.view.setStatus(message);
    this.state.statusTimer = setTimeout(() => {
      this.state.statusTimer = null;
      this.render(false);
    }, this.statusMs);
  }

  /**
   * Persists text/filter values with debounce to reduce storage writes.
   * @returns {void}
   */
  queueSave() {
    this.clearSave();
    const text = this.view.getText();
    const filter = this.view.getFilter();
    this.state.saveTimer = setTimeout(async () => {
      this.state.saveTimer = null;
      try {
        await Promise.all([
          this.textStore.set(text),
          this.filterStore.set(filter)
        ]);
      } catch (_error) {
        this.flash(this.text.saveError());
      }
    }, this.saveDelayMs);
  }

  /**
   * Handles text and filter input changes.
   * @returns {void}
   */
  onTextChange() {
    this.prepare();
    this.queueSave();
    this.render(false);
  }

  /**
   * Captures currently open tabs, applies optional filter, and stores resulting URL list.
   * @returns {Promise<void>}
   */
  async onCapture() {
    if (this.state.opening) {
      return;
    }

    this.prepare({ clearSave: true });
    const tabs = await this.readTabs();
    if (!tabs) {
      return;
    }

    const filter = this.view.getFilter();
    const parsedFilter = this.parser.parseFilter(filter);
    if (parsedFilter.error) {
      this.flash(this.text.invalidRegex());
      return;
    }

    const urls = this.parser.tabsToUrls(tabs, parsedFilter.regex);

    this.view.setText(urls.join('\n'));
    try {
      await Promise.all([
        this.textStore.set(this.view.getText()),
        this.filterStore.set(filter)
      ]);
    } catch (_error) {
      this.render(false);
      this.flash(this.text.captureSaveError());
      return;
    }
    this.render(false);
    this.flash(this.text.captured(urls.length));
  }

  /**
   * Clears stored links and text input content.
   * @returns {Promise<void>}
   */
  async onClear() {
    if (this.state.opening) {
      return;
    }

    this.prepare({ clearSave: true });
    try {
      await this.textStore.clear();
    } catch (_error) {
      this.flash(this.text.clearError());
      return;
    }
    this.view.setText('');
    this.view.focusText();
    this.render(false);
  }

  /**
   * Copies current text input content to clipboard.
   * @returns {Promise<void>}
   */
  async onCopy() {
    if (this.state.opening) {
      return;
    }

    this.prepare();
    const text = this.view.getText();
    if (!text.trim()) {
      this.flash(this.text.nothingToCopy());
      return;
    }

    try {
      await this.copyText(text);
      this.flash(this.text.copied());
    } catch (_error) {
      this.flash(this.text.copyError());
    }
  }

  /**
   * Opens each listed URL in background tabs, replacing inactive duplicates.
   * @returns {Promise<void>}
   */
  async onOpen() {
    if (this.busy()) {
      return;
    }

    this.prepare();

    const urls = this.parser.unique(this.view.getText());
    if (!urls.length) {
      this.flash(this.text.noUrls());
      return;
    }

    const doneMessage = await this.withBusy('opening', async () => {
      this.view.setStatus(this.text.opening());
      try {
        const opened = await this.opener.open(
          urls,
          (openedCount, totalCount) => {
            this.view.setStatus(this.text.openingProgress(openedCount, totalCount));
          }
        );
        return this.text.opened(opened);
      } catch (_error) {
        return this.text.openError();
      }
    });

    this.flash(doneMessage);
  }

  /**
   * Closes inactive browser tabs that match URLs currently listed in text input.
   * @returns {Promise<void>}
   */
  async onClose() {
    if (this.busy()) {
      return;
    }

    this.prepare();

    const urls = this.parser.unique(this.view.getText());
    if (!urls.length) {
      this.flash(this.text.noUrls());
      return;
    }

    const tabs = await this.readTabs();
    if (!tabs) {
      return;
    }

    const listedSet = new Set(urls);
    const listedIds = tabs
      .filter((tab) => (
        typeof tab.id === 'number'
        && !tab.active
        && typeof tab.url === 'string'
        && listedSet.has(tab.url)
      ))
      .map((tab) => tab.id);
    if (!listedIds.length) {
      this.flash(this.text.noTabsToClose());
      return;
    }

    const doneMessage = await this.withBusy('closing', async () => {
      this.view.setStatus(this.text.closing(listedIds.length));
      try {
        await this.tabs.close(listedIds);
        return this.text.closed(listedIds.length);
      } catch (_error) {
        return this.text.closeError();
      }
    });

    this.flash(doneMessage);
  }
}
