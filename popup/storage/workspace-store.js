import { callChrome } from '../utils/call-chrome.js';

/**
 * @typedef {Object} Workspace
 * @property {string} id Unique identifier for the list.
 * @property {string} name Human-readable name.
 * @property {string} text Text content containing URLs.
 * @property {string} filter Regex filter applied during capture.
 */

/**
 * @typedef {Object} WorkspacesData
 * @property {Workspace[]} lists Array of user lists.
 * @property {string} activeId Currently active list ID.
 */

export class WorkspaceStore {
  /**
   * @param {chrome.storage.StorageArea} area `chrome.storage.*` area adapter.
   */
  constructor(area) {
    this.area = area;
  }

  /**
   * Loads workspaces from storage. If this is the first time, migrates existing 'text' and 'filter' keys into a 'Default' list.
   * @returns {Promise<WorkspacesData>}
   */
  async load() {
    /** @type {Record<string, unknown>} */
    const result = /** @type {Record<string, unknown>} */ (
      await callChrome((callback) => {
        this.area.get(['workspaces', 'activeWorkspaceId', 'text', 'filter'], callback);
      })
    );

    let workspaces = /** @type {Workspace[] | undefined} */ (result.workspaces);
    let activeId = /** @type {string | undefined} */ (result.activeWorkspaceId);

    if (!workspaces || !Array.isArray(workspaces) || workspaces.length === 0) {
      const oldText = typeof result.text === 'string' ? result.text : '';
      const oldFilter = typeof result.filter === 'string' ? result.filter : '';

      const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString();

      const defaultWorkspace = {
        id,
        name: 'Default',
        text: oldText,
        filter: oldFilter
      };

      workspaces = [defaultWorkspace];
      activeId = id;

      await this.save(workspaces, activeId);
    }

    if (!activeId || !workspaces.find(w => w.id === activeId)) {
      activeId = workspaces[0].id;
      await this.save(workspaces, activeId);
    }

    return { lists: workspaces, activeId };
  }

  /**
   * Persists the current workspaces array and active session.
   * @param {Workspace[]} workspaces Array of all lists.
   * @param {string} activeId Currently selected list ID.
   * @returns {Promise<void>}
   */
  save(workspaces, activeId) {
    return /** @type {Promise<void>} */ (
      callChrome((callback) => {
        this.area.set({ workspaces, activeWorkspaceId: activeId }, callback);
      })
    );
  }
}
