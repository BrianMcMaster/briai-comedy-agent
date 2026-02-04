#!/usr/bin/env python3
"""
BriAI Comedy Agent - Essential Functionality Tests

Core functionality tests for the BriAI Comedy Agent application.
Tests agent initialization, environment configuration, and basic setup.

Test Coverage:
- Agent initialization and configuration
- Environment variable validation
- Comedy personality setup
- OpenAI API client configuration

Usage:
    python tests/test_agent.py
"""

import os
import sys
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from main import BriAIRealtimeApp


def test_agent_initialization():
    """
    Test BriAI agent initialization and configuration.
    
    Validates:
    - Agent creates successfully with test API key
    - Essential properties are set correctly
    - Comedy instructions are properly configured
    - BriAI personality is included in instructions
    
    Returns:
        bool: True if initialization test passes, False otherwise
    """
    print("Testing agent initialization...")
    
    # Mock API token for testing
    os.environ["OPENAI_API_KEY"] = "test-token-placeholder"  # pragma: allowlist secret
    # Ensure test isolation from developer environment
    os.environ.pop("OPENAI_INSTRUCTIONS", None)
    
    try:
        app = BriAIRealtimeApp()
        
        # Verify essential properties
        assert app.api_key == "test-token-placeholder"
        assert app.model is not None
        assert app.instructions is not None
        assert "comedy" in app.instructions.lower()
        assert "BriAI" in app.instructions
        
        print("✅ Agent initialization successful")
        return True
        
    except Exception as e:
        print(f"❌ Agent initialization failed: {e}")
        return False


def test_environment_setup():
    """
    Test environment variable configuration and defaults.
    
    Validates:
    - OpenAI API key configuration (warns if using test key)
    - Model configuration with proper defaults
    - Port configuration with fallback values
    - Environment variable handling
    
    Returns:
        bool: True if environment setup is valid, False otherwise
    """
    print("Testing environment setup...")
    
    try:
        # Check required environment variables
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key or api_key == "test-token-placeholder":
            print("⚠️  OPENAI_API_KEY not set (using test token)")
        else:
            print("✅ OPENAI_API_KEY configured")
        
        # Check model configuration
        model = os.getenv("OPENAI_MODEL", "gpt-4o-realtime-preview")
        print(f"✅ Model configured: {model}")
        
        # Check port configuration
        port = int(os.getenv("PORT", 8080))
        print(f"✅ Port configured: {port}")
        
        return True
        
    except Exception as e:
        print(f"❌ Environment setup failed: {e}")
        return False


def run_tests():
    """
    Execute all essential functionality tests for BriAI Comedy Agent.
    
    Runs the complete test suite for core agent functionality
    and provides detailed reporting of test results.
    
    Returns:
        bool: True if all tests pass, False if any test fails
    """
    print("🎭 BriAI Comedy Agent - Essential Tests")
    print("=" * 50)
    
    tests = [
        test_environment_setup,
        test_agent_initialization,
    ]
    
    passed = 0
    total = len(tests)
    
    for test in tests:
        if test():
            passed += 1
        print()
    
    print(f"Results: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 All tests passed! Agent is ready.")
        return True
    else:
        print("❌ Some tests failed. Check configuration.")
        return False


if __name__ == "__main__":
    success = run_tests()
    sys.exit(0 if success else 1)
