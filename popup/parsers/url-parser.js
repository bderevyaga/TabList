/**
 * @typedef {Object} BrowserTabLike
 * @property {string} [url] Tab URL value.
 */

/**
 * @typedef {Object} ParsedFilter
 * @property {RegExp | null} regex Parsed filter regex or `null` when no filter is provided.
 * @property {Error | null} error Parsing error for invalid regex input.
 */

export class UrlParser {
  /**
   * @param {RegExp} urlMatchPattern Global regex used to extract URLs from free-form text.
   * @param {RegExp} httpUrlPattern Regex used to validate tab URLs before capture.
   */
  constructor(urlMatchPattern, httpUrlPattern) {
    this.urlMatchPattern = urlMatchPattern;
    this.httpUrlPattern = httpUrlPattern;
  }

  /**
   * Extracts URL-like fragments from text.
   * @param {string} text User input that may contain URLs.
   * @returns {string[]} Matched URL fragments.
   */
  urls(text) {
    return text.match(this.urlMatchPattern) || [];
  }

  /**
   * Checks whether a value is an HTTP(S) URL.
   * @param {unknown} value Value to validate.
   * @returns {boolean} Whether the value is a supported URL.
   */
  isHttpUrl(value) {
    return typeof value === 'string' && this.httpUrlPattern.test(value);
  }

  /**
   * Extracts and deduplicates URLs from text while preserving first occurrence order.
   * @param {string} text Raw textarea content.
   * @returns {string[]} Unique URL list.
   */
  unique(text) {
    return this.uniqueValues(this.urls(text));
  }

  /**
   * Removes exact URL matches while preserving all other input text.
   * @param {string} text Raw textarea content.
   * @param {string} url URL to remove.
   * @returns {string} Updated text.
   */
  withoutUrl(text, url) {
    return text.replace(this.urlMatchPattern, (match) => match === url ? '' : match);
  }

  /**
   * Counts non-empty lines in text.
   * @param {string} text Raw textarea content.
   * @returns {number} Number of lines containing non-whitespace characters.
   */
  lineCount(text) {
    return text.split(/\r?\n/).filter((line) => line.trim().length > 0).length;
  }

  /**
   * Converts browser tabs into a unique list of HTTP(S) URLs.
   * @param {BrowserTabLike[]} tabs Browser tab objects.
   * @param {RegExp | null} [filterRegex=null] Optional regex to include matching URLs only.
   * @returns {string[]} Unique filtered URLs.
   */
  tabsToUrls(tabs, filterRegex = null) {
    const urls = tabs
      .filter((tab) => {
        const url = typeof tab.url === 'string' ? tab.url : '';
        return this.isHttpUrl(url) && this.matchFilter(url, filterRegex);
      })
      .map((tab) => tab.url);
    return this.uniqueValues(urls);
  }

  /**
   * Parses user-provided filter text into a RegExp.
   * Supports plain syntax (`example\\.com`) and slash syntax (`/example\\.com/i`).
   * @param {string} filter Raw filter text from input.
   * @returns {ParsedFilter}
   */
  parseFilter(filter) {
    const normalized = String(filter || '').trim();
    if (!normalized) {
      return { regex: null, error: null };
    }

    const slashMatch = normalized.match(/^\/(.+)\/([a-z]*)$/);
    try {
      if (slashMatch) {
        return {
          regex: new RegExp(slashMatch[1], slashMatch[2]),
          error: null
        };
      }
      return { regex: new RegExp(normalized), error: null };
    } catch (error) {
      return { regex: null, error: error };
    }
  }

  /**
   * Checks whether URL matches a filter regex.
   * @param {string} url URL to test.
   * @param {RegExp | null} filterRegex Filter regex or `null` to match all URLs.
   * @returns {boolean}
   */
  matchFilter(url, filterRegex) {
    if (!filterRegex) {
      return true;
    }

    filterRegex.lastIndex = 0;
    return filterRegex.test(url);
  }

  /**
   * Deduplicates array values while preserving insertion order.
   * @param {string[]} values Values to deduplicate.
   * @returns {string[]}
   */
  uniqueValues(values) {
    return [...new Set(values)];
  }
}

/**
 * Creates the URL parser shared by the popup and background worker.
 * @returns {UrlParser} Configured URL parser.
 */
export const createUrlParser = () => new UrlParser(/https?:\/\/[^\s]+/g, /^https?:\/\//);
