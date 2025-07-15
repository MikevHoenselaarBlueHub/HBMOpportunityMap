
// Version configuration for cache management
export const APP_VERSION = '1.3.1';
export const CACHE_VERSION = `hbm-kansenkaart-v${APP_VERSION}`;

// Build timestamp for development cache busting
export const BUILD_TIMESTAMP = Date.now();

// Cache configuration
export const CACHE_CONFIG = {
  // Static files cache duration (in milliseconds)
  STATIC_CACHE_DURATION: 24 * 60 * 60 * 1000, // 24 hours
  
  // API cache duration
  API_CACHE_DURATION: 60 * 60 * 1000, // 1 hour
  
  // Maximum number of saved filters to keep
  MAX_SAVED_FILTERS: 10,
  
  // LocalStorage cleanup interval
  CLEANUP_INTERVAL: 7 * 24 * 60 * 60 * 1000, // 7 days
  
  // Files that should always be fresh
  NO_CACHE_FILES: [
    '/data/opportunities.json'
  ],
  
  // Critical files for offline functionality
  CRITICAL_FILES: [
    '/',
    '/index.html',
    '/style.css',
    '/script.js',
    '/icons/close.svg',
    '/icons/filter-setting.svg',
    '/icons/marker-project.svg',
    '/icons/marker-company.svg'
  ]
};

// Development mode detection
export const IS_DEVELOPMENT = window.location.hostname === 'localhost' || 
                              window.location.hostname.includes('replit.dev');

// Cache busting query parameter
export function getCacheBustParam() {
  return IS_DEVELOPMENT ? `?v=${BUILD_TIMESTAMP}` : `?v=${APP_VERSION}`;
}

// Storage cleanup utilities
export function cleanupLocalStorage() {
  const now = Date.now();
  
  // Clean old saved filters
  const savedFilters = JSON.parse(localStorage.getItem('hbm_saved_filters') || '{}');
  const cleanedFilters = {};
  let cleanupCount = 0;
  
  Object.entries(savedFilters).forEach(([name, filter]) => {
    if (filter.timestamp) {
      const age = now - new Date(filter.timestamp).getTime();
      if (age < CACHE_CONFIG.CLEANUP_INTERVAL) {
        cleanedFilters[name] = filter;
      } else {
        cleanupCount++;
      }
    } else {
      // Keep filters without timestamp but add one
      cleanedFilters[name] = { ...filter, timestamp: new Date().toISOString() };
    }
  });
  
  // Limit to max saved filters
  const filterEntries = Object.entries(cleanedFilters);
  if (filterEntries.length > CACHE_CONFIG.MAX_SAVED_FILTERS) {
    // Sort by timestamp and keep newest
    filterEntries.sort((a, b) => new Date(b[1].timestamp) - new Date(a[1].timestamp));
    const limitedFilters = {};
    filterEntries.slice(0, CACHE_CONFIG.MAX_SAVED_FILTERS).forEach(([name, filter]) => {
      limitedFilters[name] = filter;
    });
    localStorage.setItem('hbm_saved_filters', JSON.stringify(limitedFilters));
    cleanupCount += filterEntries.length - CACHE_CONFIG.MAX_SAVED_FILTERS;
  } else {
    localStorage.setItem('hbm_saved_filters', JSON.stringify(cleanedFilters));
  }
  
  // Update last cleanup timestamp
  localStorage.setItem('hbm_last_cleanup', now.toString());
  
  if (cleanupCount > 0) {
    console.log(`Cleaned up ${cleanupCount} old filters from localStorage`);
  }
}

// Check if cleanup is needed
export function shouldRunCleanup() {
  const lastCleanup = localStorage.getItem('hbm_last_cleanup');
  if (!lastCleanup) return true;
  
  const timeSinceCleanup = Date.now() - parseInt(lastCleanup);
  return timeSinceCleanup > CACHE_CONFIG.CLEANUP_INTERVAL;
}
