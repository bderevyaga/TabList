/**
 * @typedef {Object} ViewHandlers
 * @property {() => void} onCapture Called when the "capture links" button is clicked.
 * @property {() => void} onTextInput Called when text input content changes.
 * @property {() => void} onFilterInput Called when filter input content changes.
 * @property {() => void} onCopy Called when the "copy" button is clicked.
 * @property {() => void} onClear Called when the "clear" button is clicked.
 * @property {() => void} onClose Called when the "close links" button is clicked.
 * @property {() => void} onOpen Called when the "open links" button is clicked.
 * @property {() => void} onToggleTheme Called when the "toggle theme" button is clicked.
 */

/**
 * @typedef {Object} ViewControlsState
 * @property {boolean} isBusy Whether an async operation is currently in progress.
 * @property {boolean} hasUrls Whether at least one valid URL is parsed from text input.
 * @property {boolean} hasText Whether text input has any non-whitespace content.
 */

export class View {
  /**
   * @param {Document} doc Popup document used to locate UI elements.
   */
  constructor(doc) {
    this.documentElement = doc.documentElement;
    this.textInput = doc.getElementById('text-input');
    this.filterInput = doc.getElementById('filter-input');
    this.themeToggleBtn = doc.getElementById('theme-toggle-button');

    this.copyBtn = doc.getElementById('copy-text-button');
    this.clearBtn = doc.getElementById('clear-text-button');

    this.openBtn = doc.getElementById('open-links-button');
    this.captureBtn = doc.getElementById('capture-links-button');
    this.closeBtn = doc.getElementById('close-links-button');

    this.countEl = doc.getElementById('link-count');
    this.statusEl = doc.getElementById('status-message');
  }

  /**
   * Binds UI events to controller callbacks.
   * @param {ViewHandlers} handlers Event handlers provided by controller.
   * @returns {void}
   */
  bind(handlers) {
    this.textInput.addEventListener('input', handlers.onTextInput);
    this.filterInput.addEventListener('input', handlers.onFilterInput);

    this.copyBtn.addEventListener('click', handlers.onCopy);
    this.clearBtn.addEventListener('click', handlers.onClear);

    this.captureBtn.addEventListener('click', handlers.onCapture);
    this.closeBtn.addEventListener('click', handlers.onClose);
    this.openBtn.addEventListener('click', handlers.onOpen);
    this.themeToggleBtn.addEventListener('click', handlers.onToggleTheme);
  }

  /**
   * Updates the UI to reflect a given theme.
   * @param {'light' | 'dark'} theme 
   * @returns {void}
   */
  setTheme(theme) {
    const el = this.documentElement;

    el.classList.remove('theme-light', 'theme-dark');
    if (theme !== 'auto') el.classList.add(`theme-${theme}`);

    const icons = {
      dark: '🌙',
      light: '☀️',
      auto: '🌗',
    };

    this.themeToggleBtn.textContent = icons[theme] || icons.auto;
  }

  /**
   * @returns {string} Current raw text input value.
   */
  getText() {
    return this.textInput.value;
  }

  /**
   * @returns {string} Current capture filter input value.
   */
  getFilter() {
    return this.filterInput.value;
  }

  /**
   * @param {string} text Full text to place into text input.
   * @returns {void}
   */
  setText(text) {
    this.textInput.value = text;
  }

  /**
   * @param {string} text Full text to place into filter input.
   * @returns {void}
   */
  setFilter(text) {
    this.filterInput.value = text;
  }

  /**
   * Moves focus to text input.
   * @returns {void}
   */
  focusText() {
    this.textInput.focus();
  }

  /**
   * @param {string} text Counter label to show above action buttons.
   * @returns {void}
   */
  setCount(text) {
    this.countEl.textContent = text;
  }

  /**
   * @param {string} text Status message shown to the user.
   * @returns {void}
   */
  setStatus(text) {
    this.statusEl.textContent = text;
  }

  /**
   * Updates disabled states of all controls according to current app state.
   * @param {ViewControlsState} state Rendered controls state.
   * @returns {void}
   */
  setControls(state) {
    this.textInput.disabled = state.isBusy;
    this.filterInput.disabled = state.isBusy;

    this.copyBtn.disabled = state.isBusy || !state.hasText;
    this.clearBtn.disabled = state.isBusy || !state.hasText;

    this.captureBtn.disabled = state.isBusy;
    this.openBtn.disabled = state.isBusy || !state.hasUrls;
    this.closeBtn.disabled = state.isBusy || !state.hasUrls;
  }
}
