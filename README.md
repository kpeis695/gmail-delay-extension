# gmail-delay-extension
Browser extension for delaying and editing Gmail messages
# Gmail Delay & Edit Extension

A browser extension that allows you to delay sending Gmail messages and edit them before they're actually sent. Similar to Boomerang but with longer delay periods and custom functionality.

## Features

- ⏰ **Delay Email Sending**: Choose from preset delays (15 minutes to 1 day) or set custom delays
- ✏️ **Edit Queued Emails**: Modify subject, body, or delay time before sending
- ❌ **Cancel Queued Emails**: Stop emails from being sent
- 🔄 **Queue Management**: View all queued emails in the extension popup
- 🔔 **Notifications**: Get notified when emails are queued or sent

## Architecture

This extension uses a hybrid approach:
- **Browser Extension** (JavaScript): Integrates with Gmail to intercept sends
- **Python Backend** (FastAPI): Manages email queue and handles actual sending via Gmail API

## Installation & Setup

### 1. Clone/Download the Repository

```bash
git clone https://github.com/yourusername/gmail-delay-extension.git
cd gmail-delay-extension
```

### 2. Set Up Python Backend

```bash
cd backend
python -m venv venv

# Activate virtual environment
# Windows:
venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### 3. Install Browser Extension

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `extension` folder from this project
5. The extension should now appear in your extensions list

### 4. Set Up Gmail API (Optional - for actual sending)

*Note: The current version stores emails but doesn't actually send them via Gmail API yet. This will be added in a future update.*

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable Gmail API
4. Create credentials (OAuth 2.0)
5. Download credentials and place in `backend/` folder

## Usage

### Starting the System

1. **Start the Python backend**:
   ```bash
   cd backend
   python main.py
   ```
   The server will run on `http://localhost:8000`

2. **Open Gmail** in your browser where the extension is installed

### Using the Extension

1. **Compose an email** in Gmail as normal
2. **Click "Send"** - the extension will intercept this
3. **Choose delay time** from the popup modal
4. **Click "Queue Email"** to schedule it
5. **Manage queued emails** by clicking the extension icon

### Managing Queued Emails

- Click the extension icon to see all queued emails
- **Edit**: Modify subject, body, or delay time
- **Cancel**: Stop the email from being sent
- **Refresh**: Update the list of queued emails

## Project Structure

```
gmail-delay-extension/
├── extension/                 # Browser extension files
│   ├── manifest.json         # Extension configuration
│   ├── content.js           # Gmail integration script
│   ├── background.js        # Background processes
│   ├── popup.html           # Extension popup interface
│   ├── popup.js             # Popup functionality
│   └── styles.css           # Extension styles
├── backend/                  # Python backend
│   ├── main.py              # FastAPI server
│   ├── requirements.txt     # Python dependencies
│   └── emails.db            # SQLite database (created automatically)
└── README.md                # This file
```

## API Endpoints

The Python backend provides these REST API endpoints:

- `GET /` - Health check
- `POST /queue-email` - Queue a new email
- `GET /queued-emails/{user_email}` - Get user's queued emails
- `PUT /email/{email_id}` - Update a queued email
- `DELETE /email/{email_id}` - Cancel a queued email

## Development

### Browser Extension Development

The extension uses:
- **Manifest V3** for Chrome extensions
- **Content Scripts** to interact with Gmail's DOM
- **Background Scripts** for persistent functionality
- **Popup Interface** for email management

### Backend Development

The backend uses:
- **FastAPI** for the REST API
- **SQLite** for data storage
- **APScheduler** for email scheduling
- **Pydantic** for data validation

### Testing

1. **Test the backend**:
   ```bash
   cd backend
   python main.py
   # Visit http://localhost:8000 to see API docs
   ```

2. **Test the extension**:
   - Load the extension in Chrome
   - Open Gmail and try composing an email
   - Check the browser console for any errors

## Troubleshooting

### Common Issues

1. **Extension not working**:
   - Check that the backend server is running on localhost:8000
   - Look for errors in browser console (F12)
   - Ensure extension has proper permissions

2. **Server connection errors**:
   - Verify Python dependencies are installed
   - Check that port 8000 is available
   - Look at server logs for error messages

3. **Gmail integration issues**:
   - Gmail's interface changes frequently
   - Check if content.js selectors need updating
   - Try refreshing the Gmail page

### Debug Mode

To see detailed logs:
1. Open browser console (F12) when using Gmail
2. Check the background script logs in `chrome://extensions/`
3. Monitor server logs in the terminal

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## Future Enhancements

- [ ] Gmail API integration for actual email sending
- [ ] Recurring email scheduling
- [ ] Email templates
- [ ] Better user authentication
- [ ] Mobile app version
- [ ] Integration with other email providers

## License

This project is open source. Feel free to use, modify, and distribute.

## Support

If you encounter issues:
1. Check the troubleshooting section above
2. Look for existing issues in the GitHub repository
3. Create a new issue with detailed information about your problem

---

**Note**: This extension is for educational purposes. Use responsibly and ensure compliance with your organization's email policies.
