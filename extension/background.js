// Background script for Gmail Delay Extension
console.log('Gmail Delay Extension background script loaded');

// Extension installation
chrome.runtime.onInstalled.addListener((details) => {
    console.log('Extension installed:', details.reason);
    
    if (details.reason === 'install') {
        // Show welcome notification
        chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icon48.png',
            title: 'Gmail Delay & Edit Installed!',
            message: 'Start delaying emails by composing in Gmail. Make sure to start the Python backend server.'
        });
    }
});

// Handle messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Background received message:', request);
    
    if (request.action === 'emailQueued') {
        // Show notification when email is queue
