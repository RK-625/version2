// Popup script for GFG to Notion Sync
document.addEventListener('DOMContentLoaded', async () => {
    const statusIndicator = document.getElementById('statusIndicator');
    const statusText = document.getElementById('statusText');
    const syncBtn = document.getElementById('syncBtn');
    const settingsBtn = document.getElementById('settingsBtn');
    const syncCount = document.getElementById('syncCount');
    const lastSync = document.getElementById('lastSync');

    // Check configuration status
    async function checkConfiguration() {
        try {
            const settings = await chrome.storage.sync.get(['notionApiKey', 'databaseId', 'syncCount', 'lastSyncTime']);
            
            if (settings.notionApiKey && settings.databaseId) {
                statusIndicator.className = 'status-indicator connected';
                statusText.textContent = 'Ready to sync';
                syncBtn.disabled = false;
            } else {
                statusIndicator.className = 'status-indicator error';
                statusText.textContent = 'Configuration needed';
                syncBtn.disabled = true;
            }

            // Update stats
            syncCount.textContent = settings.syncCount || 0;
            if (settings.lastSyncTime) {
                const lastSyncDate = new Date(settings.lastSyncTime);
                lastSync.textContent = lastSyncDate.toLocaleDateString();
            }

        } catch (error) {
            console.error('Error checking configuration:', error);
            statusIndicator.className = 'status-indicator error';
            statusText.textContent = 'Configuration error';
        }
    }

    // Check if current tab is a GFG problem page
    async function checkCurrentPage() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab.url.includes('geeksforgeeks.org/problems/')) {
                syncBtn.textContent = '📝 Navigate to GFG Problem';
                syncBtn.disabled = true;
                return false;
            }
            return true;
        } catch (error) {
            console.error('Error checking current page:', error);
            return false;
        }
    }

    // Sync current problem
    async function syncCurrentProblem() {
        const originalText = syncBtn.innerHTML;
        syncBtn.disabled = true;
        syncBtn.innerHTML = '<div class="loading"></div> Syncing...';

        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            // Send message to content script to sync
            const response = await chrome.tabs.sendMessage(tab.id, { action: 'syncProblem' });
            
            if (response && response.success) {
                // Update sync count
                const currentCount = await chrome.storage.sync.get(['syncCount']);
                const newCount = (currentCount.syncCount || 0) + 1;
                await chrome.storage.sync.set({ 
                    syncCount: newCount,
                    lastSyncTime: new Date().toISOString()
                });

                syncCount.textContent = newCount;
                lastSync.textContent = new Date().toLocaleDateString();

                syncBtn.innerHTML = '✅ Synced!';
                setTimeout(() => {
                    syncBtn.innerHTML = originalText;
                    syncBtn.disabled = false;
                }, 2000);
            } else {
                throw new Error(response?.error || 'Sync failed');
            }

        } catch (error) {
            console.error('Error syncing problem:', error);
            syncBtn.innerHTML = '❌ Sync Failed';
            setTimeout(() => {
                syncBtn.innerHTML = originalText;
                syncBtn.disabled = false;
            }, 2000);
        }
    }

    // Open settings page
    function openSettings() {
        chrome.runtime.openOptionsPage();
        window.close();
    }

    // Event listeners
    syncBtn.addEventListener('click', syncCurrentProblem);
    settingsBtn.addEventListener('click', openSettings);

    // Initialize
    await checkConfiguration();
    await checkCurrentPage();

    // Listen for storage changes
    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'sync') {
            checkConfiguration();
        }
    });
});
