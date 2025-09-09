# Project Structure

## Current Organization

```
.
├── .kiro/
│   ├── specs/
│   │   └── briai-voice-bot/     # Project specifications and design docs
│   └── steering/                # AI assistant guidance documents
└── .vscode/                     # VS Code configuration
```

## Planned Structure (OpenAI Agents SDK Based)

```
.
├── src/
│   ├── main.py                  # Application entry point with RealtimeRunner
│   └── comedy_agent.py          # RealtimeAgent with comedy persona
├── frontend/
│   ├── index.html               # Simple web interface
│   ├── app.js                   # WebRTC client using OpenAI SDK patterns
│   └── style.css                # Basic styling
├── Dockerfile                   # Container definition
├── requirements.txt             # Python dependencies (managed by UV)
├── pyproject.toml               # UV project configuration
├── .env.example                 # Environment variables template
└── .kiro/                       # Kiro AI assistant configuration
```

## Key Conventions

### SDK-Based Service Structure
The application uses OpenAI Agents SDK patterns:
```
src/
├── main.py                 # RealtimeRunner setup and HTTP server
└── comedy_agent.py         # RealtimeAgent with comedy instructions
```

### Frontend Structure
Simple WebRTC client using OpenAI patterns:
```
frontend/
├── index.html              # Single page application
├── app.js                  # WebRTC client following OpenAI examples
└── style.css               # Minimal styling
```

### Naming Conventions
- **Python modules**: snake_case following PEP 8
- **RealtimeAgent**: PascalCase class names (e.g., `ComedyAgent`)
- **JavaScript files**: camelCase for functions, kebab-case for files
- **Environment variables**: UPPER_SNAKE_CASE
- **Docker containers**: kebab-case (e.g., `briai-local`)

### File Organization Principles
- **SDK-driven**: Use OpenAI Agents SDK patterns and classes
- **Minimal custom code**: Leverage built-in RealtimeAgent, RealtimeRunner, RealtimeSession
- **No custom WebRTC**: Use OpenAI's WebRTC integration
- **Local first**: Designed for local Docker development
- **Future scalability**: Structure allows easy migration to AWS ECS later

### Configuration Management
- **RealtimeRunner config**: Model settings, voice, modalities in Python
- **Environment variables**: Simple .env file for OpenAI API key
- **No complex infrastructure**: OpenAI SDK handles session management
- **Built-in features**: Voice Activity Detection, transcription, memory included