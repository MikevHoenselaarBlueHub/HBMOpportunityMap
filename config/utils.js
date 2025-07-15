
// Utility Functions

// Distance calculation
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of earth in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const d = R * c;
  return d;
}

// Format array values for display
function formatArray(value) {
  if (Array.isArray(value)) {
    return value.join(', ');
  }
  return value || '';
}

// Debounce function for search
function debounce(func, wait) {
  let timeout;
  return function executedFunction() {
    const args = arguments;
    const later = () => {
      clearTimeout(timeout);
      func.apply(this, args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Validate coordinates
function isValidCoordinate(lat, lng) {
  return lat && lng && 
         typeof lat === 'number' && typeof lng === 'number' &&
         lat >= -90 && lat <= 90 && 
         lng >= -180 && lng <= 180 &&
         lat !== 0 && lng !== 0;
}

// Generate unique ID
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Sanitize HTML to prevent XSS
function sanitizeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// Make functions globally available
window.utilFunctions = {
  calculateDistance,
  formatArray,
  debounce,
  isValidCoordinate,
  generateId,
  sanitizeHtml
};
