// Handle interactions between map markers and center cards
export function setupMarkerInteractions() {
  console.log('Setting up center-map interactions');

  // Highlight a center card when its marker is clicked on the map
  document.addEventListener('markerClick', (event) => {
    console.log('Marker click event received', event.detail);

    // Get center ID from the event
    const centerId = event.detail.centerId;
    if (!centerId) {
      console.error('No center ID in marker click event');
      return;
    }

    // Find the center card element
    const centerElement = document.getElementById(`center-${centerId}`);
    if (!centerElement) {
      console.error(`Center element not found for ID: center-${centerId}`);
      return;
    }

    // Remove highlight from all centers
    document.querySelectorAll('[data-center-id]').forEach((el) => {
      el.classList.remove('highlight-center');
    });

    // Add highlight to the clicked center
    centerElement.classList.add('highlight-center');

    // Scroll the center into view
    centerElement.scrollIntoView({ behavior: 'smooth', block: 'center' });

    console.log('Center highlighted:', centerId);
  });

  // Set up click handlers for all center cards
  const setupCenterCardListeners = () => {
    const centerCards = document.querySelectorAll('[data-center-id]');
    console.log(`Setting up listeners for ${centerCards.length} center cards`);

    centerCards.forEach((card) => {
      card.addEventListener('click', (event) => {
        // Don't trigger center card click if clicking on a button or link
        if (event.target.closest('button') || event.target.closest('a')) {
          return;
        }

        const centerId = card.getAttribute('data-center-id');
        if (!centerId) {
          console.error('No center ID found on clicked card');
          return;
        }

        console.log('Center card clicked:', centerId);

        // Remove highlight from all centers
        document.querySelectorAll('[data-center-id]').forEach((el) => {
          el.classList.remove('highlight-center');
        });

        // Add highlight to the clicked center
        card.classList.add('highlight-center');

        // Dispatch event to highlight and focus on the marker
        const customEvent = new CustomEvent('centerSelect', {
          detail: { centerId },
        });
        document.dispatchEvent(customEvent);

        console.log('Center select event dispatched for:', centerId);
      });
    });
  };

  // Set up listeners when page loads
  setupCenterCardListeners();

  // Also set up listeners when the DOM changes (for dynamic content)
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
        setupCenterCardListeners();
        break;
      }
    }
  });

  // Start observing changes to the center list container
  const centersList = document.getElementById('centersList');
  if (centersList) {
    observer.observe(centersList, { childList: true, subtree: true });
    console.log('Observing changes to centers list');
  }
}
