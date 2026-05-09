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
 * @property {import('../services/tabs-service.js').TabsService} tabs Browser tabs service.
 * @property {import('../services/url-service.js').UrlService} urlService URL tabs orchestration service.
 * @property {import('../storage/workspace-store.js').WorkspaceStore} workspaceStore Storage for saving workspaces.
 * @property {import('../storage/store.js').Store} themeStore Storage for theme preference.
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
 * @property {ReturnType<typeof setTimeout> | null} statusTimer Active status timer.
 * @property {ReturnType<typeof setTimeout> | null} saveTimer Active save timer.
 * @property {'auto' | 'light' | 'dark'} theme Current active theme mode.
 * @property {import('../storage/workspace-store.js').Workspace[]} workspaces The workspace list.
 * @property {string} activeWorkspaceId Currently active workspace ID.
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
    this.workspaceStore = deps.workspaceStore;
    this.themeStore = deps.themeStore;
    this.tabs = deps.tabs;
    this.urlService = deps.urlService;
    this.copyText = deps.copyText;
    this.statusMs = options.statusMs;
    this.saveDelayMs = options.saveDelayMs;

    /** @type {ControllerState} */
    this.state = {
      opening: false,
      closing: false,
      statusTimer: null,
      saveTimer: null,
      theme: 'auto',
      workspaces: [],
      activeWorkspaceId: ''
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
      onTextInput: onTextChange,
      onFilterInput: onTextChange,
      onCopy: () => this.onCopy(),
      onClear: () => this.onClear(),
      onClose: () => this.onClose(),
      onOpen: () => this.onOpen(),
      onToggleTheme: () => this.onToggleTheme(),
      onWorkspaceChange: () => this.onWorkspaceChange(),
      onWorkspaceAdd: () => this.onWorkspaceAdd(),
      onWorkspaceRename: () => this.onWorkspaceRename(),
      onWorkspaceRemove: () => this.onWorkspaceRemove()
    });

    const { markFailed, hasFailed } = createFailureTracker();

    const [workspaceData, theme] = await Promise.all([
      this.workspaceStore.load().catch(markFailed({ lists: [], activeId: '' })),
      this.themeStore.get().catch(markFailed(''))
    ]);

    this.state.workspaces = workspaceData.lists;
    this.state.activeWorkspaceId = workspaceData.activeId;

    this.state.theme = (theme === 'light' || theme === 'dark') ? theme : 'auto';
    this.view.setTheme(this.state.theme);

    this.loadActiveWorkspace();

    if (hasFailed()) {
      this.flash(this.text.loadError());
    }
  }

  /**
   * Pushes the active workspace's data into the UI.
   */
  loadActiveWorkspace() {
    const activeWs = this.state.workspaces.find(w => w.id === this.state.activeWorkspaceId);
    if (!activeWs) return;

    this.view.setText(activeWs.text);
    this.view.setFilter(activeWs.filter);
    this.view.setWorkspaces(this.state.workspaces, activeWs.id);
    this.render(false);
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
      hasText: text.trim().length > 0,
      canRemoveWorkspace: this.state.workspaces.length > 1
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
    
    // Update local state sync immediately to not lose data
    const activeWs = this.state.workspaces.find(w => w.id === this.state.activeWorkspaceId);
    if (activeWs) {
      activeWs.text = text;
      activeWs.filter = filter;
    }

    this.state.saveTimer = setTimeout(async () => {
      this.state.saveTimer = null;
      try {
        await this.workspaceStore.save(this.state.workspaces, this.state.activeWorkspaceId);
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

  async onWorkspaceChange() {
    if (this.busy()) return;
    this.prepare({ clearSave: true }); // Stop pending save from overwriting the next workspace
    
    this.state.activeWorkspaceId = this.view.workspaceSelect.value;
    
    // Immediately persist switch
    try {
      await this.workspaceStore.save(this.state.workspaces, this.state.activeWorkspaceId);
    } catch (_error) { }

    this.loadActiveWorkspace();
  }

  async onWorkspaceAdd() {
    if (this.busy()) return;
    this.prepare({ clearSave: true });
    
    const name = prompt('Enter a name for the new list:');
    if (!name || !name.trim()) return;

    const newWorkspace = {
      id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
      name: name.trim(),
      text: '',
      filter: ''
    };

    this.state.workspaces.push(newWorkspace);
    this.state.activeWorkspaceId = newWorkspace.id;

    try {
      await this.workspaceStore.save(this.state.workspaces, this.state.activeWorkspaceId);
      this.loadActiveWorkspace();
    } catch (_error) {
      this.flash('Failed to create list');
    }
  }

  async onWorkspaceRename() {
    if (this.busy()) return;
    this.prepare();

    const activeWs = this.state.workspaces.find(w => w.id === this.state.activeWorkspaceId);
    if (!activeWs) return;

    const newName = prompt('Rename the list:', activeWs.name);
    if (!newName || !newName.trim() || newName.trim() === activeWs.name) return;

    activeWs.name = newName.trim();
    this.view.setWorkspaces(this.state.workspaces, this.state.activeWorkspaceId);

    try {
      await this.workspaceStore.save(this.state.workspaces, this.state.activeWorkspaceId);
    } catch (_error) { }
  }

  async onWorkspaceRemove() {
    if (this.busy() || this.state.workspaces.length <= 1) return;
    this.prepare({ clearSave: true });

    const activeWs = this.state.workspaces.find(w => w.id === this.state.activeWorkspaceId);
    if (!activeWs) return;

    const confirmDelete = confirm(`Are you sure you want to delete the list "${activeWs.name}"?`);
    if (!confirmDelete) return;

    this.state.workspaces = this.state.workspaces.filter(w => w.id !== activeWs.id);
    this.state.activeWorkspaceId = this.state.workspaces[0].id;

    try {
      await this.workspaceStore.save(this.state.workspaces, this.state.activeWorkspaceId);
      this.loadActiveWorkspace();
    } catch (_error) {
      this.flash('Failed to delete list');
    }
  }

  /**
   * Toggles between auto, light, and dark modes.
   * @returns {Promise<void>}
   */
  async onToggleTheme() {
    const themes = ['auto', 'light', 'dark'];
    const index = themes.indexOf(this.state.theme);

    const nextTheme = themes[(index + 1) % themes.length];

    this.state.theme = nextTheme;
    this.view.setTheme(nextTheme);

    try {
      await this.themeStore.set(nextTheme);
    } catch { }
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
    
    // Update state synchronously for save
    const activeWs = this.state.workspaces.find(w => w.id === this.state.activeWorkspaceId);
    if (activeWs) {
      activeWs.text = this.view.getText();
      activeWs.filter = filter;
    }

    try {
      await this.workspaceStore.save(this.state.workspaces, this.state.activeWorkspaceId);
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
    
    const activeWs = this.state.workspaces.find(w => w.id === this.state.activeWorkspaceId);
    if (activeWs) {
      activeWs.text = '';
    }

    try {
      await this.workspaceStore.save(this.state.workspaces, this.state.activeWorkspaceId);
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
        const opened = await this.urlService.open(
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

    const doneMessage = await this.withBusy('closing', async () => {
      this.view.setStatus(this.text.closing());
      try {
        const closed = await this.urlService.close(
          urls,
          (closedCount, totalCount) => {
            this.view.setStatus(this.text.closingProgress(closedCount, totalCount));
          }
        );
        return this.text.closed(closed);
      } catch (_error) {
        return this.text.closeError();
      }
    });

    this.flash(doneMessage);
  }
}
