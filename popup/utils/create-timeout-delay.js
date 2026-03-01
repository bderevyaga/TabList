export const createTimeoutDelay = (milliseconds) => new Promise((resolve) => {
  setTimeout(resolve, milliseconds);
});
