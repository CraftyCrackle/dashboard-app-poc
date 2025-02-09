# Use Python 3.9 slim image
FROM python:3.9-slim

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Create uploads directory with proper permissions
RUN mkdir -p /app/uploads && chmod 777 /app/uploads

# Copy requirements file
COPY requirements.txt .

# Create and activate virtual environment
RUN python -m venv venv
ENV PATH="/app/venv/bin:$PATH"

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create and set permissions for the entrypoint script
RUN echo '#!/bin/sh' > entrypoint.sh && \
    echo 'python init_db.py' >> entrypoint.sh && \
    echo 'gunicorn --bind 0.0.0.0:5000 --workers 2 --timeout 120 --worker-class sync --max-requests 1000 --max-requests-jitter 50 "app:create_app()"' >> entrypoint.sh && \
    chmod +x entrypoint.sh

# Expose port
EXPOSE 5000

# Set environment variables
ENV FLASK_APP=app.py
ENV FLASK_ENV=production
ENV PYTHONUNBUFFERED=1

# Run the application with Gunicorn
CMD ["sh", "entrypoint.sh"] 