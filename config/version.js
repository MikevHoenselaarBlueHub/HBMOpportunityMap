// Version configuration - NO CACHING
const APP_VERSION = Date.now(); // Always unique timestamp

function getCacheBustParam() {
  return `?nocache=${Date.now()}&v=${APP_VERSION}`;
}

function cleanupLocalStorage() {
  // Get current timestamp
  const now = Date.now();
  const oneWeekAgo = now - (7 * 24 * 60 * 60 * 1000);

  // Get last cleanup timestamp
  const lastCleanup = localStorage.getItem('hbm_last_cleanup');

  if (!lastCleanup || parseInt(lastCleanup) < oneWeekAgo) {
    // Clean up old filter data
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('hbm_filter_')) {
        keysToRemove.push(key);
      }
    }

    keysToRemove.forEach(key => localStorage.removeItem(key));

    // Update last cleanup timestamp
    localStorage.setItem('hbm_last_cleanup', now.toString());

    if (keysToRemove.length > 0) {
      console.log(`Cleaned up ${keysToRemove.length} old filters from localStorage`);
    }
  }
}

function shouldRunCleanup() {
  const lastCleanup = localStorage.getItem('hbm_last_cleanup');
  const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
  return !lastCleanup || parseInt(lastCleanup) < oneWeekAgo;
}

// Run cleanup if needed
if (shouldRunCleanup()) {
  cleanupLocalStorage();
}

console.log(`Version ${APP_VERSION} loaded successfully`);