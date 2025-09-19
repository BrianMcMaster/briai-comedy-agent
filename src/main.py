#!/usr/bin/env python3
"""
BriAI Comedy Agent - Real-time AI Comedy Bot

A real-time AI comedy bot using OpenAI's Realtime API for live voice interactions.
Built with aiohttp, WebRTC, and OpenAI's gpt-4o-realtime-preview model for
seamless voice-to-voice conversations with comedic AI personality.

Features:
- Real-time voice chat with AI comedian
- WebRTC integration for low-latency audio
- Live comedy performance with perfect timing
- Admin panel for monitoring and debugging
- Token usage tracking and cost analysis

Author: BriAI Team
Version: 0.1.0
"""

import asyncio
import os
import sys
import json
import base64
import logging
from pathlib import Path
from aiohttp import web, WSMsgType
import aiohttp_cors
from dotenv import load_dotenv
from openai import AsyncOpenAI
import yaml

# Load environment variables from project root
project_root = Path(__file__).parent.parent
env_path = project_root / ".env"
load_dotenv(dotenv_path=env_path)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class BriAIRealtimeApp:
    """
    BriAI Comedy Agent - Real-time AI Comedy Bot Application.
    
    Main application class that handles:
    - OpenAI Realtime API integration for voice conversations
    - WebSocket connections for real-time communication
    - Web server with frontend and admin panel
    - Audio processing and WebRTC support
    - Session management and error handling
    
    Attributes:
        api_key (str): OpenAI API key from environment
        model (str): OpenAI model name loaded from agents.yaml
        voice (str): Voice model loaded from agents.yaml
        client (AsyncOpenAI): OpenAI API client instance
        port (int): Server port (default: 8080)
        instructions (str): Agent personality instructions loaded from agents.yaml
    """
    
    def __init__(self):
        self.api_key = os.getenv("OPENAI_API_KEY")
        if not self.api_key:
            raise ValueError("OPENAI_API_KEY environment variable is required")

        # Load agent configuration from YAML
        agent_config = self.load_agent_config()
        self.model = agent_config["model"]
        self.voice = agent_config["voice"]
        self.instructions = agent_config["instructions"]
        
        self.client = AsyncOpenAI(api_key=self.api_key)
        self.port = int(os.getenv("PORT", 8080))
        
        logger.info(f"BriAI initialized with agent: {agent_config['name']}")
    
    def load_agent_config(self):
        """
        Load agent configuration from YAML file based on OPENAI_INSTRUCTIONS environment variable.
        
        Returns:
            dict: Agent configuration with name, model, voice, and instructions
            
        Raises:
            ValueError: If agent not found or YAML file missing
        """
        from datetime import datetime, timezone, timedelta
        
        # Get agent name from environment
        default_agent = "comedy_performer"
        agent_name_env = os.getenv("OPENAI_INSTRUCTIONS")
        if not agent_name_env:
            logger.warning(
                "OPENAI_INSTRUCTIONS not set. Falling back to default agent '%s'",
                default_agent,
            )
            agent_name = default_agent
        else:
            agent_name = agent_name_env
        
        # Load YAML configuration
        config_path = Path(__file__).parent / "config" / "agents.yaml"
        if not config_path.exists():
            raise ValueError(f"Agent configuration file not found: {config_path}")
        
        try:
            with open(config_path, 'r') as file:
                config = yaml.safe_load(file)
        except yaml.YAMLError as e:
            raise ValueError(f"Invalid YAML configuration: {e}")
        
        # Get agent configuration
        agents = config.get("agents", {})
        if agent_name not in agents:
            available_agents = list(agents.keys())
            raise ValueError(f"Agent '{agent_name}' not found. Available agents: {available_agents}")
        
        agent_config = agents[agent_name]
        
        # Inject current datetime into instructions (using Mountain Time)
        mt_tz = timezone(timedelta(hours=-6))
        current_datetime = datetime.now(mt_tz).strftime("%Y-%m-%d %H:%M:%S")
        instructions = agent_config["instructions"].format(current_datetime=current_datetime)
        
        return {
            "name": agent_config["name"],
            "model": agent_config["model"],
            "voice": agent_config["voice"],
            "instructions": instructions
        }
    
    async def create_web_app(self):
        """
        Create and configure the aiohttp web application.
        
        Sets up:
        - CORS configuration for cross-origin requests
        - Static file serving for frontend assets
        - API endpoints for session management
        - WebSocket endpoint for real-time communication
        - Admin panel routing
        
        Returns:
            web.Application: Configured aiohttp application instance
        """
        app = web.Application()
        
        # Setup CORS
        cors = aiohttp_cors.setup(app, defaults={
            "*": aiohttp_cors.ResourceOptions(
                allow_credentials=True,
                expose_headers="*",
                allow_headers="*",
                allow_methods="*"
            )
        })
        
        # Static file serving
        frontend_path = Path(__file__).parent.parent / "frontend"
        if frontend_path.exists():
            app.router.add_static('/static', frontend_path, name='static')
            cors.add(app.router.add_get('/', self.serve_index))
            cors.add(app.router.add_get('/admin', self.serve_admin))
        
        # API endpoints
        cors.add(app.router.add_get('/api/session/status', self.session_status))
        cors.add(app.router.add_post('/api/session', self.create_session))
        
        # Working WebSocket endpoint
        cors.add(app.router.add_get('/ws/realtime', self.websocket_handler))
        
        return app
    
    async def serve_index(self, request):
        """
        Serve the main application interface.
        
        Args:
            request: aiohttp request object
            
        Returns:
            web.FileResponse: Main application HTML file or 404 error
        """
        frontend_path = Path(__file__).parent.parent / "frontend" / "index.html"
        if frontend_path.exists():
            return web.FileResponse(frontend_path)
        else:
            return web.Response(text="Frontend not found", status=404)
    
    async def serve_admin(self, request):
        """
        Serve the admin panel interface for monitoring and debugging.
        
        Args:
            request: aiohttp request object
            
        Returns:
            web.FileResponse: Admin panel HTML file or 404 error
        """
        admin_path = Path(__file__).parent.parent / "frontend" / "admin.html"
        if admin_path.exists():
            return web.FileResponse(admin_path)
        else:
            return web.Response(text="Admin panel not found", status=404)
    
    async def session_status(self, request):
        """
        API endpoint for checking server and session status.
        
        Args:
            request: aiohttp request object
            
        Returns:
            web.Response: JSON response with server status, model, and voice info
        """
        return web.json_response({
            "status": "success",
            "model": self.model,
            "voice": self.voice
        })
    
    async def create_session(self, request):
        """
        API endpoint for creating new conversation sessions.
        
        Args:
            request: aiohttp request object
            
        Returns:
            web.Response: JSON response with session ID and configuration
        """
        return web.json_response({
            "session_id": "working-session",
            "status": "created",
            "model": self.model,
            "voice": self.voice
        })
    
    async def websocket_handler(self, request):
        """
        WebSocket handler for real-time audio communication.
        
        Manages bidirectional communication between frontend and OpenAI Realtime API:
        - Establishes WebSocket connection with client
        - Creates OpenAI Realtime API connection
        - Configures audio session with comedy personality
        - Handles audio data streaming and processing
        - Manages connection lifecycle and error handling
        
        Args:
            request: aiohttp WebSocket request
            
        Returns:
            web.WebSocketResponse: WebSocket response object
        """
        ws = web.WebSocketResponse()
        await ws.prepare(request)
        
        logger.info("WebSocket connection established")
        
        try:
            # Create OpenAI realtime connection
            async with self.client.beta.realtime.connect(model=self.model) as connection:
                logger.info("OpenAI realtime connection established")
                
                # Configure session for audio with optimized settings
                await connection.session.update(session={
                    'modalities': ['text', 'audio'],
                    'voice': self.voice,
                    'instructions': self.instructions,
                    'input_audio_format': 'pcm16',  # Explicitly specify PCM16 format
                    'output_audio_format': 'pcm16',  # Ensure consistent output format
                    'input_audio_transcription': {
                        'model': 'whisper-1'
                    },
                    'turn_detection': {
                        'type': 'server_vad',
                        'threshold': 0.5,  # Slightly lower threshold for better responsiveness
                        'prefix_padding_ms': 200,  # Reduced padding to minimize delay
                        'silence_duration_ms': 800  # Shorter silence duration for more natural conversation
                    }
                })
                
                logger.info("Session configured for audio")
                
                # Send session created event to frontend
                await ws.send_str(json.dumps({
                    "type": "session.created",
                    "session": {"id": "working-session"}
                }))
                
                await ws.send_str(json.dumps({
                    "type": "session.updated"
                }))
                
                # Create tasks for bidirectional communication
                frontend_task = asyncio.create_task(
                    self._handle_frontend_messages(ws, connection)
                )
                openai_task = asyncio.create_task(
                    self._handle_openai_events(connection, ws)
                )
                
                # Wait for either task to complete
                done, pending = await asyncio.wait(
                    [frontend_task, openai_task],
                    return_when=asyncio.FIRST_COMPLETED
                )
                
                # Cancel remaining tasks
                for task in pending:
                    task.cancel()
                    try:
                        await task
                    except asyncio.CancelledError:
                        pass
                
                logger.info("WebSocket connection closed")
        
        except Exception as e:
            logger.error(f"WebSocket error: {e}")
            if not ws.closed:
                await ws.send_str(json.dumps({
                    "type": "error",
                    "error": {"message": str(e)}
                }))
        
        return ws
    
    async def _handle_frontend_messages(self, ws, connection):
        """
        Handle incoming messages from the frontend WebSocket client.
        
        Processes various message types:
        - Audio data (base64 encoded PCM)
        - Control messages (ping/pong)
        - Session commands (commit, create response)
        - Forwards messages to OpenAI Realtime API
        
        Args:
            ws: WebSocket connection to frontend
            connection: OpenAI Realtime API connection
        """
        try:
            async for msg in ws:
                if msg.type == WSMsgType.TEXT:
                    try:
                        data = json.loads(msg.data)
                        event_type = data.get('type', 'unknown')
                        
                        logger.debug(f"Frontend -> OpenAI: {event_type}")
                        
                        # Handle ping/pong
                        if event_type == 'ping':
                            await ws.send_str(json.dumps({
                                "type": "pong",
                                "timestamp": data.get('timestamp', 0)
                            }))
                            continue
                        
                        # Handle audio data
                        if event_type == 'input_audio_buffer.append':
                            audio_data = data.get('audio', '')
                            if audio_data:
                                logger.debug(f"📨 Received audio data: {len(audio_data)} bytes")
                                
                                # Validate base64 audio data
                                try:
                                    audio_bytes = base64.b64decode(audio_data)
                                    
                                    # Validate audio format (should be PCM16, even number of bytes)
                                    if len(audio_bytes) % 2 != 0:
                                        logger.warning(f"⚠️ Invalid audio data length: {len(audio_bytes)} bytes (not PCM16)")
                                        continue
                                    
                                    # Check for reasonable audio chunk size (avoid tiny or huge chunks)
                                    if len(audio_bytes) < 64 or len(audio_bytes) > 8192:
                                        logger.debug(f"⚠️ Unusual audio chunk size: {len(audio_bytes)} bytes")
                                    
                                    logger.debug(f"📤 Decoded audio: {len(audio_bytes)} raw bytes")
                                    
                                    # Send to OpenAI as base64 (the SDK handles the conversion)
                                    await connection.send({
                                        'type': 'input_audio_buffer.append',
                                        'audio': audio_data  # Keep as base64
                                    })
                                    
                                    logger.debug("✅ Forwarded audio to OpenAI successfully")
                                    
                                except base64.binascii.Error as b64_error:
                                    logger.error(f"❌ Base64 decode error: {b64_error}")
                                except Exception as audio_error:
                                    logger.error(f"❌ Audio processing error: {audio_error}")
                            else:
                                logger.warning("⚠️ Received input_audio_buffer.append with no audio data")
                            continue
                        
                        # Handle other events
                        if event_type == 'input_audio_buffer.commit':
                            logger.info("Committing audio buffer")
                        elif event_type == 'response.create':
                            logger.info("Creating response")
                        
                        # Forward to OpenAI
                        await connection.send(data)
                        
                    except json.JSONDecodeError as e:
                        logger.error(f"Invalid JSON from frontend: {e}")
                    except Exception as e:
                        logger.error(f"Error handling frontend message: {e}")
                
                elif msg.type == WSMsgType.ERROR:
                    logger.error(f"WebSocket error: {ws.exception()}")
                    break
                elif msg.type == WSMsgType.CLOSE:
                    logger.info("Frontend closed connection")
                    break
        
        except Exception as e:
            logger.error(f"Error in frontend message handler: {e}")
    
    async def _handle_openai_events(self, connection, ws):
        """
        Handle events from OpenAI Realtime API and forward to frontend.
        
        Processes OpenAI events:
        - Audio responses and transcriptions
        - Speech detection (start/stop)
        - Conversation items and completions
        - Error handling and logging
        - Forwards all events to frontend WebSocket
        
        Args:
            connection: OpenAI Realtime API connection
            ws: WebSocket connection to frontend
        """
        try:
            async for event in connection:
                if ws.closed:
                    logger.info("WebSocket closed, stopping OpenAI handler")
                    break
                
                try:
                    # Convert event to dict
                    event_data = {
                        "type": event.type,
                        **event.model_dump(exclude={"type"})
                    }
                    
                    logger.debug(f"OpenAI -> Frontend: {event.type}")
                    
                    # Send to frontend
                    await ws.send_str(json.dumps(event_data))
                    
                    # Log important events
                    if event.type == "input_audio_buffer.speech_started":
                        logger.info("🎤 Speech detection started")
                    elif event.type == "input_audio_buffer.speech_stopped":
                        logger.info("🎤 Speech detection stopped")
                    elif event.type == "conversation.item.input_audio_transcription.completed":
                        logger.info(f"🎤 User said: {event.transcript}")
                    elif event.type == "response.audio_transcript.done":
                        logger.info(f"🎭 BriAI said: {event.transcript}")
                    elif event.type == "response.audio.delta":
                        logger.debug("🔊 Streaming audio to frontend")
                    elif event.type == "error":
                        logger.error(f"❌ OpenAI error: {event.error}")
                
                except Exception as e:
                    logger.error(f"Error handling OpenAI event: {e}")
        
        except Exception as e:
            logger.error(f"Error in OpenAI event handler: {e}")
    
    async def run_server(self):
        """
        Start and run the BriAI Comedy Agent server.
        
        Initializes the web application, starts the HTTP server,
        and runs the main event loop until interrupted.
        Handles graceful shutdown and cleanup.
        
        Raises:
            Exception: If server startup fails
        """
        app = await self.create_web_app()
        
        runner = web.AppRunner(app)
        await runner.setup()
        
        host = os.getenv("HOST", "localhost")
        site = web.TCPSite(runner, host, self.port)
        await site.start()
        
        print(f"🎭 BriAI Comedy Agent server started on http://{host}:{self.port}")
        print("Real-time voice conversations with AI comedy!")
        print("Open your browser and start chatting with BriAI")
        
        try:
            while True:
                await asyncio.sleep(1)
        except KeyboardInterrupt:
            print("Shutting down...")
        finally:
            await runner.cleanup()


async def main():
    """
    Main application entry point.
    
    Creates and runs the BriAI Comedy Agent application.
    Handles top-level exceptions and returns appropriate exit codes.
    
    Returns:
        int: Exit code (0 for success, 1 for error)
    """
    try:
        app = BriAIRealtimeApp()
        await app.run_server()
    except Exception as e:
        print(f"Error: {e}")
        return 1
    return 0


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)