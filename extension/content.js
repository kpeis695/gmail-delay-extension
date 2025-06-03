// Gmail Extended Undo Send - Content Script
console.log('Gmail Extended Undo Send loaded');

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

// Create extended undo modal
function createExtendedUndoModal(emailData, sendButton) {
    // Create modal overlay
    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        z-index: 999999;
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
        <h2 style="margin: 0 0 20px 0; color: #1a73e8;">📧 Extended Undo Send</h2>
        <p style="margin: 0 0 20px 0; color: #5f6368;">Your email will be sent after the undo period expires. You can edit or cancel anytime during this period.</p>
        
        <div style="margin-bottom: 20px;">
            <label style="display: block; margin-bottom: 10px;">
                <input type="radio" name="undoPeriod" value="5" checked> 5 minutes (can undo until then)
            </label>
            <label style="display: block; margin-bottom: 10px;">
                <input type="radio" name="undoPeriod" value="30"> 30 minutes
            </label>
            <label style="display: block; margin-bottom: 10px;">
                <input type="radio" name="undoPeriod" value="120"> 2 hours
            </label>
            <label style="display: block; margin-bottom: 10px;">
                <input type="radio" name="undoPeriod" value="480"> 8 hours
            </label>
            <label style="display: block; margin-bottom: 10px;">
                <input type="radio" name="undoPeriod" value="1440"> 24 hours
            </label>
            <label style="display: block; margin-bottom: 10px;">
                <input type="radio" name="undoPeriod" value="custom"> Custom:
                <input type="number" id="customMinutes" placeholder="minutes" style="margin-left: 10px; padding: 5px; width: 80px;">
            </label>
        </div>

        <div style="background: #f8f9fa; padding: 15px; border-radius: 6px; margin-bottom: 20px; font-size: 13px; color: #5f6368;">
            💡 <strong>How it works:</strong> Your email will be held and can be edited or cancelled until the undo period expires. Only then will it actually be delivered to the recipient.
        </div>

        <div style="text-align: right;">
            <button id="cancelSend" style="
                background: #f8f9fa;
                border: 1px solid #dadce0;
                color: #3c4043;
                padding: 8px 16px;
                margin-right: 10px;
                border-radius: 4px;
                cursor: pointer;
            ">Cancel Send</button>
            <button id="enableExtendedUndo" style="
                background: #1a73e8;
                border: none;
                color: white;
                padding: 8px 16px;
                border-radius: 4px;
                cursor: pointer;
            ">Enable Extended Undo</button>
        </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Handle custom undo period input
    const customRadio = modal.querySelector('input[value="custom"]');
    const customInput = modal.querySelector('#customMinutes');
    
    customInput.addEventListener('focus', () => {
        customRadio.checked = true;
    });

    // Handle cancel
    modal.querySelector('#cancelSend').addEventListener('click', () => {
        document.body.removeChild(overlay);
    });

    // Handle enable extended undo
    modal.querySelector('#enableExtendedUndo').addEventListener('click', () => {
        const selectedPeriod = modal.querySelector('input[name="undoPeriod"]:checked').value;
        let undoMinutes;

        if (selectedPeriod === 'custom') {
            undoMinutes = parseInt(customInput.value) || 5;
        } else {
            undoMinutes = parseInt(selectedPeriod);
        }

        enableExtendedUndo(emailData, undoMinutes);
        document.body.removeChild(overlay);
    });

    // Close on overlay click
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            document.body.removeChild(overlay);
        }
    });
}

// Enable extended undo functionality
async function enableExtendedUndo(emailData, undoMinutes) {
    try {
        // Get user email
        const userEmail = await getUserEmail();
        
        const response = await fetch('http://localhost:8000/queue-email', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                ...emailData,
                delay_minutes: undoMinutes,
                user_email: userEmail
            })
        });

        const result = await response.json();
        
        if (result.success) {
            // Show success notification with countdown
            showExtendedUndoNotification(undoMinutes);
            
            // Close the compose window
            const composeWindow = document.querySelector('[role="dialog"]');
            if (composeWindow) {
                const closeButton = composeWindow.querySelector('[data-tooltip="Close"]') || 
                                  composeWindow.querySelector('[aria-label="Close"]');
                if (closeButton) closeButton.click();
            }
        } else {
            showNotification('Failed to enable extended undo. Please try again.', 'error');
        }
    } catch (error) {
        console.error('Error enabling extended undo:', error);
        showNotification('Connection error. Make sure the backend server is running.', 'error');
    }
}

// Show extended undo notification with countdown
function showExtendedUndoNotification(undoMinutes) {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        border-radius: 8px;
        background: #137333;
        color: white;
        z-index: 10001;
        font-family: 'Google Sans', Roboto, sans-serif;
        max-width: 350px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    `;
    
    const hours = Math.floor(undoMinutes / 60);
    const minutes = undoMinutes % 60;
    let timeString = '';
    
    if (hours > 0) {
        timeString = `${hours} hour${hours > 1 ? 's' : ''}`;
        if (minutes > 0) timeString += ` and ${minutes} minute${minutes > 1 ? 's' : ''}`;
    } else {
        timeString = `${minutes} minute${minutes > 1 ? 's' : ''}`;
    }
    
    notification.innerHTML = `
        <div style="font-weight: 500; margin-bottom: 5px;">✅ Extended Undo Enabled</div>
        <div style="font-size: 13px; opacity: 0.9;">
            Your email will send in ${timeString}.<br>
            Click the extension icon to edit or cancel.
        </div>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 7000);
}

// Get user's Gmail address
async function getUserEmail() {
    // Try to extract from Gmail interface
    const userElement = document.querySelector('[email]') || 
                       document.querySelector('[data-hovercard-id*="@"]');
    
    if (userElement) {
        return userElement.getAttribute('email') || userElement.getAttribute('data-hovercard-id');
    }
    
    // Fallback
    return 'user@gmail.com';
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
                    createExtendedUndoModal(emailData, target);
                } else {
                    showNotification('Could not extract email data. Please try again.', 'error');
                }
            }
        }
    }, true); // Use capture phase
}

// Initialize when Gmail loads
waitForGmail().then(() => {
    console.log('Gmail loaded, initializing Extended Undo Send...');
    interceptSendButtons();
    
    // Also watch for new compose windows (Gmail is a single-page app)
    const observer = new MutationObserver(() => {
        // Re-run interception for dynamically loaded content
        interceptSendButtons();
    });
    
    observer.observe(document.body, { childList: true, subtree: true });
});
