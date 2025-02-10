# Hospital Dashboard Application

A modern, scalable dashboard application for hospitals built with Flask, React, Kafka, and MongoDB.

## Features

- Real-time data processing with Apache Kafka
- Dynamic data visualization with React
- Flexible data storage with MongoDB
- Role-based access control
- File upload support (CSV/Excel)
- Real-time API event stream processing
- Docker containerization

## Prerequisites

- Docker Desktop (for Mac/Windows) or Docker Engine + Docker Compose (for Linux)
- Git

## Quick Start

1. Clone the repository:

```bash
git clone <your-repository-url>
cd bch-dashboard-app
```

2. Create a `.env` file in the root directory (or use the existing one):

```bash
# Backend Configuration
MONGODB_URI=mongodb://admin:admin_password@mongodb:27017/hospital_dashboard?authSource=admin
KAFKA_BOOTSTRAP_SERVERS=kafka:29092
SECRET_KEY=your-secret-key
JWT_SECRET_KEY=your-jwt-secret-key

# Frontend Configuration
REACT_APP_API_URL=http://localhost/api

# MongoDB Configuration
MONGO_INITDB_ROOT_USERNAME=admin
MONGO_INITDB_ROOT_PASSWORD=admin_password
MONGO_APP_PASSWORD=app_password

# CORS Configuration
CORS_ALLOWED_ORIGINS=http://localhost:3000

# Kafka Configuration
KAFKA_ADVERTISED_LISTENERS=PLAINTEXT://kafka:29092,PLAINTEXT_HOST://localhost:9092
KAFKA_LISTENER_SECURITY_PROTOCOL_MAP=PLAINTEXT:PLAINTEXT,PLAINTEXT_HOST:PLAINTEXT
KAFKA_INTER_BROKER_LISTENER_NAME=PLAINTEXT
KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR=1
```

3. Start the application using Docker Compose:

```bash
docker-compose up --build
```

4. Wait for all services to start (this may take a few minutes on first run)

5. Access the application:

- Open your browser and navigate to: http://localhost/login
- Login with the default admin credentials:
  - Email: admin@hospital.com
  - Password: admin123

## Architecture

The application consists of three main components:

1. **Backend (Flask API)**

   - RESTful API endpoints
   - Authentication & Authorization
   - Data processing and streaming
   - File upload handling

2. **Frontend (React)**

   - Dynamic dashboards
   - Interactive charts and visualizations
   - Real-time data updates
   - Responsive design

3. **Infrastructure**
   - MongoDB for data storage
   - Kafka for event streaming
   - Docker containers
   - Nginx for reverse proxy

## Project Structure

```
bch-dashboard-app/
├── backend/                 # Flask application
│   ├── api/                # API endpoints
│   ├── auth/               # Authentication
│   ├── models/             # Data models
│   └── services/           # Business logic
├── frontend/               # React application
│   ├── src/
│   └── public/
├── docker/                 # Docker configurations
├── kafka/                  # Kafka configurations
└── nginx/                  # Nginx configurations
```

## Troubleshooting

1. **Port Conflicts**: Ensure ports 80, 3000, 5000, 27017, and 9092 are not in use by other applications
2. **Docker Issues**:
   - Ensure Docker Desktop is running (Mac/Windows)
   - Try stopping and removing existing containers: `docker-compose down -v`
   - Clear Docker cache: `docker system prune -a`
3. **Access Issues**:
   - Always use `http://localhost` (not `http://localhost:3000`)
   - Clear browser cache and cookies if experiencing login issues

## Development

For local development without Docker:

### Backend Development

```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: .\venv\Scripts\activate
pip install -r requirements.txt
python run.py
```

### Frontend Development

```bash
cd frontend
npm install
npm start
```

## API Documentation

Detailed API documentation is available at `/api/docs` when running the application.

## Security

- JWT-based authentication
- Role-based access control
- Secure password hashing
- HTTPS enforcement
- API rate limiting
- Input validation and sanitization

## License

MIT License
