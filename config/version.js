// Simple version configuration - no complex caching
const APP_VERSION = '1.4.0';
const CACHE_NAME = `hbm-kansenkaart-${APP_VERSION}`;

// Simple cache busting for development
function getCacheBust() {
  return `?v=${APP_VERSION}`;
}

// Export for both ES6 and CommonJS
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    APP_VERSION,
    CACHE_NAME,
    getCacheBust
  };
} else {
  window.APP_VERSION = APP_VERSION;
  window.CACHE_NAME = CACHE_NAME;
  window.getCacheBust = getCacheBust;
}