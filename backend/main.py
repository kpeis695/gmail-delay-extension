from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import json
import sqlite3
import uuid
from datetime import datetime, timedelta
from apscheduler.schedulers.background import BackgroundScheduler
import atexit

app = FastAPI(title="Gmail Delay Extension API")

# Enable CORS for browser extension
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your extension ID
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize scheduler
scheduler = BackgroundScheduler()
scheduler.start()
atexit.register(lambda: scheduler.shutdown())

# Database setup
def init_db():
    conn = sqlite3.connect('emails.db')
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS queued_emails (
            id TEXT PRIMARY KEY,
            to_emails TEXT,
            subject TEXT,
            body TEXT,
            send_time TEXT,
            status TEXT,
            created_at TEXT,
            user_email TEXT
        )
    ''')
    conn.commit()
    conn.close()

init_db()

# Pydantic models
class EmailData(BaseModel):
    to: List[str]
    subject: str
    body: str
    delay_minutes: int
    user_email: str

class EmailUpdate(BaseModel):
    subject: Optional[str] = None
    body: Optional[str] = None
    delay_minutes: Optional[int] = None

@app.get("/")
async def root():
    return {"message": "Gmail Delay Extension API is running!"}

@app.post("/queue-email")
async def queue_email(email_data: EmailData):
    try:
        # Generate unique ID
        email_id = str(uuid.uuid4())
        
        # Calculate send time
        send_time = datetime.now() + timedelta(minutes=email_data.delay_minutes)
        
        # Store in database
        conn = sqlite3.connect('emails.db')
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO queued_emails 
            (id, to_emails, subject, body, send_time, status, created_at, user_email)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            email_id,
            json.dumps(email_data.to),
            email_data.subject,
            email_data.body,
            send_time.isoformat(),
            'queued',
            datetime.now().isoformat(),
            email_data.user_email
        ))
        conn.commit()
        conn.close()
        
        # Schedule the email
        scheduler.add_job(
            send_email,
            'date',
            run_date=send_time,
            args=[email_id],
            id=email_id
        )
        
        return {
            "success": True,
            "email_id": email_id,
            "send_time": send_time.isoformat(),
            "message": f"Email queued to send in {email_data.delay_minutes} minutes"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/queued-emails/{user_email}")
async def get_queued_emails(user_email: str):
    try:
        conn = sqlite3.connect('emails.db')
        cursor = conn.cursor()
        cursor.execute('''
            SELECT id, to_emails, subject, body, send_time, status, created_at
            FROM queued_emails 
            WHERE user_email = ? AND status = 'queued'
            ORDER BY send_time ASC
        ''', (user_email,))
        
        emails = []
        for row in cursor.fetchall():
            emails.append({
                "id": row[0],
                "to": json.loads(row[1]),
                "subject": row[2],
                "body": row[3],
                "send_time": row[4],
                "status": row[5],
                "created_at": row[6]
            })
        
        conn.close()
        return {"emails": emails}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/email/{email_id}")
async def update_email(email_id: str, updates: EmailUpdate):
    try:
        conn = sqlite3.connect('emails.db')
        cursor = conn.cursor()
        
        # Check if email exists and is still queued
        cursor.execute('SELECT * FROM queued_emails WHERE id = ? AND status = "queued"', (email_id,))
        email = cursor.fetchone()
        
        if not email:
            raise HTTPException(status_code=404, detail="Email not found or already sent")
        
        # Update fields
        update_fields = []
        values = []
        
        if updates.subject is not None:
            update_fields.append("subject = ?")
            values.append(updates.subject)
            
        if updates.body is not None:
            update_fields.append("body = ?")
            values.append(updates.body)
            
        if updates.delay_minutes is not None:
            new_send_time = datetime.now() + timedelta(minutes=updates.delay_minutes)
            update_fields.append("send_time = ?")
            values.append(new_send_time.isoformat())
            
            # Reschedule the job
            try:
                scheduler.remove_job(email_id)
            except:
                pass  # Job might not exist
                
            scheduler.add_job(
                send_email,
                'date',
                run_date=new_send_time,
                args=[email_id],
                id=email_id
            )
        
        if update_fields:
            values.append(email_id)
            cursor.execute(f'UPDATE queued_emails SET {", ".join(update_fields)} WHERE id = ?', values)
            conn.commit()
        
        conn.close()
        return {"success": True, "message": "Email updated successfully"}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/email/{email_id}")
async def cancel_email(email_id: str):
    try:
        # Remove from scheduler
        try:
            scheduler.remove_job(email_id)
        except:
            pass  # Job might not exist
        
        # Update database
        conn = sqlite3.connect('emails.db')
        cursor = conn.cursor()
        cursor.execute('UPDATE queued_emails SET status = "cancelled" WHERE id = ?', (email_id,))
        conn.commit()
        conn.close()
        
        return {"success": True, "message": "Email cancelled successfully"}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

def send_email(email_id: str):
    # This function will be implemented later with Gmail API
    # For now, just update the database
    try:
        conn = sqlite3.connect('emails.db')
        cursor = conn.cursor()
        cursor.execute('UPDATE queued_emails SET status = "sent" WHERE id = ?', (email_id,))
        conn.commit()
        conn.close()
        print(f"Email {email_id} would be sent now (Gmail API not implemented yet)")
    except Exception as e:
        print(f"Error sending email {email_id}: {e}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
