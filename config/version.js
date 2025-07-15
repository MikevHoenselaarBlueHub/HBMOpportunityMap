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

// Global function to check if you're running the latest version
window.checkVersion = function() {
  const currentTime = Date.now();
  const versionAge = (currentTime - APP_VERSION) / 1000; // in seconds

  console.log(`Current version: ${APP_VERSION}`);
  console.log(`Version age: ${Math.floor(versionAge)} seconds`);

  if (versionAge > 60) {
    console.warn('⚠️ Version might be cached - try hard refresh (Ctrl+F5)');
    return false;
  } else {
    console.log('✅ Version is fresh');
    return true;
  }
};

// Add visual indicator in console
console.log('%c🔄 Cache Status Check Available', 'color: blue; font-weight: bold;');
console.log('%cRun window.checkVersion() to check if you have the latest version', 'color: blue;');