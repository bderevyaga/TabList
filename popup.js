document.addEventListener("DOMContentLoaded", () => {
  const name = 'a1-oc-mckc-stg-b';
  const input = document.getElementById('input');
  const open = document.getElementById('open');
  const tabs = document.getElementById('tabs');
  const clear = document.getElementById('clear');


  tabs.addEventListener('click', () => {
    chrome.tabs.query({}, (tabs) => {
      input.value = tabs.map(tab => tab.url).join('\n');;
      chrome.storage.local.set({ text: input.value });
    });
  });


  chrome.storage.local.get(['text'], (result) => {
    if (result.text) {
      input.value = result.text;
    }
  });

  input.addEventListener('input', () => {
    chrome.storage.local.set({ text: input.value });
  });

  clear.addEventListener('click', () => {
    chrome.storage.local.remove(['text'], () => {
      input.value = '';
    });
  });

  open.addEventListener('click', () => {
    const text = input.value;
    const urls = text.match(/https?:\/\/[^\s]+/g);

    if (!urls) {
      alert('No URLs found.');
      return;
    }

    urls.forEach((url) => {
      chrome.tabs.create({
        url: url,
        active: false
      });
    });
  });
});
