// Popup script for Gmail Delay Extension
const API_BASE = 'http://localhost:8000';

let currentUserEmail = '';
let currentEditingEmail = null;

// DOM elements
const statusEl = document.getElementById('status');
const errorEl = document.getElementById('error');
const loadingEl = document.getElementById('loading');
const emailsContainer = document.getElementById('emails-container');
const refreshBtn = document.getElementById('refresh');
const editModal = document.getElementById('editModal');

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Popup loaded');
    
    // Get current user email
    await getCurrentUserEmail();
    
    // Check server connection
    await checkServerStatus();
    
    // Load queued emails
    await loadQueuedEmails();
    
    // Set up event listeners
    setupEventListeners();
});

// Get current user's email
async function getCurrentUserEmail() {
    try {
        // Try to get from active Gmail tab
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        if (tab && tab.url && tab.url.includes('mail.google.com')) {
            // Execute script to get user email from Gmail
            const results = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                function: () => {
                    // Try multiple methods to get user email
                    const emailSelectors = [
                        '[email]',
                        '[data-hovercard-id*="@"]',
                        '.gb_A',
                        '.gb_ab'
                    ];
                    
                    for (const selector of emailSelectors) {
                        const element = document.querySelector(selector);
                        if (element) {
                            const email = element.getAttribute('email') || 
                                         element.getAttribute('data-hovercard-id') ||
                                         element.textContent;
                            if (email && email.includes('@')) {
                                return email;
                            }
                        }
                    }
                    
                    // Fallback: extract from URL or other sources
                    return 'user@gmail.com';
                }
            });
            
            if (results && results[0] && results[0].result) {
                currentUserEmail = results[0].result;
            }
        }
        
        if (!currentUserEmail) {
            currentUserEmail = 'user@gmail.com'; // Fallback
        }
        
        console.log('Current user email:', currentUserEmail);
    } catch (error) {
        console.error('Error getting user email:', error);
        currentUserEmail = 'user@gmail.com';
    }
}

// Check if backend server is running
async function checkServerStatus() {
    try {
        const response = await fetch(`${API_BASE}/`);
        const data = await response.json();
        
        if (data.message) {
            statusEl.className = 'status connected';
            statusEl.innerHTML = '<div class="status-dot"></div><span>Connected to server</span>';
            hideError();
        }
    } catch (error) {
        console.error('Server connection error:', error);
        statusEl.className = 'status disconnected';
        statusEl.innerHTML = '<div class="status-dot"></div><span>Server disconnected</span>';
        showError('Backend server is not running. Please start the Python server on localhost:8000');
    }
}

// Load queued emails from backend
async function loadQueuedEmails() {
    try {
        loadingEl.style.display = 'block';
        emailsContainer.innerHTML = '';
        
        const response = await fetch(`${API_BASE}/queued-emails/${encodeURIComponent(currentUserEmail)}`);
        const data = await response.json();
        
        loadingEl.style.display = 'none';
        
        if (data.emails && data.emails.length > 0) {
            displayEmails(data.emails);
        } else {
            showEmptyState();
        }
        
        hideError();
    } catch (error) {
        console.error('Error loading emails:', error);
        loadingEl.style.display = 'none';
        showError('Failed to load pending emails. Check server connection.');
    }
}

// Display emails in the popup
function displayEmails(emails) {
    emailsContainer.innerHTML = '';
    
    emails.forEach(email => {
        const emailEl = document.createElement('div');
        emailEl.className = 'email-item';
        
        const sendTime = new Date(email.send_time);
        const now = new Date();
        const timeUntilSend = Math.max(0, sendTime - now);
        const minutesUntilSend = Math.floor(timeUntilSend / (1000 * 60));
        
        emailEl.innerHTML = `
            <div class="email-subject">${escapeHtml(email.subject || '(No subject)')}</div>
            <div class="email-to">To: ${email.to.join(', ')}</div>
            <div class="email-timing">
                Sends in ${minutesUntilSend} minutes (${sendTime.toLocaleString()})
                <br><small style="color: #ea4335;">⏰ Extended undo active - can edit/cancel</small>
            </div>
            <div class="email-actions">
                <button class="btn edit-btn" data-email-id="${email.id}">Edit</button>
                <button class="btn danger cancel-btn" data-email-id="${email.id}">Cancel</button>
            </div>
        `;
        
        emailsContainer.appendChild(emailEl);
    });
    
    // Add event listeners to buttons
    document.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const emailId = e.target.getAttribute('data-email-id');
            const email = emails.find(em => em.id === emailId);
            if (email) openEditModal(email);
        });
    });
    
    document.querySelectorAll('.cancel-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const emailId = e.target.getAttribute('data-email-id');
            cancelEmail(emailId);
        });
    });
}

// Show empty state when no emails
function showEmptyState() {
    emailsContainer.innerHTML = `
        <div class="empty-state">
            No emails in extended undo period.<br>
            Compose an email in Gmail to try it out!
        </div>
    `;
}

// Open edit modal
function openEditModal(email) {
    currentEditingEmail = email;
    
    document.getElementById('editSubject').value = email.subject || '';
    document.getElementById('editBody').value = stripHtml(email.body) || '';
    
    // Calculate current delay in minutes
    const sendTime = new Date(email.send_time);
    const now = new Date();
    const minutesUntilSend = Math.max(15, Math.floor((sendTime - now) / (1000 * 60)));
    document.getElementById('editDelay').value = minutesUntilSend;
    
    editModal.style.display = 'block';
}

// Close edit modal
function closeEditModal() {
    editModal.style.display = 'none';
    currentEditingEmail = null;
}

// Save email changes
async function saveEmailChanges() {
    if (!currentEditingEmail) return;
    
    const updates = {
        subject: document.getElementById('editSubject').value,
        body: document.getElementById('editBody').value,
        delay_minutes: parseInt(document.getElementById('editDelay').value) || 15
    };
    
    try {
        const response = await fetch(`${API_BASE}/email/${currentEditingEmail.id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(updates)
        });
        
        const result = await response.json();
        
        if (result.success) {
            closeEditModal();
            await loadQueuedEmails(); // Refresh the list
            showSuccess('Email updated successfully!');
        } else {
            showError('Failed to update email');
        }
    } catch (error) {
        console.error('Error updating email:', error);
        showError('Failed to update email. Check connection.');
    }
}

// Cancel an email
async function cancelEmail(emailId) {
    if (!confirm('Are you sure you want to cancel this email?')) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/email/${emailId}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (result.success) {
            await loadQueuedEmails(); // Refresh the list
            showSuccess('Email cancelled successfully!');
        } else {
            showError('Failed to cancel email');
        }
    } catch (error) {
        console.error('Error cancelling email:', error);
        showError('Failed to cancel email. Check connection.');
    }
}

// Set up event listeners
function setupEventListeners() {
    refreshBtn.addEventListener('click', loadQueuedEmails);
    
    // Edit modal listeners
    document.getElementById('cancelEdit').addEventListener('click', closeEditModal);
    document.getElementById('saveEdit').addEventListener('click', saveEmailChanges);
    
    // Close modal when clicking outside
    editModal.addEventListener('click', (e) => {
        if (e.target === editModal) {
            closeEditModal();
        }
    });
}

// Utility functions
function showError(message) {
    errorEl.textContent = message;
    errorEl.style.display = 'block';
}

function hideError() {
    errorEl.style.display = 'none';
}

function showSuccess(message) {
    // Create temporary success message
    const successEl = document.createElement('div');
    successEl.style.cssText = `
        background: #e8f5e8;
        color: #137333;
        padding: 10px;
        border-radius: 4px;
        font-size: 12px;
        margin-bottom: 10px;
    `;
    successEl.textContent = message;
    
    errorEl.parentNode.insertBefore(successEl, errorEl.nextSibling);
    
    setTimeout(() => {
        if (successEl.parentNode) {
            successEl.parentNode.removeChild(successEl);
        }
    }, 3000);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function stripHtml(html) {
    const div = document.createElement('div');
    div.innerHTML = html;
    return div.textContent || div.innerText || '';
}
