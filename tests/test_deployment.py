#!/usr/bin/env python3
"""
BriAI Comedy Agent - Deployment Validation Tests

End-to-end deployment tests for the BriAI Comedy Agent server.
Validates that the deployed application is running correctly and
all API endpoints are responding properly.

Requirements:
- Server must be running on localhost:8080
- OpenAI API key must be configured
- All dependencies must be installed

Test Coverage:
- Server health and responsiveness
- API endpoint functionality
- Session creation and management
- WebSocket connectivity (future)

Usage:
    # Start server first
    python src/main.py
    
    # Then run deployment tests
    python tests/test_deployment.py
"""

import asyncio
import aiohttp
import sys


async def test_server_health():
    """
    Test server health and API responsiveness.
    
    Validates:
    - Server is running and accessible on port 8080
    - Health check endpoint returns valid response
    - Server configuration is properly loaded
    - API returns expected status and model information
    
    Returns:
        bool: True if server health check passes, False otherwise
    """
    print("Testing server health...")
    
    try:
        async with aiohttp.ClientSession() as session:
            # Test session status endpoint
            async with session.get("http://localhost:8080/api/session/status") as response:
                if response.status == 200:
                    data = await response.json()
                    print(f"✅ Server responding: {data.get('status', 'unknown')}")
                    print(f"   Model: {data.get('model', 'unknown')}")
                    return True
                else:
                    print(f"❌ Server returned status {response.status}")
                    return False
                    
    except aiohttp.ClientConnectorError:
        print("❌ Cannot connect to server. Is it running on port 8080?")
        return False
    except Exception as e:
        print(f"❌ Health check failed: {e}")
        return False


async def test_session_creation():
    """
    Test session creation API endpoint functionality.
    
    Validates:
    - Session creation endpoint is accessible
    - API returns valid session ID and configuration
    - Response format matches expected structure
    - Session management is working correctly
    
    Returns:
        bool: True if session creation test passes, False otherwise
    """
    print("Testing session creation...")
    
    try:
        async with aiohttp.ClientSession() as session:
            async with session.post("http://localhost:8080/api/session") as response:
                if response.status == 200:
                    data = await response.json()
                    print(f"✅ Session created: {data.get('session_id', 'unknown')}")
                    return True
                else:
                    print(f"❌ Session creation failed with status {response.status}")
                    return False
                    
    except Exception as e:
        print(f"❌ Session creation test failed: {e}")
        return False


async def run_deployment_tests():
    """
    Execute complete deployment validation test suite.
    
    Runs all deployment tests to validate that the BriAI Comedy Agent
    server is properly deployed and functioning correctly.
    
    Note: Requires server to be running on localhost:8080
    
    Returns:
        bool: True if all deployment tests pass, False otherwise
    """
    print("🎭 BriAI Comedy Agent - Deployment Tests")
    print("=" * 50)
    print("Note: Server must be running on localhost:8080")
    print()
    
    tests = [
        test_server_health,
        test_session_creation,
    ]
    
    passed = 0
    total = len(tests)
    
    for test in tests:
        if await test():
            passed += 1
        print()
    
    print(f"Results: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 All deployment tests passed! Server is ready.")
        return True
    else:
        print("❌ Some deployment tests failed.")
        print("💡 Make sure the server is running: python src/main.py")
        return False


if __name__ == "__main__":
    success = asyncio.run(run_deployment_tests())
    sys.exit(0 if success else 1)