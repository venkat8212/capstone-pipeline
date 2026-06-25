FROM python:3.10-slim

WORKDIR /app

# Copy dependency definition
COPY requirements.txt .

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend source code and sqlite DB
COPY server.py .
COPY database.db .

# Expose backend port
EXPOSE 5000

# Set environment variable to make sure python output logs are unbuffered
ENV PYTHONUNBUFFERED=1

CMD ["python", "server.py"]
