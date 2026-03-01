export const createClipboardTextWriter = (documentRef, navigatorRef) => {
  const clipboard = navigatorRef.clipboard;
  if (clipboard && typeof clipboard.writeText === 'function') {
    return (text) => clipboard.writeText(text);
  }

  return async (text) => {
    const clipboardFallbackTextarea = documentRef.createElement('textarea');
    clipboardFallbackTextarea.value = text;
    clipboardFallbackTextarea.setAttribute('readonly', '');
    clipboardFallbackTextarea.style.position = 'fixed';
    clipboardFallbackTextarea.style.top = '-1000px';
    clipboardFallbackTextarea.style.left = '-1000px';
    documentRef.body.appendChild(clipboardFallbackTextarea);

    let didCopy = false;
    try {
      clipboardFallbackTextarea.focus();
      clipboardFallbackTextarea.select();
      didCopy = documentRef.execCommand('copy');
    } finally {
      clipboardFallbackTextarea.remove();
    }

    if (!didCopy) {
      throw new Error('Copy command failed');
    }
  };
};
