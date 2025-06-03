// Gmail Delay Extension - Content Script
console.log('Gmail Delay Extension loaded');

// Wait for Gmail to load
function waitForGmail() {
    return new Promise((resolve) => {
        const checkGmail = () => {
            if (document.querySelector('[role="main"]')) {
                resolve();
            } else {
                setTimeout(checkGmail, 1000);
            }
        };
        checkGmail();
    });
}

// Extract email data from Gmail compose window
function extractEmailData(composeElement) {
    try {
        // Get recipients
        const toField = composeElement.querySelector('input[name="to"]') || 
                       composeElement.querySelector('[email]') ||
                       composeElement.querySelector('[data-hovercard-id]');
        
        const recipients = [];
        if (toField) {
            const toText = toField.value || toField.textContent || '';
            recipients.push(...toText.split(',').map(email => email.trim()).filter(email => email));
        }

        // Get subject
        const subjectField = composeElement.querySelector('input[name="subjectbox"]') ||
                           composeElement.querySelector('[placeholder*="Subject"]');
        const subject = subjectField ? subjectField.value : '';

        // Get email body
        const bodyField = composeElement.querySelector('[contenteditable="true"][role="textbox"]') ||
                         composeElement.querySelector('.Am.Al.editable');
        const body = bodyField ? bodyField.innerHTML : '';

        return {
            to: recipients,
            subject: subject,
            body: body
        };
    } catch (error) {
        console.error('Error extracting email data:', error);
        return null;
    }
}

// Create delay selection modal
function createDelayModal(emailData, sendButton) {
    // Create modal overlay
    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
    `;

    // Create modal
    const modal = document.createElement('div');
    modal.style.cssText = `
        background: white;
        padding: 30px;
        border-radius: 8px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        max-width: 500px;
        width: 90%;
        font-family: 'Google Sans', Roboto, sans-serif;
    `;

    modal.innerHTML = `
        <h2 style="margin: 0 0 20px 0; color: #1a73e8;">Delay Email Sending</h2>
        <p style="margin: 0 0 20px 0; color: #5f6368;">Choose when to send this email:</p>
        
        <div style="margin-bottom: 20px;">
            <label style="display: block; margin-bottom: 10px;">
                <input type="radio" name="delay" value="15" checked> 15 minutes
            </label>
            <label style="display: block; margin-bottom: 10px;">
                <input type="radio" name="delay" value="60"> 1 hour
            </label>
            <label style="display: block; margin-bottom: 10px;">
                <input type="radio" name="delay" value="240"> 4 hours
            </label>
            <label style="display: block; margin-bottom: 10px;">
                <input type="radio" name="delay" value="1440"> 1 day
            </label>
            <label style="display: block; margin-bottom: 10px;">
                <input type="radio" name="delay" value="custom"> Custom:
                <input type="number" id="customMinutes" placeholder="minutes" style="margin-left: 10px; padding: 5px; width: 80px;">
            </label>
        </div>

        <div style="text-align: right;">
            <button id="cancelDelay" style="
                background: #f8f9fa;
                border: 1px solid #dadce0;
                color: #3c4043;
                padding: 8px 16px;
                margin-right: 10px;
                border-radius: 4px;
                cursor: pointer;
            ">Cancel</button>
            <button id="confirmDelay" style="
                background: #1a73e8;
                border: none;
                color: white;
                padding: 8px 16px;
                border-radius: 4px;
                cursor: pointer;
            ">Queue Email</button>
        </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Handle custom delay input
    const customRadio = modal.querySelector('input[value="custom"]');
    const customInput = modal.querySelector('#customMinutes');
    
    customInput.addEventListener('focus', () => {
        customRadio.checked = true;
    });

    // Handle cancel
    modal.querySelector('#cancelDelay').addEventListener('click', () => {
        document.body.removeChild(overlay);
    });

    // Handle confirm
    modal.querySelector('#confirmDelay').addEventListener('click', () => {
        const selectedDelay = modal.querySelector('input[name="delay"]:checked').value;
        let delayMinutes;

        if (selectedDelay === 'custom') {
            delayMinutes = parseInt(customInput.value) || 15;
        } else {
            delayMinutes = parseInt(selectedDelay);
        }

        queueEmail(emailData, delayMinutes);
        document.body.removeChild(overlay);
    });

    // Close on overlay click
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            document.body.removeChild(overlay);
        }
    });
}

// Send email data to backend
async function queueEmail(emailData, delayMinutes) {
    try {
        // Get user email (you'll need to implement this)
        const userEmail = await getUserEmail();
        
        const response = await fetch('http://localhost:8000/queue-email', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                ...emailData,
                delay_minutes: delayMinutes,
                user_email: userEmail
            })
        });

        const result = await response.json();
        
        if (result.success) {
            // Show success message
            showNotification(`Email queued! Will send in ${delayMinutes} minutes.`, 'success');
            
            // Close the compose window
            const composeWindow = document.querySelector('[role="dialog"]');
            if (composeWindow) {
                const closeButton = composeWindow.querySelector('[data-tooltip="Close"]') || 
                                  composeWindow.querySelector('[aria-label="Close"]');
                if (closeButton) closeButton.click();
            }
        } else {
            showNotification('Failed to queue email. Please try again.', 'error');
        }
    } catch (error) {
        console.error('Error queuing email:', error);
        showNotification('Connection error. Make sure the backend server is running.', 'error');
    }
}

// Get user's Gmail address
async function getUserEmail() {
    // Try to extract from Gmail interface
    const userElement = document.querySelector('[email]') || 
                       document.querySelector('[data-hovercard-id*="@"]');
    
    if (userElement) {
        return userElement.getAttribute('email') || userElement.getAttribute('data-hovercard-id');
    }
    
    // Fallback: try to get from URL or other sources
    return 'user@gmail.com'; // You'll want to improve this
}

// Show notification
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        border-radius: 4px;
        color: white;
        z-index: 10001;
        font-family: 'Google Sans', Roboto, sans-serif;
        max-width: 300px;
        ${type === 'success' ? 'background: #137333;' : 'background: #d93025;'}
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 5000);
}

// Intercept send button clicks
function interceptSendButtons() {
    // Use event delegation to catch all send buttons
    document.addEventListener('click', (event) => {
        const target = event.target;
        
        // Check if clicked element is a send button
        if (target.textContent?.includes('Send') || 
            target.getAttribute('data-tooltip')?.includes('Send') ||
            target.getAttribute('aria-label')?.includes('Send')) {
            
            // Find the compose window
            const composeWindow = target.closest('[role="dialog"]') || 
                                target.closest('.M9') || 
                                target.closest('.nH');
            
            if (composeWindow) {
                event.preventDefault();
                event.stopPropagation();
                
                const emailData = extractEmailData(composeWindow);
                if (emailData && emailData.to.length > 0) {
                    createDelayModal(emailData, target);
                } else {
                    showNotification('Could not extract email data. Please try again.', 'error');
                }
            }
        }
    }, true); // Use capture phase
}

// Initialize when Gmail loads
waitForGmail().then(() => {
    console.log('Gmail loaded, initializing delay extension...');
    interceptSendButtons();
    
    // Also watch for new compose windows (Gmail is a single-page app)
    const observer = new MutationObserver(() => {
        // Re-run interception for dynamically loaded content
        interceptSendButtons();
    });
    
    observer.observe(document.body, { childList: true, subtree: true });
});
