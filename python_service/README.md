# Python Pandas Service - Quick Start

## Installation

1. Navigate to the python_service directory:
```bash
cd python_service
```

2. Make the start script executable:
```bash
chmod +x start.sh
```

3. Run the service:
```bash
./start.sh
```

The service will:
- Create a virtual environment
- Install dependencies
- Start on http://localhost:5001

## Testing

Test the health endpoint:
```bash
curl http://localhost:5001/health
```

Expected response:
```json
{"status": "healthy", "service": "pandas-calculator"}
```

## Environment Setup

Add to your `.env` file:
```bash
PANDAS_SERVICE_URL=http://localhost:5001
```

## Logs

The service will output:
- DataFrame loading confirmations
- Code execution logs
- Error messages with tracebacks

## Stopping the Service

Press `Ctrl+C` in the terminal running the service.
