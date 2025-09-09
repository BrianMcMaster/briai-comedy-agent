# 🎭 BriAI Comedy Agent

![BriAI](docs/BriAI.jpg)

A real-time AI comedy bot using OpenAI's Realtime API for live voice interactions. Built with Python 3.12, aiohttp, and WebRTC for seamless real-time conversations.

## ✨ Features

- **Real-time Voice Chat**: Direct voice-to-voice conversations with AI comedian
- **Live Comedy Performance**: Witty, spontaneous responses with perfect timing
- **WebRTC Integration**: Low-latency audio streaming via OpenAI's Realtime API
- **Admin Panel**: Comprehensive debugging and monitoring tools
- **Docker-First**: Containerized deployment for consistent environments
- **Token Tracking**: Real-time monitoring of API usage and costs

## 🚀 Quick Start

### Prerequisites
- Docker and Docker Compose
- OpenAI API key with access to `gpt-4o-realtime-preview`

### 1. Clone and Setup
```bash
git clone <repository-url>
cd briai-comedy-agent
```

### 2. Configure Environment
```bash
cp .env.example .env
# Edit .env and add your OpenAI API key:
# OPENAI_API_KEY=your-openai-api-token-here  # pragma: allowlist secret
```

### 3. Build and Run
```bash
make build
make run
```

### 4. Access the Application
- **Main App**: http://localhost:8080
- **Admin Panel**: http://localhost:8080/admin

## 🐳 Docker Commands

All operations use Docker for consistency and reliability:

```bash
make help          # Show all available commands
make build         # Build the Docker image
make run           # Start the application
make stop          # Stop the application
make logs          # View application logs
make clean         # Remove containers and images
make dev           # Development: rebuild and restart
make shell         # Open shell in running container
```

## 🔧 Admin Panel

The admin panel at `http://localhost:8080/admin` provides comprehensive monitoring and debugging:

### System Status
- **Health Monitoring**: Real-time server, API, WebSocket, and audio system status
- **Token Usage**: Live tracking of OpenAI API consumption and costs
- **Performance Metrics**: Connection latency, response times, and system load
- **Full Diagnostics**: One-click comprehensive system testing

### Audio Testing
- **Microphone Testing**: Verify audio input and permissions
- **Audio Visualization**: Real-time frequency analysis and waveform display
- **Voice Activity Detection**: Test VAD sensitivity and performance
- **Audio Processing**: Validate Web Audio API functionality

### Connection Testing
- **WebSocket Testing**: Real-time connection monitoring and diagnostics
- **API Endpoint Testing**: Verify all backend services
- **Connection Simulation**: Test reconnection logic and error handling
- **Latency Monitoring**: Track connection performance metrics

### Debug Tools
- **Live Logging**: Real-time system logs with filtering and export
- **Token Analytics**: Detailed usage patterns and cost analysis
- **Configuration Validation**: Verify all settings and dependencies
- **Diagnostic Reports**: Exportable system health reports

## 🧪 Testing

### Run Tests
```bash
make test          # Essential functionality tests
make test-deploy   # Deployment validation (requires running server)
make test-docker   # Docker build and container tests
```

### Test Coverage
- **Unit Tests**: Core functionality and API integration
- **Integration Tests**: WebSocket connections and audio processing
- **Deployment Tests**: End-to-end application validation
- **Docker Tests**: Container build and runtime verification

## 🛠️ Development

### Local Development Setup
For development without Docker:

```bash
# Using UV (recommended)
uv venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
uv pip install -e ".[dev]"

# Or using pip
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
```

### Development Workflow
```bash
make dev           # Quick rebuild and restart
make logs          # Monitor application logs
make shell         # Debug inside container
```

### Code Quality
The project uses modern Python tooling:
- **Ruff**: Fast linting and formatting
- **Black**: Code formatting
- **MyPy**: Type checking
- **Pytest**: Testing framework with async support

## 📋 Requirements

### System Requirements
- **Python**: 3.12+
- **Docker**: Latest stable version
- **Browser**: Chrome, Firefox, or Safari (WebRTC support required)

### API Requirements
- **OpenAI API Key**: With access to `gpt-4o-realtime-preview`
- **Network**: Stable internet connection for real-time audio

### Dependencies
Core dependencies (automatically installed):
- `openai>=1.60.0` - OpenAI API client with Realtime support
- `aiohttp>=3.12.0` - Async HTTP server framework
- `websockets>=14.0` - WebSocket implementation
- `python-dotenv>=1.0.1` - Environment variable management

## 📋 Pricing Estimates

*Per 1M audio tokens* - [OpenAI Pricing](https://platform.openai.com/docs/pricing#audio-tokens)

| Model | Input | Cached Input | Output |
|-------|-------|--------------|--------|
| **gpt-realtime** | $32.00 | $0.40 | $64.00 |
| **gpt-4o-realtime-preview** | $40.00 | $2.50 | $80.00 |
| **gpt-4o-mini-realtime-preview** | $10.00 | $0.30 | $20.00 |
| **gpt-audio** | $40.00 | - | $80.00 |
| **gpt-4o-audio-preview** | $40.00 | - | $80.00 |
| **gpt-4o-mini-audio-preview** | $10.00 | - | $20.00 |

> **Note**: BriAI uses `gpt-realtime` by default. For cost optimization, consider switching to `gpt-4o-mini-realtime-preview` in your `.env` file.

## 🔒 Security Notes

- **API Keys**: Never commit API keys to version control
- **Environment**: Use `.env` files for sensitive configuration
- **Network**: Admin panel should not be exposed in production
- **Docker**: Runs as non-root user for security

## 📚 Documentation

- **API Documentation**: See `DOCKER.md` for deployment details
- **Admin Panel Guide**: Comprehensive feature documentation in admin interface
- **Troubleshooting**: Check admin panel diagnostics for common issues

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes using Docker development environment
4. Run tests: `make test`
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

---

**Ready to make people laugh?** 🎤 Start BriAI and experience real-time AI comedy!