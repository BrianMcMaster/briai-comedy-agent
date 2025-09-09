# Design Document

## Overview

BriAI is a simple, containerized comedy bot that leverages OpenAI's Agents Python SDK with RealtimeAgent, RealtimeRunner, and built-in WebRTC capabilities. The system uses the official OpenAI SDK patterns for speech-to-speech interactions and runs locally in Docker for development and proof of concept.

## Architecture

### High-Level Architecture

```
Browser (WebRTC) ←→ Python App (OpenAI Agents SDK) ←→ OpenAI Realtime API
```

The architecture leverages OpenAI's official SDK:
- **Frontend**: Vanilla JavaScript with WebRTC following OpenAI patterns
- **Backend**: Python app using RealtimeAgent, RealtimeRunner, RealtimeSession
- **AI Service**: gpt-4o-realtime-preview with built-in memory and VAD
- **Deployment**: Single Docker container for local development

### Component Interaction Flow

1. User opens web interface in browser
2. JavaScript establishes WebRTC connection using OpenAI SDK patterns
3. Python app creates RealtimeAgent with comedy instructions
4. RealtimeRunner manages the session with built-in WebRTC handling
5. RealtimeSession processes audio with server-side Voice Activity Detection
6. OpenAI API returns speech responses with conversation memory
7. Built-in audio handling streams response back to browser

## Components and Interfaces

### Frontend Components

#### Web Interface (`frontend/index.html`)
- Simple single-page application
- Start/stop conversation controls
- Connection status indicators
- Real-time transcription display (for debugging)

#### WebRTC Client (`frontend/app.js`)
- Uses OpenAI WebRTC patterns and examples
- Handles microphone access and audio capture
- Connects to RealtimeSession via built-in WebRTC
- Displays transcription and connection status

### Backend Components

#### Main Application (`src/main.py`)
- Creates RealtimeAgent with comedy persona
- Configures RealtimeRunner with model settings
- Manages RealtimeSession lifecycle
- Serves static frontend files

#### Comedy Agent (`src/comedy_agent.py`)
- Extends RealtimeAgent with comedy-specific instructions
- Configures voice, modalities, and turn detection
- Sets up Voice Activity Detection parameters
- Defines comedy persona and conversation style

## Data Models

### RealtimeAgent Configuration
```python
agent = RealtimeAgent(
    name="ComedyBot",
    instructions="You are a witty comedy bot for live shows...",
    voice="alloy"  # or other OpenAI voices
)
```

### RealtimeRunner Configuration
```python
config = {
    "model_settings": {
        "model_name": "gpt-4o-realtime-preview",
        "voice": "alloy",
        "modalities": ["text", "audio"],
        "input_audio_transcription": {"model": "whisper-1"},
        "turn_detection": {
            "type": "server_vad",
            "threshold": 0.5,
            "prefix_padding_ms": 300,
            "silence_duration_ms": 200
        }
    }
}
```

## Error Handling

### SDK-Based Error Handling
- **RealtimeSession Errors**: Built-in reconnection and error recovery
- **WebRTC Connection Failures**: Handled by OpenAI's WebRTC classes
- **Audio Processing Errors**: Built-in audio format handling

### Error Response Strategy
1. Leverage OpenAI SDK's built-in error handling
2. Log errors using SDK's event system
3. Use RealtimeSession's automatic retry mechanisms
4. Provide user feedback through transcription events

## Testing Strategy

### Unit Tests
- Test RealtimeAgent comedy instructions
- Test RealtimeRunner configuration
- Test session event handling
- Test frontend WebRTC integration

### Integration Tests
- Test end-to-end conversation flow using RealtimeSession
- Test Voice Activity Detection behavior
- Test built-in transcription accuracy
- Test session memory and context retention

### Manual Testing
- Test in different browsers with WebRTC support
- Test voice quality with different microphones
- Test comedy persona consistency
- Test conversation flow with VAD

### Performance Testing
- Measure latency with built-in audio processing
- Test session stability over extended conversations
- Monitor memory usage with RealtimeSession
- Test Docker container resource usage

## Security Considerations

### API Key Management
- OpenAI API key as environment variable
- No API key exposure in frontend
- Secure handling in RealtimeRunner

### Audio Privacy
- No audio storage (handled by OpenAI SDK)
- WebRTC encryption via OpenAI's implementation
- Clear microphone permission requests

### Network Security
- HTTPS required for WebRTC
- Built-in rate limiting via OpenAI API
- Input validation through SDK

## Deployment

### Local Development
- Single Docker container with OpenAI Agents SDK
- Environment variables for API key configuration
- Simple startup with RealtimeRunner
- Built-in session management

### Future AWS ECS Migration
- Container designed for ECS deployment
- RealtimeSession scales horizontally
- Built-in health monitoring via SDK events
- Environment variable compatibility with ECS