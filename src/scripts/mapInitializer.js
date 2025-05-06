// Initialize and configure Google Maps
export function initializeMap(mapMarkers) {
  let map;
  let markers = [];
  let infoWindow;
  let isMapInitialized = false;

  function initMap() {
    if (isMapInitialized) return;

    const mapElement = document.getElementById('map');
    if (!mapElement) {
      console.error('Map element not found');
      return;
    }

    const apiKey = import.meta.env.PUBLIC_GOOGLE_MAPS_API_KEY;
    // console.log('API Key available:', !!apiKey);

    if (!apiKey) {
      console.error('Google Maps API key is missing');
      mapElement.innerHTML =
        '<p class="text-red-500 p-4">Google Maps API key is missing</p>';
      return;
    }

    try {
      // console.log('Initializing map with center:', {
      //   lat: Number(mapMarkers[0].lat) || 0,
      //   lng: Number(mapMarkers[0].lng) || 0,
      // });

      map = new google.maps.Map(mapElement, {
        center: {
          lat: Number(mapMarkers[0].lat) || 0,
          lng: Number(mapMarkers[0].lng) || 0,
        },
        zoom: 12,
        styles: [
          {
            featureType: 'poi',
            elementType: 'labels',
            stylers: [{ visibility: 'off' }],
          },
        ],
      });

      infoWindow = new google.maps.InfoWindow();
      const bounds = new google.maps.LatLngBounds();
      let validMarkers = 0;

      // console.log('Adding markers for centers:', mapMarkers.length);

      // Add markers for each center
      mapMarkers.forEach((marker, index) => {
        if (marker.lat && marker.lng) {
          const position = { lat: Number(marker.lat), lng: Number(marker.lng) };
          const markerObj = new google.maps.Marker({
            position,
            map,
            title: marker.name,
            animation: google.maps.Animation.DROP,
            optimized: true,
          });

          bounds.extend(position);
          validMarkers++;

          const content =
            '<div class="p-4">' +
            '<h3 class="font-bold text-lg mb-2">' +
            marker.name +
            '</h3>' +
            '<p class="text-gray-600 mb-2">' +
            (marker.address || '') +
            '</p>' +
            (marker.phone
              ? '<p class="text-gray-600 mb-2">' + marker.phone + '</p>'
              : '') +
            '<div class="flex gap-2 mt-4">' +
            (marker.phone
              ? '<a href="tel:' +
                marker.phone +
                '" class="text-green-600 hover:text-green-700">Call</a>'
              : '') +
            (marker.website
              ? '<a href="' +
                marker.website +
                '" target="_blank" rel="noopener noreferrer" class="text-green-600 hover:text-green-700">Website</a>'
              : '') +
            '</div>' +
            '</div>';

          markerObj.addListener('click', () => {
            infoWindow.setContent(content);
            infoWindow.open(map, markerObj);
          });

          markers.push(markerObj);
        }
      });

      // console.log('Valid markers added:', validMarkers);

      // Only fit bounds if we have multiple valid markers
      if (validMarkers > 1) {
        map.fitBounds(bounds);
        // Add some padding to the bounds
        const padding = { top: 50, right: 50, bottom: 50, left: 50 };
        map.fitBounds(bounds, padding);
      }

      isMapInitialized = true;
      // console.log('Map initialization complete');
    } catch (error) {
      console.error('Error initializing Google Maps:', error);
      mapElement.innerHTML =
        '<p class="text-red-500 p-4">Error loading map: ' +
        error.message +
        '</p>';
    }
  }

  // Initialize map when the Google Maps API is loaded
  if (typeof google !== 'undefined' && google.maps) {
    // console.log('Google Maps API already loaded, initializing map');
    initMap();
  } else {
    // console.log('Loading Google Maps API');
    // Load Google Maps API if not already loaded
    if (!document.querySelector('script[src*="maps.googleapis.com"]')) {
      const script = document.createElement('script');
      const apiKey = import.meta.env.PUBLIC_GOOGLE_MAPS_API_KEY;
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&callback=initMap`;
      script.async = true;
      script.defer = true;
      script.onerror = (error) => {
        console.error('Failed to load Google Maps script:', error);
        const mapElement = document.getElementById('map');
        if (mapElement) {
          mapElement.innerHTML =
            '<p class="text-red-500 p-4">Failed to load Google Maps</p>';
        }
      };
      window.initMap = initMap;
      document.head.appendChild(script);
    }
  }
}

// Define global direction functions
export function setupDirectionFunctions() {
  window.showDirections = function (lat, lng) {
    if (!lat || !lng) return;
    window.open(
      'https://www.google.com/maps/dir/?api=1&destination=' + lat + ',' + lng,
      '_blank'
    );
  };

  window.openDirections = window.showDirections; // Alias for compatibility with map component
}
