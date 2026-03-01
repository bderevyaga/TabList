import { UrlListParser } from './parsers/url-list-parser.js';
import { PopupTextFormatter } from './formatters/popup-text-formatter.js';
import { SavedLinksStorage } from './storage/saved-links-storage.js';
import { BrowserTabsService } from './services/browser-tabs-service.js';
import { TabsBatchOpener } from './services/tabs-batch-opener.js';
import { PopupDomView } from './view/popup-dom-view.js';
import { PopupUiController } from './controllers/popup-ui-controller.js';
import { createTimeoutDelay } from './utils/create-timeout-delay.js';
import { createClipboardTextWriter } from './utils/create-clipboard-text-writer.js';

document.addEventListener('DOMContentLoaded', async () => {
  const urlParser = new UrlListParser(/https?:\/\/[^\s]+/g, /^https?:\/\//);
  const textFormatter = new PopupTextFormatter();
  const savedLinksStorage = new SavedLinksStorage(chrome.storage.local, 'text');
  const captureFilterStorage = new SavedLinksStorage(chrome.storage.local, 'captureFilter');
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
      captureFilterStorage: captureFilterStorage,
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
