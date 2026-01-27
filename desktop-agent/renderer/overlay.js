// Overlay renderer - handles countdown and idle display
console.log('[Overlay] Script loading...');

// DOM element references
let countdownContainer = null;
let countdownNumber = null;

// State
let currentCountdown = null;
let listenersReady = false;

// Get DOM elements
function getElements() {
  if (!countdownContainer) {
    countdownContainer = document.getElementById('countdownContainer');
    countdownNumber = document.getElementById('countdownNumber');
    
    console.log('[Overlay] Elements found:', {
      countdownContainer: !!countdownContainer,
      countdownNumber: !!countdownNumber,
    });
  }
  return { countdownContainer, countdownNumber };
}

// Show countdown
function showCountdown(countdownValue) {
  console.log('[Overlay] showCountdown called with:', countdownValue);
  const elements = getElements();
  
  if (!elements.countdownContainer || !elements.countdownNumber) {
    console.error('[Overlay] Elements not found for countdown');
    return;
  }
  
  // Show countdown container
  elements.countdownContainer.classList.remove('hidden');
  elements.countdownContainer.style.display = 'flex';
  elements.countdownContainer.style.visibility = 'visible';
  elements.countdownContainer.style.opacity = '1';
  
  // Set countdown value
  currentCountdown = countdownValue;
  elements.countdownNumber.textContent = String(countdownValue);
  
  console.log('[Overlay] Countdown displayed:', {
    value: countdownValue,
    textContent: elements.countdownNumber.textContent,
    containerVisible: !elements.countdownContainer.classList.contains('hidden'),
    containerDisplay: window.getComputedStyle(elements.countdownContainer).display
  });
}

// Update countdown value
function updateCountdown(countdownValue) {
  console.log('[Overlay] updateCountdown called with:', countdownValue);
  const elements = getElements();
  
  if (elements.countdownNumber) {
    currentCountdown = countdownValue;
    elements.countdownNumber.textContent = String(countdownValue);
    console.log('[Overlay] Countdown updated to:', countdownValue);
  }
}

// Setup IPC listeners
function setupIPCListeners() {
  if (listenersReady) {
    console.log('[Overlay] Listeners already set up');
    return;
  }
  
  if (!window.overlayAPI) {
    console.warn('[Overlay] overlayAPI not available yet');
    return;
  }
  
  console.log('[Overlay] Setting up IPC listeners...');
  
  // Listen for countdown messages
  window.overlayAPI.onCountdown((data) => {
    console.log('[Overlay] IPC: Received countdown message:', data);
    
    if (data && typeof data.countdown === 'number' && data.countdown >= 0) {
      const elements = getElements();
      
      // If container is hidden, show it
      if (!elements.countdownContainer || elements.countdownContainer.classList.contains('hidden')) {
        showCountdown(data.countdown);
      } else {
        // Just update the number
        updateCountdown(data.countdown);
      }
    } else {
      console.warn('[Overlay] Invalid countdown data:', data);
    }
  });
  
  listenersReady = true;
  console.log('[Overlay] IPC listeners set up successfully');

  // Let main process know we're ready to receive the latest state
  if (window.overlayAPI && typeof window.overlayAPI.ready === 'function') {
    window.overlayAPI.ready();
  }
}

// Initialize when DOM is ready
function initialize() {
  console.log('[Overlay] Initializing...');
  console.log('[Overlay] Document readyState:', document.readyState);
  
  // Get elements
  getElements();
  
  // Try to set up listeners immediately
  if (window.overlayAPI) {
    console.log('[Overlay] overlayAPI available immediately');
    setupIPCListeners();
  } else {
    // Poll for overlayAPI
    console.log('[Overlay] Waiting for overlayAPI...');
    let attempts = 0;
    const checkAPI = setInterval(() => {
      attempts++;
      if (window.overlayAPI) {
        console.log('[Overlay] overlayAPI found after', attempts * 100, 'ms');
        clearInterval(checkAPI);
        setupIPCListeners();
      } else if (attempts > 100) {
        console.error('[Overlay] overlayAPI not found after 10 seconds');
        clearInterval(checkAPI);
      }
    }, 100);
  }
}

// Start initialization
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    console.log('[Overlay] DOMContentLoaded');
    initialize();
  });
} else {
  console.log('[Overlay] DOM already ready');
  initialize();
}

// Also initialize on window load
window.addEventListener('load', () => {
  console.log('[Overlay] Window loaded');
  getElements();
  
  // Double-check listeners
  if (window.overlayAPI && !listenersReady) {
    console.log('[Overlay] Setting up listeners on window load');
    setupIPCListeners();
  }
});

console.log('[Overlay] Script loaded');
