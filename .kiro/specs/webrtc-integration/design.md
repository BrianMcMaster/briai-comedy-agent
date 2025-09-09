# Design Document

## Overview

The current BriAI implementation has a broken WebRTC integration. The frontend creates sessions but doesn't establish actual audio communication with the OpenAI Realtime API. This fix will implement the minimal changes needed to enable proper WebRTC connectivity using OpenAI's official patterns.

## Root Cause Analysis

The current implementation has these issues:
1. **Frontend**: Only captures microphone for volume monitoring, doesn't send audio to backend
2. **Backend**: Creates RealtimeSession but doesn't expose WebRTC endpoints for frontend connection
3. **Missing Integration**: No actual WebRTC data channel or audio streaming between frontend and backend

## Architecture

### Current Broken Flow
```
Browser → HTTP Session Creation → Backend RealtimeSession (isolated)
```

### Fixed Flow
```
Browser → WebRTC Connection → Backend Relay → OpenAI Realtime API
```

## Components and Interfaces

### Frontend Changes (Minimal)

#### WebRTC Client Integration (`frontend/app.js`)
- Replace volume-only microphone capture with actual WebRTC connection
- Use OpenAI's RealtimeClient pattern for browser integration
- Connect to backend relay server instead of direct API calls
- Handle real audio streaming and playback

### Backend Changes (Minimal)

#### WebRTC Relay Server (`src/main.py`)
- Add WebRTC relay endpoint that bridges frontend to OpenAI Realtime API
- Remove isolated RealtimeSession creation
- Implement proper session management with WebRTC integration
- Forward WebRTC data channel events to OpenAI API

## Implementation Strategy

### Option 1: Use OpenAI RealtimeClient in Frontend (Recommended)
Based on OpenAI documentation, use their official RealtimeClient with a relay server:

```javascript
// Frontend: Use OpenAI's RealtimeClient
import { RealtimeClient } from '@openai/realtime-api-beta';
const client = new RealtimeClient({ url: RELAY_SERVER_URL });
```

```python
# Backend: Simple relay server
# Forward WebRTC events to OpenAI Realtime API
```

### Option 2: Custom WebRTC Implementation
Build custom WebRTC handling (more complex, not recommended).

## Data Models

### WebRTC Connection Flow
1. Frontend requests session from backend
2. Backend creates relay session and returns connection details
3. Frontend establishes WebRTC connection to relay
4. Backend forwards all events to OpenAI Realtime API
5. Audio streams bidirectionally through WebRTC

### Session Management
```python
# Backend session structure
{
    "session_id": "session_123",
    "webrtc_url": "/webrtc/session_123",
    "status": "active"
}
```

## Error Handling

### Connection Failures
- Frontend: Retry WebRTC connection with exponential backoff
- Backend: Handle OpenAI API disconnections gracefully
- User feedback: Clear error messages for connection issues

### Audio Issues
- Use OpenAI's built-in audio format handling (pcm16, 24kHz)
- Leverage OpenAI's automatic audio processing
- Fallback to text-based interaction if audio fails

## Testing Strategy

### Integration Tests
- Test complete audio flow: speak → process → respond
- Verify WebRTC connection establishment
- Test session cleanup and reconnection

### Manual Testing
- Test in Chrome/Firefox with microphone
- Verify bidirectional audio communication
- Test conversation flow until stop button pressed

## Implementation Plan

### Phase 1: Backend Relay (Minimal)
1. Add WebRTC relay endpoint to existing main.py
2. Modify session creation to return WebRTC connection details
3. Forward WebRTC events to OpenAI Realtime API

### Phase 2: Frontend Integration (Minimal)
1. Replace current session logic with OpenAI RealtimeClient
2. Connect to backend relay instead of direct HTTP calls
3. Handle audio playback from WebRTC stream

### Phase 3: Testing and Cleanup
1. Test complete conversation flow
2. Remove unused volume monitoring code
3. Verify proper resource cleanup