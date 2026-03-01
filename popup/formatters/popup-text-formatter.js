export class PopupTextFormatter {
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

  formatLoadSavedDataError() {
    return 'Failed to load saved data.';
  }

  formatReadOpenTabsError() {
    return 'Failed to read open tabs.';
  }

  formatSaveDataError() {
    return 'Failed to save data.';
  }

  formatInvalidUrlRegexFilter() {
    return 'Invalid URL regex filter.';
  }

  formatCaptureTabsSaveError() {
    return 'Tabs captured but failed to save.';
  }

  formatClearLinksError() {
    return 'Failed to clear links.';
  }

  formatNothingToCopy() {
    return 'Nothing to copy.';
  }

  formatCopyTextError() {
    return 'Failed to copy text.';
  }

  formatOpenTabsError() {
    return 'Failed to open tabs.';
  }

  formatNoUrlsInList() {
    return 'No URLs in the list.';
  }

  formatNoListedTabsToClose() {
    return 'No listed tabs to close.';
  }

  formatClosingTabs(count) {
    return `Closing ${this.pluralize(count, 'tab')}...`;
  }

  formatCloseTabsError() {
    return 'Failed to close tabs.';
  }

  formatClosedTabs(count) {
    return `Closed ${this.pluralize(count, 'tab')}.`;
  }
}
