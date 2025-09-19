# BriAI Comedy Agent - Docker Compose Operations

.PHONY: help build run stop clean logs test test-deploy test-docker shell dev restart

# Default target
help:
	@echo "🎭 BriAI Comedy Agent - Docker Compose Commands"
	@echo ""
	@echo "Available commands:"
	@echo "  build     - Build the Docker image with docker-compose"
	@echo "  run       - Run the container (automatically picks up .env changes)"
	@echo "  stop      - Stop the running container"
	@echo "  restart   - Restart the container (picks up .env changes)"
	@echo "  clean     - Remove container and image"
	@echo "  logs      - Show container logs (follow mode)"
	@echo "  test      - Run essential tests"
	@echo "  test-deploy - Test deployment (requires running server)"
	@echo "  shell     - Open shell in running container"
	@echo ""
	@echo "Usage examples:"
	@echo "  make build    # Build image"
	@echo "  make run      # Start with current .env settings"
	@echo "  make restart  # Restart to pick up .env changes"
	@echo "  make logs     # Watch logs in real-time"

# Build the Docker image with docker-compose
build:
	@echo "🔨 Building BriAI Docker image with docker-compose..."
	docker-compose build --no-cache
	@echo "✅ Build complete!"

# Run the container with docker-compose
run:
	@echo "🚀 Starting BriAI Comedy Agent..."
	@if [ ! -f .env ]; then \
		echo "❌ Error: .env file not found"; \
		echo "Please create .env file with OPENAI_API_KEY"; \
		echo "You can copy .env.example and update it"; \
		exit 1; \
	fi
	docker-compose up -d
	@echo "✅ BriAI is running at http://localhost:8080"
	@echo "📋 Use 'make logs' to see output"

# Restart the container (stops and starts to pick up .env changes)
restart:
	@echo "Restarting BriAI Comedy Agent..."
	@if [ ! -f .env ]; then \
		echo "❌ Error: .env file not found"; \
		echo "Please create .env file with OPENAI_API_KEY"; \
		exit 1; \
	fi
	docker-compose down
	docker-compose up -d
	@echo "✅ BriAI restarted with latest .env settings"
	@echo "📋 Use 'make logs' to see output"

# Stop the container
stop:
	@echo "🛑 Stopping BriAI..."
	docker-compose down
	@echo "✅ Stopped"

# Clean up containers and images
clean:
	@echo "🧹 Cleaning up..."
	docker-compose down --rmi all --volumes --remove-orphans
	@echo "✅ Cleanup complete"

# Show container logs
logs:
	@echo "📋 BriAI Container Logs (following):"
	docker-compose logs -f briai

# Run essential tests
test:
	@echo "🧪 Running essential tests..."
	python tests/run_tests.py

# Test deployment (requires running server)
test-deploy:
	@echo "🧪 Testing deployment..."
	python tests/test_deployment.py

# Test Docker build and basic functionality
test-docker:
	@echo "🧪 Testing BriAI Docker setup..."
	@echo "1. Building image..."
	make build
	@echo "2. Testing container startup..."
	docker-compose run --rm \
		-e OPENAI_API_KEY=test-validation-token \
		--entrypoint="" \
		briai \
		python -c "import src.main; print('✅ Import successful')"
	@echo "✅ Docker tests passed!"

# Open shell in running container
shell:
	@echo "🐚 Opening shell in BriAI container..."
	@if docker-compose ps briai | grep -q "Up"; then \
		docker-compose exec briai /bin/bash; \
	else \
		echo "Container not running. Starting temporary shell..."; \
		docker-compose run --rm --entrypoint=/bin/bash briai; \
	fi

# Development: rebuild and restart
dev:
	@echo "🔄 Development restart..."
	make stop
	make build
	make run
	@echo "✅ Development environment ready!"