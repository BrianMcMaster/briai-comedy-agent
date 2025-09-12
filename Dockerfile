# BriAI Comedy Agent - Docker Container
# Uses Python 3.12 with OpenAI Agents SDK for real-time voice interactions

FROM python:3.12-slim

# Set working directory
WORKDIR /app

# Install system dependencies for audio processing
RUN apt-get update && apt-get install -y \
    curl \
    build-essential \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install UV using the official method
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# Copy dependency files first for better Docker layer caching
COPY pyproject.toml uv.lock* ./

# Install dependencies using UV's native project management
# Use --frozen to ensure lockfile is used exactly as-is
# Use --no-install-project to install only dependencies (not the project itself yet)
RUN uv sync --frozen --no-install-project --no-dev

# Copy application source code
COPY src/ ./src/
COPY frontend/ ./frontend/

# Now install the project itself
RUN uv sync --frozen --no-dev

# Create non-root user for security
RUN useradd --create-home --shell /bin/bash briai
RUN chown -R briai:briai /app
USER briai

# Expose port for web interface
EXPOSE 8080

# Set environment variables for container
ENV HOST=0.0.0.0
ENV PORT=8080
ENV PYTHONPATH=/app

# Health check to ensure the service is running
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080/api/session/status || exit 1

# Start the BriAI application using UV
CMD ["uv", "run", "python", "-m", "src.main"]