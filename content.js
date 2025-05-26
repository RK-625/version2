// Content script for GeeksforGeeks problem pages
console.log('GFG to Notion Sync content script loaded');

let isListening = false;

// Function to extract problem data from the page
function extractProblemData() {
    try {
        // Extract problem title - Updated selectors and logic
        const titleElement = document.querySelector('.problems_header_content__title__L2cCq, .problem-statement > h2, h1.title');
        const problemTitle = titleElement ? titleElement.textContent.trim() : '';
        
        // Fallback for title if not found with primary selectors
        const title = problemTitle || document.querySelector('h1')?.textContent.trim() || 'Unknown Problem';

        // Extract difficulty
        const difficultyElement = document.querySelector('.problems_header_content__difficulty__B3zR9, .difficulty-level');
        let difficulty = 'Medium'; // default
        if (difficultyElement) {
            const diffText = difficultyElement.textContent.toLowerCase();
            if (diffText.includes('easy') || diffText.includes('basic')) difficulty = 'Easy';
            else if (diffText.includes('hard')) difficulty = 'Hard';
            else if (diffText.includes('medium')) difficulty = 'Medium';
        }

        // Extract only topic tags (not company or interview tags)
        const topicTagsContainer = document.querySelector('.problems_tag_container__kWANg, .problemTagsContainer');
        let topics = [];
        
        if (topicTagsContainer) {
            // Look specifically for topic tags
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

        // Fallback for topics if none found
        if (topics.length === 0) {
            const defaultTags = ['Arrays', 'Data Structures', 'Algorithms'];
            const problemText = document.body.textContent.toLowerCase();
            topics = defaultTags.filter(tag => problemText.includes(tag.toLowerCase()));
        }

        // Get current URL
        const url = window.location.href;

        // Try to extract solution code
        let solution = '';
        let language = 'cpp';
        
        // Look for code editor content
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

        // If no solution found in editor, try to get it from visible code blocks
        if (!solution) {
            const codeBlocks = document.querySelectorAll('pre code, .code-block');
            for (const block of codeBlocks) {
                if (block.textContent && block.textContent.length > 50) {
                    solution = block.textContent;
                    break;
                }
            }
        }

        // Try to detect language
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
            solution,
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
        if (currentUrl.includes('/problems/')) {
            setTimeout(initialize, 1000);
        }
    }
}, 1000);