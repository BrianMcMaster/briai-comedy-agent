#!/usr/bin/env python3
"""
BriAI Comedy Agent Test Runner

Automated test runner for the BriAI Comedy Agent test suite.
Executes all available tests and provides comprehensive reporting.

Usage:
    python tests/run_tests.py

Features:
- Runs essential functionality tests
- Provides detailed test results and reporting
- Handles test failures gracefully
- Returns appropriate exit codes for CI/CD integration
"""

import sys
import subprocess
from pathlib import Path


def run_test_file(test_file):
    """
    Execute a single test file and return success status.
    
    Args:
        test_file (Path): Path to the test file to execute
        
    Returns:
        bool: True if test passed, False if failed
    """
    print(f"\n🧪 Running {test_file.name}...")
    print("-" * 40)
    
    try:
        result = subprocess.run([sys.executable, str(test_file)], 
                              capture_output=False, 
                              text=True)
        return result.returncode == 0
    except Exception as e:
        print(f"❌ Failed to run {test_file.name}: {e}")
        return False


def main():
    """
    Execute the complete BriAI test suite.
    
    Runs all available test files and provides summary reporting.
    Excludes deployment tests that require a running server.
    
    Returns:
        int: Exit code (0 for success, 1 for failures)
    """
    print("🎭 BriAI Comedy Agent - Test Suite")
    print("=" * 50)
    
    tests_dir = Path(__file__).parent
    test_files = [
        tests_dir / "test_agent.py",
        # tests_dir / "test_deployment.py",  # Requires running server
    ]
    
    passed = 0
    total = len(test_files)
    
    for test_file in test_files:
        if test_file.exists():
            if run_test_file(test_file):
                passed += 1
        else:
            print(f"⚠️  Test file not found: {test_file}")
    
    print("\n" + "=" * 50)
    print(f"Final Results: {passed}/{total} test suites passed")
    
    if passed == total:
        print("🎉 All tests passed!")
        return 0
    else:
        print("❌ Some tests failed.")
        return 1


if __name__ == "__main__":
    sys.exit(main())