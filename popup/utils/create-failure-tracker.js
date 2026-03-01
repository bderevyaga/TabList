/**
 * Creates a tiny stateful helper for collecting failure state across async branches.
 * @template T
 * @returns {{
 *   markFailed: (fallback: T) => (() => T),
 *   hasFailed: () => boolean
 * }}
 */
export const createFailureTracker = () => {
  let failed = false;

  const markFailed = (fallback) => () => {
    failed = true;
    return fallback;
  };

  return {
    markFailed,
    hasFailed: () => failed
  };
};
