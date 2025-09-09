# BriAI Comedy Agent - Docker Container
# Uses Python 3.12 with OpenAI Agents SDK for real-time voice interactions

FROM python:3.12-slim

# Set working directory
WORKDIR /app

# Install system dependencies for audio processing and UV
RUN apt-get update && apt-get install -y \
    curl \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install UV (fast Python package installer)
RUN curl -LsSf https://astral.sh/uv/install.sh | sh
ENV PATH="/root/.local/bin:$PATH"

# Copy dependency files
COPY requirements.txt pyproject.toml ./

# Install Python dependencies using UV
RUN uv pip install --system -r requirements.txt

# Copy application source code
COPY src/ ./src/
COPY frontend/ ./frontend/

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

# Start the BriAI application
CMD ["python", "-m", "src.main"]