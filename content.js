// Content script for GeeksforGeeks problem pages
console.log('GFG to Notion Sync content script loaded');

let isListening = false;

// Function to extract problem data from the page
function extractProblemData() {
    try {
        // 1. Extract problem title and URL
        let title = '';
        const pageUrl = window.location.href;
        
        // First try: Problem page header
        const problemHeaderTitle = document.querySelector('[class*="problems_header_content__title"]');
        if (problemHeaderTitle && problemHeaderTitle.textContent.trim()) {
            title = problemHeaderTitle.textContent.trim();
        }
        
        // Second try: Problem name from breadcrumb or navigation
        if (!title) {
            const problemNav = document.querySelector('[class*="problemTitle"], [class*="problem-name"], .current-problem');
            if (problemNav) {
                title = problemNav.textContent.trim();
            }
        }

        // Third try: H1 heading
        if (!title) {
            const h1 = document.querySelector('h1');
            if (h1) {
                title = h1.textContent.trim();
            }
        }

        // Fourth try: URL parsing (as fallback)
        if (!title || title === 'Unknown Problem') {
            const urlPath = window.location.pathname;
            const problemSegment = urlPath.split('/').find(segment => 
                segment.includes('algorithm') || 
                segment.includes('problem') ||
                segment.length > 10
            );
            
            if (problemSegment) {
                title = problemSegment
                    .split('-')
                    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                    .join(' ')
                    .replace(/\d+$/, '') // Remove trailing numbers
                    .trim();
            }
        }

        // Clean up the title
        if (title) {
            // Remove any prefixes like "Problem:", "Practice:", etc.
            title = title.replace(/^(Problem:|Practice:|Question:|Solution:)\s*/i, '');
            // Remove any suffixes like "- GFG", "| Practice", etc.
            title = title.replace(/\s*[-|]\s*(GFG|GeeksforGeeks|Practice|Solution).*$/i, '');
            // Remove multiple spaces and trim
            title = title.replace(/\s+/g, ' ').trim();
        }

        if (!title) {
            title = 'Unknown Problem';
        }

        // 2. Extract difficulty
        let difficulty = 'Medium'; // default
        const difficultyElement = document.querySelector(
            '.problems_header_content__difficulty__B3zR9, .difficulty-level'
        );
        if (difficultyElement) {
            const diffText = difficultyElement.textContent.toLowerCase();
            if (diffText.includes('basic')) difficulty = 'Basic';
            else if (diffText.includes('easy')) difficulty = 'Easy';
            else if (diffText.includes('hard')) difficulty = 'Hard';
            else if (diffText.includes('medium')) difficulty = 'Medium';
        }

        // 3. Extract all types of tags
        let topics = [];
        let companyTags = [];
        let interviewTags = [];
        
        // First try: Look for tags in the dedicated sections
        const problemPage = document.querySelector('.problems_problem_content__Xm_eO, .problem-statement');
        
        // Find company tags section
        const companySection = Array.from(document.querySelectorAll('section, div'))
            .find(section => {
                const header = section.querySelector('b, strong, h3, h4, div');
                return header && header.textContent.trim().toLowerCase().includes('company tags');
            });
        if (companySection) {
            const companyElements = companySection.querySelectorAll('a[href*="company"], span[class*="company"], .company-tag-item');
            companyTags = Array.from(companyElements)
                .map(el => el.textContent.trim())
                .filter(company => company && !company.toLowerCase().includes('company tags'))
                .map(company => company.replace(/^company:\s*/i, '').trim());
        }

        // Find interview tags section
        const interviewSection = Array.from(document.querySelectorAll('div[class*="tags"], .problem-tag-list, section'))
            .find(section => {
                const header = section.querySelector('b, strong, h3, h4, div, p');
                return header && header.textContent.trim().toLowerCase().includes('interview');
            });

        if (interviewSection) {
            const interviewElements = interviewSection.querySelectorAll('a, span, .tag');
            interviewTags = Array.from(interviewElements)
                .map(el => el.textContent.trim())
                .filter(tag => {
                    const tagLower = tag.toLowerCase();
                    return tag && 
                           tag.length > 1 && 
                           !tagLower.includes('interview tags') &&
                           !tagLower.includes('company tags') &&
                           !tagLower.includes('topic tags');
                })
                .map(tag => tag.replace(/^interview:\s*/i, '').trim());
        }

        // Find topic tags section
        const topicSection = Array.from(document.querySelectorAll('section, div'))
            .find(section => {
                const header = section.querySelector('b, strong, h3, h4, div');
                return header && header.textContent.trim().toLowerCase() === 'topic tags';
            });
        if (topicSection) {
            const topicElements = topicSection.querySelectorAll('a, span[class*="tag"]');
            topics = Array.from(topicElements)
                .map(el => el.textContent.trim())
                .filter(topic => 
                    topic && 
                    !topic.toLowerCase().includes('company') && 
                    !topic.toLowerCase().includes('interview') && 
                    topic.toLowerCase() !== 'topic tags'
                );
        }

        // If no topics found through dedicated section, try alternative approach
        if (topics.length === 0) {
            const problemPage = document.querySelector('.problems_problem_content__Xm_eO, .problem-statement');
            if (problemPage) {
                // Look for topic tags section
                const topicSection = Array.from(problemPage.querySelectorAll('section, div'))
                    .find(section => {
                        const header = section.querySelector('b, strong, h3, h4');
                        return header && header.textContent.trim().toLowerCase() === 'topic tags';
                    });
                
                if (topicSection) {
                    const tagElements = topicSection.querySelectorAll('a[href*="topic"], span[class*="tag"]');
                    topics = Array.from(tagElements)
                        .map(el => el.textContent.trim())
                        .filter(topic => topic && !topic.toLowerCase().includes('company') && 
                               !topic.toLowerCase().includes('interview') && 
                               topic.toLowerCase() !== 'topic tags');
                }
            }
        }

        // Only use default tags if no topics were found
        if (topics.length === 0) {
            const problemText = document.body.textContent.toLowerCase();
            const potentialTags = ['Array', 'String', 'Tree', 'Dynamic Programming', 'Graph', 'Linked List', 'Stack', 'Queue'];
            topics = potentialTags.filter(tag => problemText.includes(tag.toLowerCase()));
            
            if (topics.length === 0) {
                topics = ['Data Structures'];
            }
        }

        // Debug logging
        console.log('Extracted tags:', {
            topics,
            companyTags,
            interviewTags
        });

        if (companyTags.length === 0) {
            // Fallback for company tags
            const allText = document.body.textContent.toLowerCase();
            const companySection = allText.indexOf('company tags');
            if (companySection !== -1) {
                const companyText = allText.substring(companySection, companySection + 200);
                console.log('Looking for companies in:', companyText);
            }
        }

        // Clean up any empty or malformed tags
        companyTags = companyTags.filter(tag => tag && tag.length > 1);
        interviewTags = interviewTags.filter(tag => tag && tag.length > 1);
        topics = topics.filter(tag => tag && tag.length > 1);

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
            platform: 'GFG', // Changed from GeeksforGeeks to GFG
            difficulty,
            topics: topics.length > 0 ? topics : ['Data Structures'],
            companyTags, // New field for company tags
            interviewTags, // New field for interview tags
            url: pageUrl,
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

// Function to show notification message
function showNotification(message, type = 'success') {
    // Remove any existing notifications
    const existingNotification = document.querySelector('.gfg-notification');
    if (existingNotification) {
        existingNotification.remove();
    }

    const notification = document.createElement('div');
    notification.className = 'gfg-notification';
    
    const icon = type === 'success' ? 'check-circle' : 'exclamation-circle';
    const background = type === 'success' ? 'rgba(76, 175, 80, 0.9)' : 'rgba(244, 67, 54, 0.9)';
    
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${background};
        color: white;
        padding: 16px 24px;
        border-radius: 12px;
        z-index: 10000;
        font-family: 'Inter', sans-serif;
        backdrop-filter: blur(8px);
        border: 1px solid rgba(255, 255, 255, 0.2);
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
        display: flex;
        align-items: center;
        gap: 12px;
        transform: translateX(120%);
        transition: transform 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55);
    `;

    notification.innerHTML = `
        <i class="fas fa-${icon}" style="font-size: 20px;"></i>
        <span>${message}</span>
    `;
    
    document.body.appendChild(notification);
    
    // Trigger animation
    setTimeout(() => {
        notification.style.transform = 'translateX(0)';
    }, 100);

    // Remove notification
    setTimeout(() => {
        notification.style.transform = 'translateX(120%)';
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, 5000);
}

// Function to show success message
function showSuccessMessage(message) {
    showNotification(message, 'success');
}

// Function to show error message
function showErrorMessage(message) {
    showNotification(message, 'error');
}

// Add sync button to the page
function addSyncButton() {
    if (document.getElementById('gfg-notion-sync-btn')) return; // Button already exists

    const button = document.createElement('button');
    button.id = 'gfg-notion-sync-btn';
    // Using rocket emoji as logo
    button.innerHTML = '🚀';
    button.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: rgba(255, 255, 255, 0.1);
        backdrop-filter: blur(5px);
        border: 1px solid rgba(255, 255, 255, 0.2);
        color: white;
        width: 30px;
        height: 30px;
        border-radius: 50%;
        cursor: move;
        z-index: 10000;
        font-size: 10px;
        box-shadow: 0 4px 8px rgba(0,0,0,0.2);
        transition: all 0.3s ease;
        display: flex;
        align-items: center;
        justify-content: center;
    `;

    // Add Font Awesome if not already present
    if (!document.querySelector('link[href*="font-awesome"]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css';
        document.head.appendChild(link);
    }

    // Make the button draggable
    let isDragging = false;
    let currentX;
    let currentY;
    let initialX;
    let initialY;
    let xOffset = 0;
    let yOffset = 0;

    button.addEventListener('mousedown', (e) => {
        initialX = e.clientX - xOffset;
        initialY = e.clientY - yOffset;
        if (e.target === button) {
            isDragging = true;
        }
    });

    document.addEventListener('mousemove', (e) => {
        if (isDragging) {
            e.preventDefault();
            currentX = e.clientX - initialX;
            currentY = e.clientY - initialY;
            xOffset = currentX;
            yOffset = currentY;
            // Use translate3d for hardware acceleration
            button.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;
            // Remove transition during drag for instant response
            button.style.transition = 'none';
        }
    });

    document.addEventListener('mouseup', () => {
        initialX = currentX;
        initialY = currentY;
        isDragging = false;
        // Restore transition after drag ends
        button.style.transition = 'all 0.3s ease';
    });

    // Add hover effect
    button.addEventListener('mouseover', () => {
        button.style.background = 'rgba(255, 255, 255, 0.2)';
        button.style.transform = `translate(${currentX}px, ${currentY}px) scale(1.1)`;
    });

    button.addEventListener('mouseout', () => {
        button.style.background = 'rgba(255, 255, 255, 0.1)';
        button.style.transform = `translate(${currentX}px, ${currentY}px) scale(1)`;
    });

    // Add click handler
    button.addEventListener('click', async (e) => {
        if (!isDragging) {
            const originalText = button.innerHTML;
            button.style.cursor = 'wait';
            
            try {
                await syncProblem();
                // Show success state
                button.innerHTML = '✓';
                button.style.background = '#4CAF50';
                
                setTimeout(() => {
                    button.innerHTML = originalText;
                    button.style.background = 'rgba(255, 255, 255, 0.1)';
                }, 1000);
            } catch (error) {
                // Show error state
                button.innerHTML = '✕';
                button.style.background = '#f44336';
                
                setTimeout(() => {
                    button.innerHTML = originalText;
                    button.style.background = 'rgba(255, 255, 255, 0.1)';
                }, 1000);
            }
            
            button.style.cursor = 'move';
        }
    });

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
