/**
 * @typedef {Object} NavigatorClipboardLike
 * @property {{ writeText?: (text: string) => Promise<void> }} [clipboard] Clipboard API subset.
 */

/**
 * Builds async clipboard writer with modern API and legacy fallback.
 * @param {Document} doc Document used for DOM-based fallback copy.
 * @param {NavigatorClipboardLike} nav Navigator-like object with optional clipboard API.
 * @returns {(text: string) => Promise<void>} Async function that writes text to clipboard.
 */
export const createClipboardWriter = (doc, nav) => {
  const clipboard = nav.clipboard;
  if (clipboard && typeof clipboard.writeText === 'function') {
    return (text) => clipboard.writeText(text);
  }

  /**
   * Fallback copy implementation using temporary hidden textarea and `execCommand`.
   * @param {string} text Text to copy.
   * @returns {Promise<void>}
   */
  return async (text) => {
    const copyTextarea = doc.createElement('textarea');
    copyTextarea.value = text;
    copyTextarea.setAttribute('readonly', '');
    copyTextarea.style.position = 'fixed';
    copyTextarea.style.top = '-1000px';
    copyTextarea.style.left = '-1000px';
    doc.body.appendChild(copyTextarea);

    let didCopy = false;
    try {
      copyTextarea.focus();
      copyTextarea.select();
      didCopy = doc.execCommand('copy');
    } finally {
      copyTextarea.remove();
    }

    if (!didCopy) {
      throw new Error('Copy command failed');
    }
  };
};
