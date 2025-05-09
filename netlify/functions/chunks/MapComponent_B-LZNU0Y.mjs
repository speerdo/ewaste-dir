import { c as createAstro, a as createComponent, r as renderTemplate, d as defineScriptVars, m as maybeRenderHead } from './astro/server_BBuoheSG.mjs';
import 'kleur/colors';
import 'clsx';
/* empty css                          */

var __freeze = Object.freeze;
var __defProp = Object.defineProperty;
var __template = (cooked, raw) => __freeze(__defProp(cooked, "raw", { value: __freeze(raw || cooked.slice()) }));
var _a;
const $$Astro = createAstro("https://www.recycleoldtech.com");
const $$MapComponent = createComponent(($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro, $$props, $$slots);
  Astro2.self = $$MapComponent;
  const { markers, initialZoom = 12 } = Astro2.props;
  return renderTemplate(_a || (_a = __template(["", '<div class="relative w-full h-full rounded-lg overflow-hidden" data-astro-cid-ncjfgm3l> <!-- Reset Map Button --> <button id="resetMap" class="absolute top-4 right-4 bg-white rounded-lg shadow-md px-4 py-2 z-10 flex items-center gap-2 text-gray-700 hover:bg-gray-50 transition-colors" style="display: none;" data-astro-cid-ncjfgm3l> <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" data-astro-cid-ncjfgm3l> <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" data-astro-cid-ncjfgm3l></path> </svg>\nReset Map\n</button> <div id="map" class="w-full h-full" data-astro-cid-ncjfgm3l> <!-- Loading state --> <div class="absolute inset-0 flex items-center justify-center bg-gray-100" data-astro-cid-ncjfgm3l> <div class="text-gray-500" data-astro-cid-ncjfgm3l>Loading map...</div> </div> </div> <!-- Error state (hidden by default) --> <div id="mapError" class="absolute inset-0 flex items-center justify-center bg-gray-100 hidden" data-astro-cid-ncjfgm3l> <div class="text-center p-4" data-astro-cid-ncjfgm3l> <p class="text-red-500 mb-2" data-astro-cid-ncjfgm3l>Failed to load map</p> <p class="text-gray-500 text-sm" data-astro-cid-ncjfgm3l>Please try refreshing the page</p> </div> </div> </div>  <script>(function(){', `
  // Declare global variables for map functionality
  let map;
  let activeMarker = null;
  let activeInfoWindow = null;
  const markerRefs = new Map();
  const infoWindowRefs = new Map();
  let initialBounds = null;

  function handleMapError(error) {
    console.error('Map error:', error);
    const mapElement = document.getElementById('map');
    const errorElement = document.getElementById('mapError');
    if (mapElement && errorElement) {
      mapElement.style.display = 'none';
      errorElement.style.display = 'flex';
    }
  }

  // Initialize the map with markers
  async function initializeMap() {
    try {
      const mapElement = document.getElementById('map');
      const resetButton = document.getElementById('resetMap');
      if (!mapElement) {
        throw new Error('Map element not found');
      }

      // Get API key from window or environment
      const apiKey = window.GOOGLE_MAPS_API_KEY;
      if (!apiKey) {
        throw new Error('Google Maps API key is missing');
      }

      // Initialize map with first marker as center
      map = new google.maps.Map(mapElement, {
        center: markers[0] ? { lat: Number(markers[0].lat), lng: Number(markers[0].lng) } : { lat: 0, lng: 0 },
        zoom: initialZoom,
        styles: [
          {
            featureType: 'poi',
            elementType: 'labels',
            stylers: [{ visibility: 'off' }]
          }
        ]
      });

      // Add markers to the map
      const bounds = new google.maps.LatLngBounds();
      let validMarkers = 0;

      markers.forEach((marker) => {
        if (marker.lat && marker.lng) {
          const position = { lat: Number(marker.lat), lng: Number(marker.lng) };
          const markerObj = new google.maps.Marker({
            position,
            map,
            title: marker.name,
            animation: google.maps.Animation.DROP,
            optimized: true
          });

          bounds.extend(position);
          validMarkers++;

          // Create info window content
          const content = \`
            <div class="p-4">
              <h3 class="font-bold text-lg mb-2">\${marker.name}</h3>
              \${marker.address ? \`<p class="text-gray-600 mb-2">\${marker.address}</p>\` : ''}
              \${marker.phone ? \`<p class="text-gray-600 mb-2">\${marker.phone}</p>\` : ''}
              <div class="flex gap-2 mt-4">
                \${marker.phone ? \`<a href="tel:\${marker.phone}" class="text-green-600 hover:text-green-700 map-link">Call</a>\` : ''}
                \${marker.website ? \`<a href="\${marker.website}" target="_blank" rel="noopener noreferrer" class="text-green-600 hover:text-green-700 map-link">Website</a>\` : ''}
                <button onclick="window.openDirections(\${marker.lat}, \${marker.lng})" class="text-green-600 hover:text-green-700 map-link">Directions</button>
              </div>
            </div>
          \`;

          const infoWindow = new google.maps.InfoWindow({ content });

          markerObj.addListener('click', () => {
            // Close any previously open info window
            if (activeInfoWindow) {
              activeInfoWindow.close();
            }
            
            // Open this marker's info window
            infoWindow.open(map, markerObj);
            activeInfoWindow = infoWindow;
            
            // Set bounce animation
            if (activeMarker && activeMarker !== markerObj) {
              activeMarker.setAnimation(null);
            }
            markerObj.setAnimation(google.maps.Animation.BOUNCE);
            setTimeout(() => markerObj.setAnimation(null), 2100);
            activeMarker = markerObj;

            // Show reset button
            if (resetButton) {
              resetButton.style.display = 'flex';
            }

            // Dispatch marker click event
            const event = new CustomEvent('markerClick', {
              detail: { centerId: marker.id }
            });
            document.dispatchEvent(event);
          });

          // Store references to markers and info windows
          markerRefs.set(marker.id, markerObj);
          infoWindowRefs.set(marker.id, infoWindow);
        }
      });

      // Fit bounds if we have multiple valid markers
      if (validMarkers > 1) {
        map.fitBounds(bounds);
        const padding = { top: 50, right: 50, bottom: 50, left: 50 };
        map.fitBounds(bounds, padding);
      }

      // Store initial bounds for reset functionality
      initialBounds = bounds;

      // Add reset button functionality
      if (resetButton) {
        resetButton.addEventListener('click', () => {
          // Close any open info windows
          if (activeInfoWindow) {
            activeInfoWindow.close();
          }
          
          // Stop any bouncing markers
          if (activeMarker) {
            activeMarker.setAnimation(null);
          }
          
          // Reset the map view
          if (validMarkers > 1) {
            map.fitBounds(initialBounds);
            const padding = { top: 50, right: 50, bottom: 50, left: 50 };
            map.fitBounds(initialBounds, padding);
          } else {
            map.setCenter(markers[0] ? { lat: Number(markers[0].lat), lng: Number(markers[0].lng) } : { lat: 0, lng: 0 });
            map.setZoom(initialZoom);
          }
          
          // Hide the reset button
          resetButton.style.display = 'none';
          
          // Remove highlight from all centers
          document.querySelectorAll('[data-center-id]').forEach((el) => {
            el.classList.remove('highlight-center');
          });
        });
      }
    } catch (error) {
      handleMapError(error);
    }
  }

  // Set up event listeners for map interactions
  function setupMapListeners() {
    // Listen for center selection events (from card clicks)
    document.addEventListener('centerSelect', (e) => {
      const marker = markerRefs.get(e.detail.centerId);
      const resetButton = document.getElementById('resetMap');
      
      if (marker) {
        // Close any existing info window
        if (activeInfoWindow) {
          activeInfoWindow.close();
        }
        
        // Find the associated info window and open it
        const infoWindow = infoWindowRefs.get(e.detail.centerId);
        if (infoWindow) {
          infoWindow.open(map, marker);
          activeInfoWindow = infoWindow;
        }
        
        // Set marker animation
        if (activeMarker && activeMarker !== marker) {
          activeMarker.setAnimation(null);
        }
        marker.setAnimation(google.maps.Animation.BOUNCE);
        setTimeout(() => marker.setAnimation(null), 2100);
        activeMarker = marker;
        
        // Pan map to marker position
        map.panTo(marker.getPosition());
        map.setZoom(15);
        
        // Show reset button
        if (resetButton) {
          resetButton.style.display = 'flex';
        }
      }
    });
  }
  
  // Main function to initialize everything
  function initMap() {
    // Initialize the map with markers
    initializeMap();
    
    // Set up event listeners
    setupMapListeners();
  }

  // Initialize map when Google Maps API is loaded
  if (typeof google !== 'undefined' && google.maps) {
    initMap();
  } else {
    window.addEventListener('google-maps-ready', initMap);
  }
})();<\/script>`], ["", '<div class="relative w-full h-full rounded-lg overflow-hidden" data-astro-cid-ncjfgm3l> <!-- Reset Map Button --> <button id="resetMap" class="absolute top-4 right-4 bg-white rounded-lg shadow-md px-4 py-2 z-10 flex items-center gap-2 text-gray-700 hover:bg-gray-50 transition-colors" style="display: none;" data-astro-cid-ncjfgm3l> <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" data-astro-cid-ncjfgm3l> <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" data-astro-cid-ncjfgm3l></path> </svg>\nReset Map\n</button> <div id="map" class="w-full h-full" data-astro-cid-ncjfgm3l> <!-- Loading state --> <div class="absolute inset-0 flex items-center justify-center bg-gray-100" data-astro-cid-ncjfgm3l> <div class="text-gray-500" data-astro-cid-ncjfgm3l>Loading map...</div> </div> </div> <!-- Error state (hidden by default) --> <div id="mapError" class="absolute inset-0 flex items-center justify-center bg-gray-100 hidden" data-astro-cid-ncjfgm3l> <div class="text-center p-4" data-astro-cid-ncjfgm3l> <p class="text-red-500 mb-2" data-astro-cid-ncjfgm3l>Failed to load map</p> <p class="text-gray-500 text-sm" data-astro-cid-ncjfgm3l>Please try refreshing the page</p> </div> </div> </div>  <script>(function(){', `
  // Declare global variables for map functionality
  let map;
  let activeMarker = null;
  let activeInfoWindow = null;
  const markerRefs = new Map();
  const infoWindowRefs = new Map();
  let initialBounds = null;

  function handleMapError(error) {
    console.error('Map error:', error);
    const mapElement = document.getElementById('map');
    const errorElement = document.getElementById('mapError');
    if (mapElement && errorElement) {
      mapElement.style.display = 'none';
      errorElement.style.display = 'flex';
    }
  }

  // Initialize the map with markers
  async function initializeMap() {
    try {
      const mapElement = document.getElementById('map');
      const resetButton = document.getElementById('resetMap');
      if (!mapElement) {
        throw new Error('Map element not found');
      }

      // Get API key from window or environment
      const apiKey = window.GOOGLE_MAPS_API_KEY;
      if (!apiKey) {
        throw new Error('Google Maps API key is missing');
      }

      // Initialize map with first marker as center
      map = new google.maps.Map(mapElement, {
        center: markers[0] ? { lat: Number(markers[0].lat), lng: Number(markers[0].lng) } : { lat: 0, lng: 0 },
        zoom: initialZoom,
        styles: [
          {
            featureType: 'poi',
            elementType: 'labels',
            stylers: [{ visibility: 'off' }]
          }
        ]
      });

      // Add markers to the map
      const bounds = new google.maps.LatLngBounds();
      let validMarkers = 0;

      markers.forEach((marker) => {
        if (marker.lat && marker.lng) {
          const position = { lat: Number(marker.lat), lng: Number(marker.lng) };
          const markerObj = new google.maps.Marker({
            position,
            map,
            title: marker.name,
            animation: google.maps.Animation.DROP,
            optimized: true
          });

          bounds.extend(position);
          validMarkers++;

          // Create info window content
          const content = \\\`
            <div class="p-4">
              <h3 class="font-bold text-lg mb-2">\\\${marker.name}</h3>
              \\\${marker.address ? \\\`<p class="text-gray-600 mb-2">\\\${marker.address}</p>\\\` : ''}
              \\\${marker.phone ? \\\`<p class="text-gray-600 mb-2">\\\${marker.phone}</p>\\\` : ''}
              <div class="flex gap-2 mt-4">
                \\\${marker.phone ? \\\`<a href="tel:\\\${marker.phone}" class="text-green-600 hover:text-green-700 map-link">Call</a>\\\` : ''}
                \\\${marker.website ? \\\`<a href="\\\${marker.website}" target="_blank" rel="noopener noreferrer" class="text-green-600 hover:text-green-700 map-link">Website</a>\\\` : ''}
                <button onclick="window.openDirections(\\\${marker.lat}, \\\${marker.lng})" class="text-green-600 hover:text-green-700 map-link">Directions</button>
              </div>
            </div>
          \\\`;

          const infoWindow = new google.maps.InfoWindow({ content });

          markerObj.addListener('click', () => {
            // Close any previously open info window
            if (activeInfoWindow) {
              activeInfoWindow.close();
            }
            
            // Open this marker's info window
            infoWindow.open(map, markerObj);
            activeInfoWindow = infoWindow;
            
            // Set bounce animation
            if (activeMarker && activeMarker !== markerObj) {
              activeMarker.setAnimation(null);
            }
            markerObj.setAnimation(google.maps.Animation.BOUNCE);
            setTimeout(() => markerObj.setAnimation(null), 2100);
            activeMarker = markerObj;

            // Show reset button
            if (resetButton) {
              resetButton.style.display = 'flex';
            }

            // Dispatch marker click event
            const event = new CustomEvent('markerClick', {
              detail: { centerId: marker.id }
            });
            document.dispatchEvent(event);
          });

          // Store references to markers and info windows
          markerRefs.set(marker.id, markerObj);
          infoWindowRefs.set(marker.id, infoWindow);
        }
      });

      // Fit bounds if we have multiple valid markers
      if (validMarkers > 1) {
        map.fitBounds(bounds);
        const padding = { top: 50, right: 50, bottom: 50, left: 50 };
        map.fitBounds(bounds, padding);
      }

      // Store initial bounds for reset functionality
      initialBounds = bounds;

      // Add reset button functionality
      if (resetButton) {
        resetButton.addEventListener('click', () => {
          // Close any open info windows
          if (activeInfoWindow) {
            activeInfoWindow.close();
          }
          
          // Stop any bouncing markers
          if (activeMarker) {
            activeMarker.setAnimation(null);
          }
          
          // Reset the map view
          if (validMarkers > 1) {
            map.fitBounds(initialBounds);
            const padding = { top: 50, right: 50, bottom: 50, left: 50 };
            map.fitBounds(initialBounds, padding);
          } else {
            map.setCenter(markers[0] ? { lat: Number(markers[0].lat), lng: Number(markers[0].lng) } : { lat: 0, lng: 0 });
            map.setZoom(initialZoom);
          }
          
          // Hide the reset button
          resetButton.style.display = 'none';
          
          // Remove highlight from all centers
          document.querySelectorAll('[data-center-id]').forEach((el) => {
            el.classList.remove('highlight-center');
          });
        });
      }
    } catch (error) {
      handleMapError(error);
    }
  }

  // Set up event listeners for map interactions
  function setupMapListeners() {
    // Listen for center selection events (from card clicks)
    document.addEventListener('centerSelect', (e) => {
      const marker = markerRefs.get(e.detail.centerId);
      const resetButton = document.getElementById('resetMap');
      
      if (marker) {
        // Close any existing info window
        if (activeInfoWindow) {
          activeInfoWindow.close();
        }
        
        // Find the associated info window and open it
        const infoWindow = infoWindowRefs.get(e.detail.centerId);
        if (infoWindow) {
          infoWindow.open(map, marker);
          activeInfoWindow = infoWindow;
        }
        
        // Set marker animation
        if (activeMarker && activeMarker !== marker) {
          activeMarker.setAnimation(null);
        }
        marker.setAnimation(google.maps.Animation.BOUNCE);
        setTimeout(() => marker.setAnimation(null), 2100);
        activeMarker = marker;
        
        // Pan map to marker position
        map.panTo(marker.getPosition());
        map.setZoom(15);
        
        // Show reset button
        if (resetButton) {
          resetButton.style.display = 'flex';
        }
      }
    });
  }
  
  // Main function to initialize everything
  function initMap() {
    // Initialize the map with markers
    initializeMap();
    
    // Set up event listeners
    setupMapListeners();
  }

  // Initialize map when Google Maps API is loaded
  if (typeof google !== 'undefined' && google.maps) {
    initMap();
  } else {
    window.addEventListener('google-maps-ready', initMap);
  }
})();<\/script>`])), maybeRenderHead(), defineScriptVars({ markers, initialZoom }));
}, "/home/adam/Projects/ewaste-dir/src/components/MapComponent.astro", void 0);

export { $$MapComponent as $ };
