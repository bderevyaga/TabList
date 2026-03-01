export class UrlListParser {
  constructor(urlMatchPattern, httpUrlPattern) {
    this.urlMatchPattern = urlMatchPattern;
    this.httpUrlPattern = httpUrlPattern;
  }

  extractUrls(text) {
    return text.match(this.urlMatchPattern) || [];
  }

  extractUniqueUrls(text) {
    return this.getUniqueValues(this.extractUrls(text));
  }

  countNonEmptyLines(text) {
    return text.split(/\r?\n/).filter((line) => line.trim().length > 0).length;
  }

  extractHttpUrlsFromTabs(tabs, captureFilterRegex = null) {
    const urls = tabs
      .filter((tab) => {
        const tabUrl = typeof tab.url === 'string' ? tab.url : '';
        return this.httpUrlPattern.test(tabUrl) && this.matchesCaptureFilter(tabUrl, captureFilterRegex);
      })
      .map((tab) => tab.url);
    return this.getUniqueValues(urls);
  }

  parseCaptureFilterRegex(filterText) {
    const normalizedFilterText = String(filterText || '').trim();
    if (!normalizedFilterText) {
      return { regex: null, error: null };
    }

    const slashDelimitedRegexMatch = normalizedFilterText.match(/^\/(.+)\/([a-z]*)$/);
    try {
      if (slashDelimitedRegexMatch) {
        return {
          regex: new RegExp(slashDelimitedRegexMatch[1], slashDelimitedRegexMatch[2]),
          error: null
        };
      }
      return { regex: new RegExp(normalizedFilterText), error: null };
    } catch (error) {
      return { regex: null, error: error };
    }
  }

  matchesCaptureFilter(tabUrl, captureFilterRegex) {
    if (!captureFilterRegex) {
      return true;
    }

    captureFilterRegex.lastIndex = 0;
    return captureFilterRegex.test(tabUrl);
  }

  getUniqueValues(values) {
    return [...new Set(values)];
  }
}
