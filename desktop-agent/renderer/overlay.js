// Overlay renderer - handles countdown and idle display
let countdownContainer = null;
let countdownNumber = null;
let currentCountdown = null;
let listenersReady = false;

function getElements() {
  if (!countdownContainer) {
    countdownContainer = document.getElementById('countdownContainer');
    countdownNumber = document.getElementById('countdownNumber');
  }
  return { countdownContainer, countdownNumber };
}

function showCountdown(countdownValue) {
  const elements = getElements();
  if (!elements.countdownContainer || !elements.countdownNumber) return;
  elements.countdownContainer.classList.remove('hidden');
  elements.countdownContainer.style.display = 'flex';
  elements.countdownContainer.style.visibility = 'visible';
  elements.countdownContainer.style.opacity = '1';
  currentCountdown = countdownValue;
  elements.countdownNumber.textContent = String(countdownValue);
}

function updateCountdown(countdownValue) {
  const elements = getElements();
  if (elements.countdownNumber) {
    currentCountdown = countdownValue;
    elements.countdownNumber.textContent = String(countdownValue);
  }
}

function setupIPCListeners() {
  if (listenersReady) return;
  if (!window.overlayAPI) return;
  window.overlayAPI.onCountdown((data) => {
    if (data && typeof data.countdown === 'number' && data.countdown >= 0) {
      const elements = getElements();
      if (!elements.countdownContainer || elements.countdownContainer.classList.contains('hidden')) {
        showCountdown(data.countdown);
      } else {
        updateCountdown(data.countdown);
      }
    }
  });
  listenersReady = true;
  if (window.overlayAPI && typeof window.overlayAPI.ready === 'function') {
    window.overlayAPI.ready();
  }
}

function initialize() {
  getElements();
  if (window.overlayAPI) {
    setupIPCListeners();
  } else {
    let attempts = 0;
    const checkAPI = setInterval(() => {
      attempts++;
      if (window.overlayAPI) {
        clearInterval(checkAPI);
        setupIPCListeners();
      } else if (attempts > 100) {
        clearInterval(checkAPI);
      }
    }, 100);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}

window.addEventListener('load', () => {
  getElements();
  if (window.overlayAPI && !listenersReady) setupIPCListeners();
});
