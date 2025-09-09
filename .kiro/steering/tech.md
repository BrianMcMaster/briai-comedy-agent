# Technology Stack

## Primary Language
**Python 3.12** - Optimal for OpenAI Agents SDK integration

## Package Management
**UV** - Fast Python package installer and resolver for dependency management

## Core Services
- **OpenAI Realtime API** - Speech-to-speech with `gpt-4o-realtime-preview` model
- **OpenAI Agents Python SDK** - Official SDK with RealtimeAgent, RealtimeRunner, RealtimeSession
- **Docker** - Local containerized deployment for proof of concept

## Frontend Technology
- **Vanilla JavaScript** with Web Audio API
- **WebRTC** for real-time audio communication
- **OpenAI Realtime WebRTC** - Built-in WebRTC classes from OpenAI SDK

## Key Libraries & Dependencies
- **openai-agents-python** - Official OpenAI Agents SDK with realtime support
- **asyncio** - Asynchronous session management
- **Built-in WebRTC** - No custom WebSocket implementation needed

## Architecture Patterns
- **SDK-driven** design using OpenAI's official patterns
- **RealtimeAgent** for comedy persona management
- **RealtimeSession** for conversation state
- **Built-in Voice Activity Detection** and audio transcription
- **Native WebRTC** integration for browser-to-API communication

## Common Commands
Local development and Docker commands:
- **Always use a virual envinronmet with UV**
- **Always run in the Docker container, NEVER in the terminal**

```bash
# Python dependency management with UV
uv venv                              # Create virtual environment
uv pip install openai-agents-python # Install OpenAI Agents SDK
uv run python -m pytest            # Run tests in UV environment

# Docker local development
docker build -t briai-local .       # Build local container
docker run -p 8080:8080 briai-local # Run locally on port 8080

# Environment setup
export OPENAI_API_KEY="your-api-key-here"    # Set OpenAI API key

# Test realtime connection
# Open browser to http://localhost:8080 for WebRTC connection
```

## Performance Considerations
- **Local Docker deployment** for proof of concept
- **Native WebRTC** through OpenAI SDK for optimal latency
- **Built-in conversation memory** via RealtimeSession
- **Server-side Voice Activity Detection** for natural conversations
- **PCM16 audio at 24kHz** for high-quality voice processing
- **Future AWS ECS migration path** when ready to scale