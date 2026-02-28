document.addEventListener("DOMContentLoaded", () => {
  const input = document.getElementById('input');
  const open = document.getElementById('open');
  const tabs = document.getElementById('tabs');
  const clear = document.getElementById('clear');
  const status = document.getElementById('status');
  const summary = document.getElementById('summary');
  let summaryTimer = null;
  let isOpening = false;

  const OPEN_BATCH_SIZE = 6;
  const OPEN_BATCH_DELAY_MS = 120;
  const LARGE_OPEN_CONFIRM_THRESHOLD = 30;

  const extractUrls = (text) => text.match(/https?:\/\/[^\s]+/g) || [];
  const pluralize = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`;

  const saveText = () => {
    chrome.storage.local.set({ text: input.value });
  };

  const updateUi = () => {
    const urls = extractUrls(input.value);
    const lines = input.value.split(/\r?\n/).filter((line) => line.trim().length > 0).length;

    status.textContent = pluralize(urls.length, 'link');
    if (lines === 0) {
      summary.textContent = 'Add URLs or capture your current tabs.';
    } else {
      summary.textContent = `${pluralize(urls.length, 'valid URL')} across ${pluralize(lines, 'line')}.`;
    }

    open.disabled = isOpening || urls.length === 0;
    tabs.disabled = isOpening;
    clear.disabled = isOpening || input.value.trim().length === 0;
    input.disabled = isOpening;
  };

  const setTemporarySummary = (message) => {
    summary.textContent = message;
    if (summaryTimer) {
      clearTimeout(summaryTimer);
    }
    summaryTimer = setTimeout(updateUi, 1600);
  };

  const delay = (ms) => new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

  const createTab = (url) => new Promise((resolve) => {
    chrome.tabs.create(
      {
        url: url,
        active: false
      },
      () => resolve()
    );
  });

  const openUrlsInBatches = async (urls) => {
    for (let i = 0; i < urls.length; i += OPEN_BATCH_SIZE) {
      const batch = urls.slice(i, i + OPEN_BATCH_SIZE);
      await Promise.all(batch.map((url) => createTab(url)));

      const openedCount = Math.min(i + OPEN_BATCH_SIZE, urls.length);
      summary.textContent = `Opening ${openedCount}/${urls.length} tabs...`;

      if (openedCount < urls.length) {
        await delay(OPEN_BATCH_DELAY_MS);
      }
    }
  };

  tabs.addEventListener('click', () => {
    chrome.tabs.query({}, (allTabs) => {
      const urls = [...new Set(
        allTabs
          .map((tab) => tab.url || '')
          .filter((url) => /^https?:\/\//.test(url))
      )];

      input.value = urls.join('\n');
      saveText();
      updateUi();
      setTemporarySummary(`Captured ${pluralize(urls.length, 'tab')}.`);
    });
  });


  chrome.storage.local.get(['text'], (result) => {
    if (typeof result.text === 'string') {
      input.value = result.text;
    }
    updateUi();
  });

  input.addEventListener('input', () => {
    saveText();
    updateUi();
  });

  clear.addEventListener('click', () => {
    chrome.storage.local.remove(['text'], () => {
      input.value = '';
      updateUi();
      input.focus();
    });
  });

  open.addEventListener('click', async () => {
    const urls = [...new Set(extractUrls(input.value))];

    if (!urls.length || isOpening) {
      updateUi();
      return;
    }

    if (urls.length >= LARGE_OPEN_CONFIRM_THRESHOLD) {
      const shouldOpen = confirm(`Open ${urls.length} tabs? This may take a few seconds.`);
      if (!shouldOpen) {
        setTemporarySummary('Opening canceled.');
        return;
      }
    }

    isOpening = true;
    updateUi();
    summary.textContent = `Opening 0/${urls.length} tabs...`;

    try {
      await openUrlsInBatches(urls);
      setTemporarySummary(`Opened ${pluralize(urls.length, 'tab')}.`);
    } finally {
      isOpening = false;
      updateUi();
    }
  });
});
