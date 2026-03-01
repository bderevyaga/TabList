export class PopupUiController {
  constructor(dependencies, options) {
    this.popupView = dependencies.popupView;
    this.urlParser = dependencies.urlParser;
    this.textFormatter = dependencies.textFormatter;
    this.savedLinksStorage = dependencies.savedLinksStorage;
    this.captureFilterStorage = dependencies.captureFilterStorage;
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
      onCaptureFilterInputChange: () => this.handleCaptureFilterInputChange(),
      onCopyClick: () => this.handleCopyClick(),
      onClearClick: () => this.handleClearClick(),
      onCloseListedTabsClick: () => this.handleCloseListedTabsClick(),
      onOpenLinksClick: () => this.handleOpenLinksClick()
    });

    let savedLinksText = '';
    let savedCaptureFilterText = '';
    let isLoadFailed = false;
    try {
      savedLinksText = await this.savedLinksStorage.loadLinksText();
    } catch (_error) {
      isLoadFailed = true;
    }
    try {
      savedCaptureFilterText = await this.captureFilterStorage.loadLinksText();
    } catch (_error) {
      isLoadFailed = true;
    }

    this.popupView.setLinksText(savedLinksText);
    this.popupView.setCaptureFilterText(savedCaptureFilterText);
    this.renderUi(false);
    if (isLoadFailed) {
      this.showTemporaryStatus(this.textFormatter.formatLoadSavedDataError());
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
      this.showTemporaryStatus(this.textFormatter.formatReadOpenTabsError());
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
    const captureFilterText = this.popupView.getCaptureFilterText();
    this.uiState.autosaveTimer = setTimeout(async () => {
      this.uiState.autosaveTimer = null;
      try {
        await Promise.all([
          this.savedLinksStorage.saveLinksText(linksText),
          this.captureFilterStorage.saveLinksText(captureFilterText)
        ]);
      } catch (_error) {
        this.showTemporaryStatus(this.textFormatter.formatSaveDataError());
      }
    }, this.autosaveDelayMs);
  }

  handleInputChange() {
    this.prepareForUserAction();
    this.scheduleAutosave();
    this.renderUi(false);
  }

  handleCaptureFilterInputChange() {
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

    const captureFilterText = this.popupView.getCaptureFilterText();
    const captureFilterRegexParseResult = this.urlParser.parseCaptureFilterRegex(captureFilterText);
    if (captureFilterRegexParseResult.error) {
      this.showTemporaryStatus(this.textFormatter.formatInvalidUrlRegexFilter());
      return;
    }

    const capturedUrls = this.urlParser.extractHttpUrlsFromTabs(
      openTabs,
      captureFilterRegexParseResult.regex
    );

    this.popupView.setLinksText(capturedUrls.join('\n'));
    try {
      await Promise.all([
        this.savedLinksStorage.saveLinksText(this.popupView.getLinksText()),
        this.captureFilterStorage.saveLinksText(captureFilterText)
      ]);
    } catch (_error) {
      this.renderUi(false);
      this.showTemporaryStatus(this.textFormatter.formatCaptureTabsSaveError());
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
      this.showTemporaryStatus(this.textFormatter.formatClearLinksError());
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
      this.showTemporaryStatus(this.textFormatter.formatNothingToCopy());
      return;
    }

    try {
      await this.writeClipboardText(linksText);
      this.showTemporaryStatus(this.textFormatter.formatCopiedToClipboard());
    } catch (_error) {
      this.showTemporaryStatus(this.textFormatter.formatCopyTextError());
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
        return this.textFormatter.formatOpenTabsError();
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
      this.showTemporaryStatus(this.textFormatter.formatNoUrlsInList());
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
      this.showTemporaryStatus(this.textFormatter.formatNoListedTabsToClose());
      return;
    }

    const completionMessage = await this.runWithBusyState('isClosingListedTabs', async () => {
      this.popupView.setStatusMessageText(this.textFormatter.formatClosingTabs(listedTabIds.length));
      try {
        await this.tabsService.closeTabsByIds(listedTabIds);
        return this.textFormatter.formatClosedTabs(listedTabIds.length);
      } catch (_error) {
        return this.textFormatter.formatCloseTabsError();
      }
    });

    this.showTemporaryStatus(completionMessage);
  }
}
