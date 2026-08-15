import { createUrlParser } from './parsers/url-parser.js';
import { Text } from './formatters/text.js';
import { Store } from './storage/store.js';
import { WorkspaceStore } from './storage/workspace-store.js';
import { TabsService } from './services/tabs-service.js';
import { UrlService } from './services/url-service.js';
import { View } from './view/view.js';
import { Controller } from './controllers/controller.js';
import { createClipboardWriter } from './utils/create-clipboard-writer.js';

/**
 * Bootstraps popup dependencies and starts controller lifecycle once DOM is ready.
 */
document.addEventListener('DOMContentLoaded', async () => {
  // Shared parser keeps popup and toolbar badge URL counting consistent.
  const parser = createUrlParser();
  
  const workspaceStore = new WorkspaceStore(chrome.storage.local);
  const themeStore = new Store(chrome.storage.local, 'theme');

  const text = new Text();
  const tabs = new TabsService(chrome.tabs);
  const urlService = new UrlService(tabs, {
    batchSize: 6,
    batchDelayMs: 120
  });

  // `View` encapsulates all DOM selectors and state rendering.
  const view = new View(document);
  // `Controller` connects UI actions with parsing/storage/tab side effects.
  const controller = new Controller(
    {
      view: view,
      parser: parser,
      text: text,
      workspaceStore: workspaceStore,
      themeStore: themeStore,
      tabs: tabs,
      urlService: urlService,
      copyText: createClipboardWriter(document, navigator)
    },
    {
      statusMs: 1600,
      saveDelayMs: 350
    }
  );

  await controller.init();
});
