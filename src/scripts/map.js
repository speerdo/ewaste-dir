// Batch size for marker creation
const MARKER_BATCH_SIZE = 20;
const MARKER_BATCH_DELAY = 10; // milliseconds

let activeMarker = null;

// Function to open directions in Google Maps
function openDirections(lat, lng) {
  if (!lat || !lng) return;
  window.open(
    `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
    '_blank'
  );
}

// This function creates markers in batches to avoid blocking the main thread
async function createMarkersInBatches(map, markers, infoWindow) {
  const markerRefs = new Map();
  const bounds = new google.maps.LatLngBounds();

  // Process markers in batches
  for (let i = 0; i < markers.length; i += MARKER_BATCH_SIZE) {
    const batch = markers.slice(i, i + MARKER_BATCH_SIZE);

    // Create a batch of markers
    const batchPromises = batch.map((marker) => {
      return new Promise((resolve) => {
        const position = { lat: marker.lat, lng: marker.lng };
        const mapMarker = new google.maps.Marker({
          position,
          map,
          title: marker.name,
          animation: google.maps.Animation.DROP,
        });

        // Store marker reference
        markerRefs.set(marker.id, mapMarker);

        // Extend bounds
        bounds.extend(position);

        // Create info window content
        const content = `
          <div style="padding: 12px; margin: -8px -12px;">
            <h3 style="margin: 0 0 8px 0; font-size: 16px; font-weight: 600; color: #1a1a1a;">
              ${marker.name}
            </h3>
            ${
              marker.address
                ? `
              <p style="margin: 0 0 12px 0; font-size: 14px; color: #666;">
                ${marker.address}
              </p>
            `
                : ''
            }
            <div style="display: flex; gap: 12px;">
              ${
                marker.phone
                  ? `
                <a href="tel:${marker.phone}" style="display: inline-flex; align-items: center; color: #059669; text-decoration: none;">
                  <svg style="width: 16px; height: 16px; margin-right: 4px;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  Call
                </a>
              `
                  : ''
              }
              ${
                marker.website
                  ? `
                <a href="${marker.website}" target="_blank" rel="noopener noreferrer" style="display: inline-flex; align-items: center; color: #059669; text-decoration: none;">
                  <svg style="width: 16px; height: 16px; margin-right: 4px;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                  </svg>
                  Website
                </a>
              `
                  : ''
              }
              <a href="#" onclick="window.openDirections(${marker.lat}, ${
          marker.lng
        }); return false;" style="display: inline-flex; align-items: center; color: #059669; text-decoration: none;">
                <svg style="width: 16px; height: 16px; margin-right: 4px;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Directions
              </a>
            </div>
          </div>
        `;

        // Add click listener
        mapMarker.addListener('click', () => {
          // Stop any existing animation
          if (activeMarker && activeMarker !== mapMarker) {
            activeMarker.setAnimation(null);
          }

          // Animate this marker
          mapMarker.setAnimation(google.maps.Animation.BOUNCE);
          setTimeout(() => mapMarker.setAnimation(null), 2100);
          activeMarker = mapMarker;

          // Open info window
          infoWindow.setContent(content);
          infoWindow.open({
            map,
            anchor: mapMarker,
            shouldFocus: false,
          });

          // Dispatch custom event
          const event = new CustomEvent('markerClick', {
            detail: { centerId: marker.id },
          });
          document.dispatchEvent(event);

          // Pan to marker
          map.panTo(position);
        });

        resolve();
      });
    });

    // Wait for all markers in the batch to be created
    await Promise.all(batchPromises);

    // Small delay between batches to prevent UI blocking
    await new Promise((resolve) => setTimeout(resolve, MARKER_BATCH_DELAY));
  }

  return { markerRefs, bounds };
}

// This function initializes the map when the Google Maps API is loaded
async function initializeMap() {
  const mapElements = document.querySelectorAll('#map');

  mapElements.forEach(async (mapElement) => {
    const loadingElement =
      mapElement.parentElement?.querySelector('.map-loading');

    try {
      // Get markers from data attribute
      const markers = JSON.parse(mapElement.dataset.markers || '[]');
      const zoom = parseInt(mapElement.dataset.zoom || '12', 10);

      if (!markers.length) {
        console.error('No markers provided');
        return;
      }

      // Create map instance centered on the first marker
      const map = new google.maps.Map(mapElement, {
        center: { lat: markers[0].lat, lng: markers[0].lng },
        zoom,
        styles: [
          {
            featureType: 'administrative',
            elementType: 'labels.text.fill',
            stylers: [{ color: '#444444' }],
          },
          {
            featureType: 'landscape',
            elementType: 'all',
            stylers: [{ color: '#f2f2f2' }],
          },
          {
            featureType: 'poi',
            elementType: 'all',
            stylers: [{ visibility: 'off' }],
          },
          {
            featureType: 'road',
            elementType: 'all',
            stylers: [{ saturation: -100 }, { lightness: 45 }],
          },
          {
            featureType: 'road.highway',
            elementType: 'all',
            stylers: [{ visibility: 'simplified' }],
          },
          {
            featureType: 'road.arterial',
            elementType: 'labels.icon',
            stylers: [{ visibility: 'off' }],
          },
          {
            featureType: 'transit',
            elementType: 'all',
            stylers: [{ visibility: 'off' }],
          },
          {
            featureType: 'water',
            elementType: 'all',
            stylers: [{ color: '#c5e0ec' }, { visibility: 'on' }],
          },
        ],
      });

      // Create info window with custom options
      const infoWindow = new google.maps.InfoWindow({
        maxWidth: 320,
        ariaLabel: 'Recycling Center Information',
        pixelOffset: new google.maps.Size(0, 0),
      });

      // Create markers in batches
      const { markerRefs, bounds } = await createMarkersInBatches(
        map,
        markers,
        infoWindow
      );

      // Listen for center selection events
      document.addEventListener('centerSelect', (e) => {
        const marker = markerRefs.get(e.detail.centerId);
        if (marker) {
          // Stop any existing animation
          if (activeMarker && activeMarker !== marker) {
            activeMarker.setAnimation(null);
          }

          // Animate the marker
          marker.setAnimation(google.maps.Animation.BOUNCE);
          setTimeout(() => marker.setAnimation(null), 2100);
          activeMarker = marker;

          // Open info window
          const selectedMarker = markers.find(
            (m) => m.id === e.detail.centerId
          );
          if (selectedMarker) {
            const content = `
              <div class="custom-info-window">
                <style>
                  .custom-info-window {
                    padding: 12px;
                    max-width: 300px;
                    font-family: system-ui, -apple-system, sans-serif;
                  }
                </style>
                <h3 style="margin: 0 0 8px 0; font-size: 16px; font-weight: 600; color: #1a1a1a;">
                  ${selectedMarker.name}
                </h3>
                ${
                  selectedMarker.address
                    ? `
                  <p style="margin: 0 0 12px 0; font-size: 14px; color: #666;">
                    ${selectedMarker.address}
                  </p>
                `
                    : ''
                }
                <div style="display: flex; gap: 12px;">
                  ${
                    selectedMarker.phone
                      ? `
                    <a href="tel:${selectedMarker.phone}" style="display: inline-flex; align-items: center; color: #059669; text-decoration: none;">
                      <svg style="width: 16px; height: 16px; margin-right: 4px;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                      Call
                    </a>
                  `
                      : ''
                  }
                  ${
                    selectedMarker.website
                      ? `
                    <a href="${selectedMarker.website}" target="_blank" rel="noopener noreferrer" style="display: inline-flex; align-items: center; color: #059669; text-decoration: none;">
                      <svg style="width: 16px; height: 16px; margin-right: 4px;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                      </svg>
                      Website
                    </a>
                  `
                      : ''
                  }
                  <a href="#" onclick="window.openDirections(${
                    selectedMarker.lat
                  }, ${
              selectedMarker.lng
            }); return false;" style="display: inline-flex; align-items: center; color: #059669; text-decoration: none;">
                    <svg style="width: 16px; height: 16px; margin-right: 4px;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Directions
                  </a>
                </div>
              </div>
            `;

            google.maps.event.addListenerOnce(infoWindow, 'domready', () => {
              const iwOuter = document.querySelector('.gm-style-iw');
              if (iwOuter) {
                const iwBackground = iwOuter.previousElementSibling;
                if (iwBackground) {
                  // Remove the background shadow DIV
                  iwBackground.parentElement?.removeChild(iwBackground);
                }
              }
            });

            infoWindow.open({
              map,
              anchor: marker,
              shouldFocus: false,
            });

            // Pan to marker
            map.panTo(marker.getPosition());
          }
        }
      });

      // Fit map to bounds
      map.fitBounds(bounds);

      // If there's only one marker, zoom in closer
      if (markers.length === 1) {
        map.setZoom(15);
      }

      // Hide loading screen
      if (loadingElement) {
        loadingElement.style.display = 'none';
      }
    } catch (error) {
      console.error('Error initializing map:', error);
      if (loadingElement) {
        loadingElement.innerHTML = `
          <div class="text-center">
            <p class="text-red-600">Error loading map</p>
          </div>
        `;
      }
    }
  });
}

// Make functions available globally
if (typeof window !== 'undefined') {
  window.openDirections = openDirections;
  window.initializeMap = initializeMap;
}
