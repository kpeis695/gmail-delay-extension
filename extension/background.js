// Background script for Gmail Delay Extension
console.log('Gmail Delay Extension background script loaded');

// Extension installation
chrome.runtime.onInstalled.addListener((details) => {
    console.log('Extension installed:', details.reason);
    
    if (details.reason === 'install') {
        // Show welcome notification
        chrome.notifications.create({
            type: 'basic',
            iconUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', // 1x1 transparent pixel
            title: 'Gmail Delay & Edit Installed!',
            message: 'Start delaying emails by composing in Gmail. Make sure to start the Python backend server.'
        });
    }
});

// Handle messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Background received message:', request);
    
    if (request.action === 'emailQueued') {
        // Show notification when email is queued
        chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icon48.png',
            title: 'Email Queued Successfully!',
            message: `Your email will be sent in ${request.delayMinutes} minutes.`
        });
        
        sendResponse({ success: true });
    }
    
    if (request.action === 'checkServerStatus') {
        // Check if backend server is running
        fetch('http://localhost:8000/')
            .then(response => response.json())
            .then(data => {
                sendResponse({ connected: true, data });
            })
            .catch(error => {
                sendResponse({ connected: false, error: error.message });
            });
        
        return true; // Will respond asynchronously
    }
    
    if (request.action === 'getUserEmail') {
        // Help content script get user email
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                chrome.scripting.executeScript({
                    target: { tabId: tabs[0].id },
                    function: () => {
                        // Extract user email from Gmail
                        const emailElement = document.querySelector('[email]') || 
                                            document.querySelector('[data-hovercard-id*="@"]');
                        
                        if (emailElement) {
                            return emailElement.getAttribute('email') || 
                                   emailElement.getAttribute('data-hovercard-id');
                        }
                        return null;
                    }
                }, (results) => {
                    const userEmail = results && results[0] ? results[0].result : null;
                    sendResponse({ userEmail });
                });
            } else {
                sendResponse({ userEmail: null });
            }
        });
        
        return true; // Will respond asynchronously
    }
});

// Handle extension icon click
chrome.action.onClicked.addListener((tab) => {
    // This will open the popup automatically
    console.log('Extension icon clicked');
});

// Handle alarms (for future use with local scheduling)
chrome.alarms.onAlarm.addListener((alarm) => {
    console.log('Alarm triggered:', alarm.name);
    // Could be used for backup scheduling if server is down
});

// Monitor server connection periodically
setInterval(async () => {
    try {
        const response = await fetch('http://localhost:8000/');
        if (response.ok) {
            chrome.storage.local.set({ serverConnected: true });
        }
    } catch (error) {
        chrome.storage.local.set({ serverConnected: false });
    }
}, 30000); // Check every 30 seconds
