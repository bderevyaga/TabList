export class Text {
  /**
   * Builds a pluralized fragment in the form `"{count} {word}[s]"`.
   * @param {number} count Amount for pluralization.
   * @param {string} word Base singular word.
   * @returns {string}
   */
  plural(count, word) {
    return `${count} ${word}${count === 1 ? '' : 's'}`;
  }

  /**
   * @param {number} count Number of valid links.
   * @returns {string}
   */
  linkCount(count) {
    return this.plural(count, 'link');
  }

  /**
   * Creates summary status line for current textarea state.
   * @param {number} urlCount Number of parsed valid URLs.
   * @param {number} lineCount Number of non-empty lines in textarea.
   * @returns {string}
   */
  summary(urlCount, lineCount) {
    if (lineCount === 0) {
      return 'Add URLs or capture your current tabs.';
    }

    return `${this.plural(urlCount, 'valid URL')} across ${this.plural(lineCount, 'line')}.`;
  }

  /**
   * @param {number} count Number of captured tabs.
   * @returns {string}
   */
  captured(count) {
    return `Captured ${this.plural(count, 'tab')}.`;
  }

  /**
   * @param {number} openedCount Number of tabs already opened.
   * @param {number} totalCount Total tabs that need opening.
   * @returns {string}
   */
  openingProgress(openedCount, totalCount) {
    return `Opening ${openedCount}/${totalCount} tabs...`;
  }

  /**
   * @returns {string}
   */
  opening() {
    return 'Opening tabs...';
  }

  /**
   * @param {number} count Number of newly opened tabs.
   * @returns {string}
   */
  opened(count) {
    return `Opened ${this.plural(count, 'tab')}.`;
  }

  /**
   * @returns {string}
   */
  copied() {
    return 'Copied to clipboard.';
  }

  /**
   * @returns {string}
   */
  loadError() {
    return 'Failed to load saved data.';
  }

  /**
   * @returns {string}
   */
  readTabsError() {
    return 'Failed to read open tabs.';
  }

  /**
   * @returns {string}
   */
  saveError() {
    return 'Failed to save data.';
  }

  /**
   * @returns {string}
   */
  invalidRegex() {
    return 'Invalid URL regex filter.';
  }

  /**
   * @returns {string}
   */
  captureSaveError() {
    return 'Tabs captured but failed to save.';
  }

  /**
   * @returns {string}
   */
  clearError() {
    return 'Failed to clear links.';
  }

  /**
   * @returns {string}
   */
  nothingToCopy() {
    return 'Nothing to copy.';
  }

  /**
   * @returns {string}
   */
  copyError() {
    return 'Failed to copy text.';
  }

  /**
   * @returns {string}
   */
  openError() {
    return 'Failed to open tabs.';
  }

  /**
   * @returns {string}
   */
  noUrls() {
    return 'No URLs in the list.';
  }

  /**
   * @returns {string}
   */
  closing() {
    return 'Closing tabs...';
  }

  /**
   * @param {number} closedCount Number of tabs already closed.
   * @param {number} totalCount Total tabs that need closing.
   * @returns {string}
   */
  closingProgress(closedCount, totalCount) {
    return `Closing ${closedCount}/${totalCount} tabs...`;
  }

  /**
   * @returns {string}
   */
  closeError() {
    return 'Failed to close tabs.';
  }

  /**
   * @param {number} count Number of closed tabs.
   * @returns {string}
   */
  closed(count) {
    return `Closed ${this.plural(count, 'tab')}.`;
  }
}
