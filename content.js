// Content script for GeeksforGeeks problem pages
console.log('GFG to Notion Sync content script loaded');

let isListening = false;

// Function to extract problem data from the page
function extractProblemData() {
    try {
        // 1. Extract problem title - Use <h1> tag as shown in the screenshot
        let title = '';
        const h1 = document.querySelector('h1');
        if (h1 && h1.textContent.trim().length > 0) {
            title = h1.textContent.trim();
        } else {
            title = 'Unknown Problem';
        }

        // 2. Extract difficulty
        let difficulty = 'Medium'; // default
        const difficultyElement = document.querySelector(
            '.problems_header_content__difficulty__B3zR9, .difficulty-level'
        );
        if (difficultyElement) {
            const diffText = difficultyElement.textContent.toLowerCase();
            if (diffText.includes('easy') || diffText.includes('basic')) difficulty = 'Easy';
            else if (diffText.includes('hard')) difficulty = 'Hard';
            else if (diffText.includes('medium')) difficulty = 'Medium';
        }

        // 3. Extract topic tags
        let topics = [];
        const topicTagsContainer = document.querySelector('.problems_tag_container__kWANg, .problemTagsContainer');
        if (topicTagsContainer) {
            const topicSection = Array.from(document.querySelectorAll('section, div'))
                .find(section => section.textContent.includes('Topic Tags'));
            if (topicSection) {
                const tagElements = topicSection.querySelectorAll('a, span.tag');
                topics = Array.from(tagElements)
                    .map(el => el.textContent.trim())
                    .filter(topic =>
                        topic &&
                        !topic.includes('Company') &&
                        !topic.includes('Interview') &&
                        topic !== 'Topic Tags'
                    );
            }
        }
        if (topics.length === 0) {
            const defaultTags = ['Arrays', 'Data Structures', 'Algorithms'];
            const problemText = document.body.textContent.toLowerCase();
            topics = defaultTags.filter(tag => problemText.includes(tag.toLowerCase()));
        }

        const url = window.location.href;

        // 4. Extract solution code from CodeMirror
        let solution = '';
        let language = 'cpp';

        // Use CodeMirror rendered lines
        const codeMirrorLines = document.querySelectorAll('.CodeMirror-code .CodeMirror-line');
        if (codeMirrorLines.length > 0) {
            solution = Array.from(codeMirrorLines)
                .map(line => line.textContent)
                .join('\n');
        }

        // If no solution is found, fallback to visible textareas (if any)
        if (!solution) {
            const codeEditors = [
                '.monaco-editor textarea',
                '.CodeMirror textarea',
                '#editor textarea',
                '.ace_text-input',
                '[class*="editor"] textarea',
                '.code-editor textarea'
            ];
            for (const selector of codeEditors) {
                const editor = document.querySelector(selector);
                if (editor && editor.value) {
                    solution = editor.value;
                    break;
                }
            }
        }

        // 5. Detect language from selector dropdown
        const langSelectors = document.querySelectorAll('select[class*="lang"], .language-selector');
        if (langSelectors.length > 0) {
            const langText = langSelectors[0].textContent.toLowerCase();
            if (langText.includes('java')) language = 'java';
            else if (langText.includes('python')) language = 'python';
            else if (langText.includes('javascript')) language = 'javascript';
            else if (langText.includes('c++')) language = 'cpp';
        }

        return {
            title,
            difficulty,
            topics: topics.length > 0 ? topics : ['Data Structures'],
            url,
            solution: solution.trim(),
            language,
            timestamp: new Date().toISOString()
        };
    } catch (error) {
        console.error('Error extracting problem data:', error);
        return null;
    }
}

// Function to detect successful submission
function detectSuccessfulSubmission() {
    // Look for success indicators
    const successSelectors = [
        '.success-message',
        '[class*="success"]',
        '.accepted',
        '[class*="accepted"]',
        '.correct',
        '[class*="correct"]'
    ];

    for (const selector of successSelectors) {
        const element = document.querySelector(selector);
        if (element && element.textContent.toLowerCase().includes('accept')) {
            return true;
        }
    }

    // Check for green checkmarks or success icons
    const successIcons = document.querySelectorAll('.fa-check, .checkmark, [class*="check"]');
    return successIcons.length > 0;
}

// Function to sync problem to Notion
async function syncProblem() {
    const problemData = extractProblemData();
    if (!problemData) {
        console.error('Could not extract problem data');
        return;
    }

    console.log('Syncing problem data:', problemData);

    try {
        const response = await chrome.runtime.sendMessage({
            action: 'syncToNotion',
            data: problemData
        });

        if (response.success) {
            console.log('Successfully synced to Notion');
            showSuccessMessage('Problem synced to Notion successfully!');
        } else {
            console.error('Failed to sync to Notion:', response.error);
            showErrorMessage('Failed to sync to Notion: ' + response.error);
        }
    } catch (error) {
        console.error('Error syncing problem:', error);
        showErrorMessage('Error syncing problem: ' + error.message);
    }
}

// Function to show success message
function showSuccessMessage(message) {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #4CAF50;
        color: white;
        padding: 15px;
        border-radius: 5px;
        z-index: 10000;
        font-family: Arial, sans-serif;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    `;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 5000);
}

// Function to show error message
function showErrorMessage(message) {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #f44336;
        color: white;
        padding: 15px;
        border-radius: 5px;
        z-index: 10000;
        font-family: Arial, sans-serif;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    `;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 5000);
}

// Add sync button to the page
function addSyncButton() {
    if (document.getElementById('gfg-notion-sync-btn')) return; // Button already exists

    const button = document.createElement('button');
    button.id = 'gfg-notion-sync-btn';
    button.textContent = '📝 Sync to Notion';
    button.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: #2196F3;
        color: white;
        border: none;
        padding: 12px 20px;
        border-radius: 25px;
        cursor: pointer;
        z-index: 10000;
        font-family: Arial, sans-serif;
        font-size: 14px;
        box-shadow: 0 4px 8px rgba(0,0,0,0.2);
        transition: all 0.3s ease;
    `;

    button.addEventListener('mouseover', () => {
        button.style.background = '#1976D2';
        button.style.transform = 'scale(1.05)';
    });

    button.addEventListener('mouseout', () => {
        button.style.background = '#2196F3';
        button.style.transform = 'scale(1)';
    });

    button.addEventListener('click', syncProblem);
    document.body.appendChild(button);
}

// Initialize the content script
function initialize() {
    console.log('Initializing GFG to Notion Sync on:', window.location.href);
    
    // Add sync button
    addSyncButton();

    // Monitor for successful submissions (optional automatic sync)
    if (!isListening) {
        isListening = true;
        
        // Watch for DOM changes that might indicate successful submission
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === 1) { // Element node
                        const text = node.textContent?.toLowerCase() || '';
                        if (text.includes('accepted') || text.includes('correct') || text.includes('success')) {
                            setTimeout(() => {
                                if (detectSuccessfulSubmission()) {
                                    console.log('Successful submission detected!');
                                    // Uncomment the next line for automatic sync
                                    // syncProblem();
                                }
                            }, 2000);
                        }
                    }
                });
            });
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }
}

// Wait for page to be fully loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
} else {
    initialize();
}

// Re-initialize if navigating to a new problem (for SPAs)
let currentUrl = window.location.href;
setInterval(() => {
    if (window.location.href !== currentUrl) {
        currentUrl = window.location.href;
        initialize();
    }
}, 1000);

// Listen for sync command from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'syncProblem') {
        syncProblem().then(() => sendResponse({ success: true }))
            .catch(() => sendResponse({ success: false }));
        return true;
    }
});
