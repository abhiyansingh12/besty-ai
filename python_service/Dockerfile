FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY app.py .

# Expose port
EXPOSE 5001

# Run the service
CMD ["sh", "-c", "gunicorn --bind 0.0.0.0:${PORT:-5001} app:app"]
