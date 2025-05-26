// Options page script for GFG to Notion Sync
document.addEventListener('DOMContentLoaded', async () => {
    const form = document.getElementById('settingsForm');
    const notionApiKey = document.getElementById('notionApiKey');
    const databaseId = document.getElementById('databaseId');
    const defaultSheet = document.getElementById('defaultSheet');
    const autoSync = document.getElementById('autoSync');
    const includeCode = document.getElementById('includeCode');
    const testConnectionBtn = document.getElementById('testConnection');
    const resetSettingsBtn = document.getElementById('resetSettings');
    const status = document.getElementById('status');
    const statusMessage = document.getElementById('statusMessage');
    const totalSynced = document.getElementById('totalSynced');
    const lastSyncTime = document.getElementById('lastSyncTime');

    // Load saved settings
    async function loadSettings() {
        try {
            const settings = await chrome.storage.sync.get([
                'notionApiKey',
                'databaseId',
                'defaultSheet',
                'autoSync',
                'includeCode',
                'syncCount',
                'lastSyncTime'
            ]);

            if (settings.notionApiKey) {
                notionApiKey.value = settings.notionApiKey;
            }
            if (settings.databaseId) {
                databaseId.value = settings.databaseId;
            }
            if (settings.defaultSheet) {
                defaultSheet.value = settings.defaultSheet;
            }
            
            autoSync.checked = settings.autoSync !== false; // default to true
            includeCode.checked = settings.includeCode !== false; // default to true

            // Update stats
            totalSynced.textContent = settings.syncCount || 0;
            if (settings.lastSyncTime) {
                const date = new Date(settings.lastSyncTime);
                lastSyncTime.textContent = date.toLocaleString();
            }

        } catch (error) {
            console.error('Error loading settings:', error);
            showStatus('Error loading settings', 'error');
        }
    }

    // Save settings
    async function saveSettings(e) {
        e.preventDefault();
        
        const saveBtn = form.querySelector('button[type="submit"]');
        const originalText = saveBtn.textContent;
        saveBtn.innerHTML = '<div class="loading"></div>Saving...';
        saveBtn.disabled = true;

        try {
            const settings = {
                notionApiKey: notionApiKey.value.trim(),
                databaseId: databaseId.value.trim(),
                defaultSheet: defaultSheet.value.trim(),
                autoSync: autoSync.checked,
                includeCode: includeCode.checked
            };

            // Validate required fields
            if (!settings.notionApiKey || !settings.databaseId) {
                throw new Error('Please fill in both Notion API Key and Database ID');
            }

            // Updated validation to accept both ntn_ and secret_ prefixes
            if (!settings.notionApiKey.startsWith('ntn_') && !settings.notionApiKey.startsWith('secret_')) {
                throw new Error('Invalid API key format. It should start with "ntn_" or "secret_"');
            }

            // Validate Database ID format (UUID)
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            const cleanDatabaseId = settings.databaseId.replace(/-/g, '');
            if (!uuidRegex.test(settings.databaseId) && cleanDatabaseId.length !== 32) {
                throw new Error('Invalid Database ID format. Please check the ID from your Notion database URL');
            }

            await chrome.storage.sync.set(settings);
            showStatus('Settings saved successfully!', 'success');

        } catch (error) {
            console.error('Error saving settings:', error);
            showStatus(error.message, 'error');
        } finally {
            saveBtn.textContent = originalText;
            saveBtn.disabled = false;
        }
    }

    // Test Notion connection
    async function testConnection() {
        const originalText = testConnectionBtn.textContent;
        testConnectionBtn.innerHTML = '<div class="loading"></div>Testing...';
        testConnectionBtn.disabled = true;

        try {
            const settings = await chrome.storage.sync.get(['notionApiKey', 'databaseId']);
            
            if (!settings.notionApiKey || !settings.databaseId) {
                throw new Error('Please save your settings first');
            }

            // Test API connection by fetching database info
            const response = await fetch(`https://api.notion.com/v1/databases/${settings.databaseId}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${settings.notionApiKey}`,
                    'Content-Type': 'application/json',
                    'Notion-Version': '2022-06-28'
                }
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`Connection failed: ${errorData.message || response.statusText}`);
            }

            const databaseInfo = await response.json();
            showStatus(`✅ Connection successful! Database: "${databaseInfo.title[0]?.plain_text || 'Untitled'}"`, 'success');

        } catch (error) {
            console.error('Connection test failed:', error);
            showStatus(`❌ ${error.message}`, 'error');
        } finally {
            testConnectionBtn.textContent = originalText;
            testConnectionBtn.disabled = false;
        }
    }

    // Reset all settings
    async function resetSettings() {
        if (!confirm('Are you sure you want to reset all settings? This action cannot be undone.')) {
            return;
        }

        try {
            await chrome.storage.sync.clear();
            
            // Clear form
            notionApiKey.value = '';
            databaseId.value = '';
            defaultSheet.value = '';
            autoSync.checked = true;
            includeCode.checked = true;
            
            // Reset stats
            totalSynced.textContent = '0';
            lastSyncTime.textContent = 'Never';

            showStatus('All settings have been reset', 'info');

        } catch (error) {
            console.error('Error resetting settings:', error);
            showStatus('Error resetting settings', 'error');
        }
    }

    // Show status message
    function showStatus(message, type) {
        statusMessage.textContent = message;
        statusMessage.className = `status-message ${type}`;
        status.style.display = 'block';

        // Auto-hide after 5 seconds
        setTimeout(() => {
            status.style.display = 'none';
        }, 5000);
    }

    // Copy database template
    function copyDatabaseTemplate() {
        const template = `Database Properties:
1. Question Name (Title)
2. Platform (Select) - Options: GeeksforGeeks, LeetCode, HackerRank
3. Difficulty (Select) - Options: Easy, Medium, Hard
4. Topic (Multi-select) - Options: Arrays, Strings, Trees, etc.
5. Question URL (URL)
6. Created time (Created time)
7. Sheet (Select) - Optional category/sheet name`;

        navigator.clipboard.writeText(template).then(() => {
            showStatus('Database template copied to clipboard!', 'success');
        }).catch(() => {
            showStatus('Failed to copy template', 'error');
        });
    }

    // Event listeners
    form.addEventListener('submit', saveSettings);
    testConnectionBtn.addEventListener('click', testConnection);
    resetSettingsBtn.addEventListener('click', resetSettings);

    // Add copy template button
    const instructionsSection = document.querySelector('.instructions');
    const copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.className = 'btn btn-secondary';
    copyBtn.style.marginTop = '15px';
    copyBtn.textContent = '📋 Copy Database Template';
    copyBtn.addEventListener('click', copyDatabaseTemplate);
    instructionsSection.appendChild(copyBtn);

    // Load settings on page load
    await loadSettings();

    // Listen for storage changes
    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'sync') {
            loadSettings();
        }
    });

    // Auto-save on input change (debounced)
    let saveTimeout;
    [notionApiKey, databaseId, defaultSheet].forEach(input => {
        input.addEventListener('input', () => {
            clearTimeout(saveTimeout);
            saveTimeout = setTimeout(() => {
                if (notionApiKey.value && databaseId.value) {
                    form.dispatchEvent(new Event('submit'));
                }
            }, 1000);
        });
    });

    [autoSync, includeCode].forEach(checkbox => {
        checkbox.addEventListener('change', () => {
            form.dispatchEvent(new Event('submit'));
        });
    });
});