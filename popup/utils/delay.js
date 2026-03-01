/**
 * Async timeout helper.
 * @param {number} ms Delay duration in milliseconds.
 * @returns {Promise<void>} Resolves after provided delay.
 */
export const delay = (ms) => new Promise((resolve) => {
  setTimeout(resolve, ms);
});
