/**
 * Wraps a callback-based Chrome API call into a Promise and converts runtime errors
 * from `chrome.runtime.lastError` into rejected promises.
 * @template T
 * @param {(callback: (result?: T) => void) => void} registerCall Function that performs Chrome API call.
 * @returns {Promise<T | undefined>}
 */
export const callChrome = (registerCall) => new Promise((resolve, reject) => {
  registerCall((result) => {
    const error = chrome.runtime.lastError;
    if (error) {
      reject(new Error(error.message));
      return;
    }
    resolve(result);
  });
});
