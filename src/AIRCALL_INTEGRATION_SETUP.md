# Aircall Integration Setup Guide

## Overview
This integration automatically syncs Aircall calls with your CRM, creating leads from callers and logging all call activities.

## Features
- ✅ **Auto-create leads** from incoming/outgoing calls
- ✅ **Log call activities** with duration, status, and recordings
- ✅ **Track missed calls** for follow-up
- ✅ **Link calls to existing leads** by phone number
- ✅ **Store recording URLs** for playback

## Setup Instructions

### Step 1: Configure Aircall Webhook

1. **Login to Aircall Dashboard**
   - Go to https://dashboard.aircall.io
   - Navigate to **Settings** → **Integrations** → **Webhooks**

2. **Create New Webhook**
   - Click "Add Webhook" or "Create Webhook"
   - **Webhook URL**: `https://your-app-id.base44.app/functions/aircallWebhook`
     - Replace `your-app-id` with your actual Base44 app ID
   - **Events to subscribe to**:
     - ✅ `call.ended` - Triggered when a call ends (recommended)
     - ✅ `call.completed` - Alternative event for completed calls
   
3. **Authentication (Optional but Recommended)**
   - Aircall will send a signature header `X-Aircall-Signature`
   - You can verify this in the webhook handler if needed

4. **Save the Webhook**
   - Click "Save" or "Create"
   - Aircall will send a test webhook to verify the URL

### Step 2: Test the Integration

1. **Make a Test Call**
   - Use your Aircall phone system to make/receive a call
   - Wait 30-60 seconds after the call ends

2. **Verify in CRM**
   - Check the **Leads** page for new leads created from calls
   - Check the **Activity** timeline for call logs
   - Verify call details: duration, status, recording URL

### Step 3: Configure Aircall Lines (Optional)

If you have multiple Aircall lines/numbers:

1. **Line Assignment**
   - In Aircall Dashboard, go to **Settings** → **Numbers**
   - Assign specific numbers to agents or teams
   - Calls from these numbers will be tracked with the assigned agent

2. **Tags & Routing**
   - Configure tags in Aircall for call categorization
   - Tags will be synced to the CRM for better organization

## Data Flow

```
Aircall Call → Webhook → Base44 Function → CRM
    ↓
1. Check if caller exists in Leads
2. Create new Lead if not found
3. Log Activity record
4. Create AircallCall record with details
5. Link to agent who handled the call
```

## Stored Data

### Lead Entity (if created)
- `full_name`: From Aircall contact
- `phone`: Normalized to E.164 format
- `source`: "aircall_call"
- `assigned_agent_email`: Agent who handled the call
- `notes`: "Lead created from Aircall call"

### Activity Entity
- `type`: "call"
- `direction`: "inbound" or "outbound"
- `status`: "done", "missed", "voicemail", etc.
- `duration`: Call duration in seconds
- `completed_at`: Call end timestamp
- `agent_email`: Agent who made/received the call

### AircallCall Entity
- `aircall_id`: Unique Aircall call ID
- `direction`: "inbound" or "outbound"
- `duration`: Call duration in seconds
- `recording_url`: Link to call recording
- `voicemail_url`: Link to voicemail (if applicable)
- `tags`: Array of tags from Aircall
- `lead_id`: Linked Lead ID

## Troubleshooting

### Webhook Not Working
1. **Check URL**: Ensure the webhook URL is correct in Aircall dashboard
2. **Verify Secrets**: Confirm `AIRCALL_API_ID` and `AIRCALL_API_TOKEN` are set
3. **Test Connection**: Use Aircall's "Send Test Webhook" feature
4. **Check Logs**: Review function logs in Base44 dashboard

### Calls Not Creating Leads
1. **Phone Format**: Ensure caller's phone number is in valid format
2. **Duplicate Check**: Lead might already exist with that phone number
3. **Contact Data**: Aircall contact must have phone number populated

### Missing Call Recordings
- Recordings may take 5-10 minutes to be available in Aircall
- Check `recording_url` field in AircallCall entity
- Ensure recording feature is enabled in Aircall settings

## API Reference

### Webhook Payload (Aircall → Base44)
```json
{
  "id": "123456789",
  "direction": "inbound",
  "status": "done",
  "started_at": "2024-01-15T10:30:00Z",
  "ended_at": "2024-01-15T10:35:00Z",
  "duration": 300,
  "from": "+971501234567",
  "to": "+97143334444",
  "user": {
    "name": "Agent Name",
    "email": "agent@company.com"
  },
  "contact": {
    "first_name": "John",
    "last_name": "Doe",
    "email": "john@example.com"
  },
  "tags": ["sales", "inquiry"],
  "recording_url": "https://aircall.io/recordings/..."
}
```

### Function Endpoint
- **URL**: `https://your-app-id.base44.app/functions/aircallWebhook`
- **Method**: POST
- **Headers**: `Content-Type: application/json`
- **Response**: `{ "success": true, "lead_id": "...", "aircall_id": "..." }`

## Support

For issues or questions:
1. Check Base44 function logs in the dashboard
2. Review Aircall webhook delivery logs
3. Contact Base44 support for platform issues
4. Contact Aircall support for webhook delivery issues