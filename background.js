import { createUrlParser } from './popup/parsers/url-parser.js';
import { WorkspaceStore } from './popup/storage/workspace-store.js';

const parser = createUrlParser();
const workspaceStore = new WorkspaceStore(chrome.storage.local);

const loadActiveWorkspace = async () => {
  const { lists, activeId } = await workspaceStore.load();
  return {
    lists,
    activeId,
    workspace: lists.find(({ id }) => id === activeId)
  };
};

const PAGE_MENU_ITEMS = [
  {
    id: 'add-page-link',
    title: 'Add',
    updateText: (text, url) => {
      const currentText = typeof text === 'string' ? text : '';
      if (parser.unique(currentText).includes(url)) {
        return currentText;
      }

      const trimmedText = currentText
        .split(/\r?\n/)
        .filter((line) => line.trim().length > 0)
        .join('\n');

      return trimmedText ? `${trimmedText}\n${url}` : url;
    }
  },
  {
    id: 'remove-page-link',
    title: 'Remove',
    updateText: (text, url) => parser.withoutUrl(text, url)
  }
];

const updateBadge = async () => {
  try {
    const { workspace } = await loadActiveWorkspace();
    chrome.action.setBadgeText({ text: String(parser.unique(workspace.text).length) });
  } catch (_error) {
    // The next storage change or worker start retries the update.
  }
};

const updatePageLink = async (pageUrl, updateText) => {
  if (!parser.isHttpUrl(pageUrl)) {
    return;
  }

  try {
    const { lists, activeId, workspace } = await loadActiveWorkspace();
    const currentText = workspace.text;
    const updatedText = updateText(currentText, pageUrl);

    if (updatedText === currentText) {
      return;
    }

    workspace.text = updatedText;
    await workspaceStore.save(lists, activeId);
  } catch (_error) {
    // Storage access failures should not interrupt the browser context menu.
  }
};

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    PAGE_MENU_ITEMS.forEach(({ id, title }) => {
      chrome.contextMenus.create({ id, title, contexts: ['page'] });
    });
  });
});
chrome.contextMenus.onClicked.addListener((info) => {
  const menuItem = PAGE_MENU_ITEMS.find(({ id }) => id === info.menuItemId);
  if (menuItem) {
    void updatePageLink(info.pageUrl, menuItem.updateText);
  }
});
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && (changes.workspaces || changes.activeWorkspaceId)) {
    void updateBadge();
  }
});

void updateBadge();
