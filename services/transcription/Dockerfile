FROM python:3.10-slim

# Install system dependencies including build tools for CUDA libraries
RUN apt-get update && apt-get install -y \
    ffmpeg \
    build-essential \
    wget \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy requirements and install Python packages (includes CUDA libs via pip)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Set up environment variables for CUDA libraries installed via pip
ENV LD_LIBRARY_PATH=/usr/local/lib/python3.10/site-packages/nvidia/cublas/lib:/usr/local/lib/python3.10/site-packages/nvidia/cudnn/lib:$LD_LIBRARY_PATH

# Copy application code
COPY . .

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD python -c "import requests; requests.get('http://localhost:5000/health')"

# Run the application with unbuffered output
CMD ["python", "-u", "app.py"]
