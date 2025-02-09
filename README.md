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

## Prerequisites

- Docker and Docker Compose
- Node.js 18+ (for local development)
- Python 3.9+ (for local development)

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

## Setup and Installation

1. Clone the repository:

```bash
git clone https://github.com/yourusername/bch-dashboard-app.git
cd bch-dashboard-app
```

2. Start the application using Docker Compose:

```bash
docker-compose up --build
```

3. Access the application:

- Frontend: http://localhost:3000
- Backend API: http://localhost:5000
- API Documentation: http://localhost:5000/api/docs

## Development

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
