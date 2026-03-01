import { UrlParser } from './parsers/url-parser.js';
import { Text } from './formatters/text.js';
import { TextStore } from './storage/text-store.js';
import { TabsService } from './services/tabs-service.js';
import { UrlOpener } from './services/url-opener.js';
import { View } from './view/view.js';
import { Controller } from './controllers/controller.js';
import { delay } from './utils/delay.js';
import { createClipboardWriter } from './utils/create-clipboard-writer.js';

/**
 * Bootstraps popup dependencies and starts controller lifecycle once DOM is ready.
 */
document.addEventListener('DOMContentLoaded', async () => {
  /**
   * URL extraction config:
   * - first regex captures URL-like tokens from free-form text
   * - second regex validates tab URLs to keep HTTP(S) only
   */
  const parser = new UrlParser(/https?:\/\/[^\s]+/g, /^https?:\/\//);
  const text = new Text();
  const textStore = new TextStore(chrome.storage.local, 'text');
  const filterStore = new TextStore(chrome.storage.local, 'filter');
  const tabs = new TabsService(chrome.tabs);
  const copyText = createClipboardWriter(document, navigator);
  const opener = new UrlOpener(tabs, {
    batchSize: 6,
    batchDelayMs: 120,
    delayFn: delay
  });

  // `View` encapsulates all DOM selectors and state rendering.
  const view = new View(document);
  // `Controller` connects UI actions with parsing/storage/tab side effects.
  const controller = new Controller(
    {
      view: view,
      parser: parser,
      text: text,
      textStore: textStore,
      filterStore: filterStore,
      tabs: tabs,
      opener: opener,
      copyText: copyText
    },
    {
      statusMs: 1600,
      saveDelayMs: 350
    }
  );

  await controller.init();
});
