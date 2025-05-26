// Background script for GFG to Notion Sync
chrome.runtime.onInstalled.addListener(() => {
    console.log('GFG to Notion Sync extension installed');
});

chrome.runtime.onStartup.addListener(() => {
    console.log('GFG to Notion Sync extension started');
});

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'syncToNotion') {
        syncProblemToNotion(request.data)
            .then(result => sendResponse({ success: true, result }))
            .catch(error => sendResponse({ success: false, error: error.message }));
        return true; // Keep message channel open for async response
    }
    
    if (request.action === 'getSettings') {
        chrome.storage.sync.get(['notionApiKey', 'databaseId'], (result) => {
            sendResponse(result);
        });
        return true;
    }
});

// Function to sync problem data to Notion
async function syncProblemToNotion(problemData) {
    try {
        // Get stored settings
        const settings = await chrome.storage.sync.get(['notionApiKey', 'databaseId']);
        
        if (!settings.notionApiKey || !settings.databaseId) {
            throw new Error('Please configure Notion API key and Database ID in extension options');
        }

        // Create Notion page
        const response = await fetch('https://api.notion.com/v1/pages', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${settings.notionApiKey}`,
                'Content-Type': 'application/json',
                'Notion-Version': '2022-06-28'
            },
            body: JSON.stringify({
                parent: {
                    database_id: settings.databaseId
                },
                properties: {
                    'Question Name': {
                        title: [
                            {
                                text: {
                                    content: problemData.title
                                }
                            }
                        ]
                    },
                    'Platform': {
                        select: {
                            name: 'GeeksforGeeks'
                        }
                    },
                    'Difficulty': {
                        select: {
                            name: problemData.difficulty
                        }
                    },
                    'Topic': {
                        multi_select: problemData.topics.map(topic => ({ name: topic }))
                    },
                    'Question URL': {
                        url: problemData.url
                    },
                    'Created time': {
                        date: {
                            start: new Date().toISOString()
                        }
                    }
                },
                children: [
                    {
                        object: 'block',
                        type: 'heading_2',
                        heading_2: {
                            rich_text: [
                                {
                                    type: 'text',
                                    text: {
                                        content: 'My Solution'
                                    }
                                }
                            ]
                        }
                    },
                    {
                        object: 'block',
                        type: 'code',
                        code: {
                            rich_text: [
                                {
                                    type: 'text',
                                    text: {
                                        content: problemData.solution || 'No solution code captured'
                                    }
                                }
                            ],
                            language: problemData.language || 'javascript'
                        }
                    }
                ]
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Notion API error: ${errorData.message || response.statusText}`);
        }

        const result = await response.json();
        console.log('Successfully synced to Notion:', result);
        return result;

    } catch (error) {
        console.error('Error syncing to Notion:', error);
        throw error;
    }
}

// Function to show notification
function showNotification(title, message, type = 'basic') {
    chrome.notifications.create({
        type: type,
        iconUrl: 'images/icon48.png',
        title: title,
        message: message
    });
}
