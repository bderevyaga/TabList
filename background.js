import { createUrlParser } from './popup/parsers/url-parser.js';
import { callChrome } from './popup/utils/call-chrome.js';

const parser = createUrlParser();
const ADD_PAGE_LINK_MENU_ID = 'add-page-link';
const STORAGE_KEYS = ['workspaces', 'activeWorkspaceId', 'text'];

const getStorage = () => callChrome((callback) => {
  chrome.storage.local.get(STORAGE_KEYS, callback);
});

const setStorage = (items) => callChrome((callback) => {
  chrome.storage.local.set(items, callback);
});

const getActiveWorkspace = (data) => {
  const workspaces = Array.isArray(data.workspaces) ? data.workspaces : [];
  return workspaces.find((workspace) => workspace?.id === data.activeWorkspaceId) || workspaces[0];
};

const appendUniqueLink = (text, url) => {
  const currentText = typeof text === 'string' ? text : '';
  if (parser.unique(currentText).includes(url)) {
    return currentText;
  }

  return currentText.trim() ? `${currentText.trimEnd()}\n${url}` : url;
};

const updateBadge = async () => {
  try {
    const data = await getStorage();
    const workspace = getActiveWorkspace(data);
    const text = typeof workspace?.text === 'string'
      ? workspace.text
      : typeof data.text === 'string' ? data.text : '';
    chrome.action.setBadgeText({ text: String(parser.unique(text).length) });
  } catch (_error) {
    // The next storage change or worker start retries the update.
  }
};

const addPageLink = async ({ pageUrl }) => {
  if (!parser.isHttpUrl(pageUrl)) {
    return;
  }

  try {
    const data = await getStorage();
    const workspace = getActiveWorkspace(data);
    const currentText = workspace?.text ?? data.text;
    const updatedText = appendUniqueLink(currentText, pageUrl);

    if (updatedText === currentText) {
      return;
    }

    if (workspace) {
      workspace.text = updatedText;
      await setStorage({ workspaces: data.workspaces, activeWorkspaceId: workspace.id });
      return;
    }

    await setStorage({ text: updatedText });
  } catch (_error) {
    // Storage access failures should not interrupt the browser context menu.
  }
};

const createContextMenu = () => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: ADD_PAGE_LINK_MENU_ID,
      title: 'Add page to TabList',
      contexts: ['page']
    });
  });
};

chrome.runtime.onInstalled.addListener(() => {
  createContextMenu();
  void updateBadge();
});
chrome.runtime.onStartup.addListener(() => void updateBadge());
chrome.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId === ADD_PAGE_LINK_MENU_ID) {
    void addPageLink(info);
  }
});
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && (changes.workspaces || changes.activeWorkspaceId || changes.text)) {
    void updateBadge();
  }
});

void updateBadge();
