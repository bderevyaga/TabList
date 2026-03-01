export class PopupDomView {
  constructor(documentRef) {
    this.linkListInputField = documentRef.getElementById('link-list-input');
    this.captureFilterInputField = documentRef.getElementById('capture-filter-input');
    this.copyLinksButton = documentRef.getElementById('copy-links-button');
    this.openLinksButton = documentRef.getElementById('open-links-button');
    this.captureTabsButton = documentRef.getElementById('capture-tabs-button');
    this.clearLinksButton = documentRef.getElementById('clear-links-button');
    this.closeListedButton = documentRef.getElementById('close-listed-button');
    this.linkCountLabel = documentRef.getElementById('link-count');
    this.statusMessageLabel = documentRef.getElementById('status-message');
  }

  bindUiHandlers(handlers) {
    this.captureTabsButton.addEventListener('click', handlers.onCaptureTabsClick);
    this.linkListInputField.addEventListener('input', handlers.onInputChange);
    this.captureFilterInputField.addEventListener('input', handlers.onCaptureFilterInputChange);
    this.copyLinksButton.addEventListener('click', handlers.onCopyClick);
    this.clearLinksButton.addEventListener('click', handlers.onClearClick);
    this.closeListedButton.addEventListener('click', handlers.onCloseListedTabsClick);
    this.openLinksButton.addEventListener('click', handlers.onOpenLinksClick);
  }

  getLinksText() {
    return this.linkListInputField.value;
  }

  getCaptureFilterText() {
    return this.captureFilterInputField.value;
  }

  setLinksText(text) {
    this.linkListInputField.value = text;
  }

  setCaptureFilterText(text) {
    this.captureFilterInputField.value = text;
  }

  focusLinksInput() {
    this.linkListInputField.focus();
  }

  setLinkCountText(text) {
    this.linkCountLabel.textContent = text;
  }

  setStatusMessageText(text) {
    this.statusMessageLabel.textContent = text;
  }

  updateControlsState(controlsState) {
    this.openLinksButton.disabled = controlsState.isBusy || !controlsState.hasUrls;
    this.captureTabsButton.disabled = controlsState.isBusy;
    this.copyLinksButton.disabled = controlsState.isBusy || !controlsState.hasText;
    this.clearLinksButton.disabled = controlsState.isBusy || !controlsState.hasText;
    this.closeListedButton.disabled = controlsState.isBusy;
    this.linkListInputField.disabled = controlsState.isBusy;
    this.captureFilterInputField.disabled = controlsState.isBusy;
  }
}
