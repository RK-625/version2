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

// Function to map language codes to Notion-supported languages
function mapLanguageToNotion(language) {
    const languageMap = {
        'cpp': 'c++',
        'c++': 'c++',
        'java': 'java',
        'python': 'python',
        'javascript': 'javascript',
        'js': 'javascript',
        'c': 'c',
        'csharp': 'c#',
        'c#': 'c#',
        'go': 'go',
        'rust': 'rust',
        'php': 'php',
        'ruby': 'ruby',
        'swift': 'swift',
        'kotlin': 'kotlin',
        'scala': 'scala',
        'perl': 'perl',
        'r': 'r',
        'matlab': 'matlab',
        'sql': 'sql',
        'html': 'html',
        'css': 'css',
        'json': 'json',
        'xml': 'xml',
        'yaml': 'yaml',
        'markdown': 'markdown',
        'bash': 'bash',
        'shell': 'bash',
        'powershell': 'powershell'
    };

    const normalizedLang = (language || 'javascript').toLowerCase();
    return languageMap[normalizedLang] || 'plain text';
}

// Function to sync problem data to Notion
async function syncProblemToNotion(problemData) {
    try {
        // Get stored settings
        const settings = await chrome.storage.sync.get(['notionApiKey', 'databaseId']);
        
        if (!settings.notionApiKey || !settings.databaseId) {
            throw new Error('Please configure Notion API key and Database ID in extension options');
        }

        // Map the language to a Notion-supported language
        const notionLanguage = mapLanguageToNotion(problemData.language);

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
                            language: notionLanguage
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
