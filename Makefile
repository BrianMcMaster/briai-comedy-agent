# BriAI Comedy Agent - Docker Operations

.PHONY: help build run stop clean logs test test-deploy test-docker shell dev

# Default target
help:
	@echo "🎭 BriAI Comedy Agent - Docker Commands"
	@echo ""
	@echo "Available commands:"
	@echo "  build     - Build the Docker image"
	@echo "  run       - Run the container (requires OPENAI_API_KEY in .env)"
	@echo "  stop      - Stop the running container"
	@echo "  clean     - Remove container and image"
	@echo "  logs      - Show container logs"
	@echo "  test      - Run essential tests"
	@echo "  test-deploy - Test deployment (requires running server)"
	@echo "  shell     - Open shell in running container"
	@echo ""
	@echo "Usage examples:"
	@echo "  make build"
	@echo "  make run"
	@echo "  make logs"

# Build the Docker image
build:
	@echo "🔨 Building BriAI Docker image..."
	docker build -t briai-local .
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

# Run container directly (alternative to docker-compose)
run-direct:
	@echo "🚀 Starting BriAI Comedy Agent (direct)..."
	@if [ -z "$(OPENAI_API_KEY)" ]; then \
		echo "❌ Error: OPENAI_API_KEY environment variable required"; \
		echo "Usage: OPENAI_API_KEY=your-key make run-direct"; \
		exit 1; \
	fi
	docker run -d \
		--name briai-comedy-agent \
		-p 8080:8080 \
		-e OPENAI_API_KEY=$(OPENAI_API_KEY) \
		briai-local
	@echo "✅ BriAI is running at http://localhost:8080"

# Stop the container
stop:
	@echo "🛑 Stopping BriAI..."
	docker-compose down || docker stop briai-comedy-agent || true
	@echo "✅ Stopped"

# Clean up containers and images
clean:
	@echo "🧹 Cleaning up..."
	docker-compose down --rmi all --volumes --remove-orphans || true
	docker rm -f briai-comedy-agent || true
	docker rmi briai-local || true
	@echo "✅ Cleanup complete"

# Show container logs
logs:
	@echo "📋 BriAI Container Logs:"
	docker-compose logs -f briai || docker logs -f briai-comedy-agent

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
	docker run --rm \
		-e OPENAI_API_KEY=test-validation-token \  # pragma: allowlist secret
		--entrypoint="" \
		briai-local \
		python -c "import src.main; print('✅ Import successful')"
	@echo "✅ Docker tests passed!"

# Open shell in running container
shell:
	@echo "🐚 Opening shell in BriAI container..."
	docker exec -it briai-comedy-agent /bin/bash || \
	docker run --rm -it \
		-e OPENAI_API_KEY=test-token \  # pragma: allowlist secret
		--entrypoint=/bin/bash \
		briai-local

# Development: rebuild and restart
dev:
	@echo "🔄 Development restart..."
	make stop
	make build
	make run
	@echo "✅ Development environment ready!"