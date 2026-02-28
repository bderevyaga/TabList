document.addEventListener("DOMContentLoaded", () => {
  const input = document.getElementById('input');
  const open = document.getElementById('open');
  const tabs = document.getElementById('tabs');
  const clear = document.getElementById('clear');
  const status = document.getElementById('status');
  const summary = document.getElementById('summary');
  let summaryTimer = null;

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

    open.disabled = urls.length === 0;
    clear.disabled = input.value.trim().length === 0;
  };

  const setTemporarySummary = (message) => {
    summary.textContent = message;
    if (summaryTimer) {
      clearTimeout(summaryTimer);
    }
    summaryTimer = setTimeout(updateUi, 1600);
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

  open.addEventListener('click', () => {
    const urls = [...new Set(extractUrls(input.value))];

    if (!urls.length) {
      updateUi();
      return;
    }

    urls.forEach((url) => {
      chrome.tabs.create({
        url: url,
        active: false
      });
    });

    setTemporarySummary(`Opened ${pluralize(urls.length, 'tab')}.`);
  });
});
