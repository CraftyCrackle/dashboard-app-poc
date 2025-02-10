from flask import Flask
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from flask_restx import Api
from datetime import timedelta
from dotenv import load_dotenv
import os

# Load environment variables
load_dotenv()

def create_app():
    app = Flask(__name__)
    
    # Configure app
    app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'your-secret-key-here')
    app.config['JWT_SECRET_KEY'] = os.getenv('JWT_SECRET_KEY', 'your-jwt-secret-key-here')
    app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(hours=1)
    app.config['MONGODB_URI'] = os.getenv('MONGODB_URI', 'mongodb://localhost:27017/hospital_dashboard')
    app.config['KAFKA_BOOTSTRAP_SERVERS'] = os.getenv('KAFKA_BOOTSTRAP_SERVERS', 'localhost:9092')
    
    # Configure CORS
    CORS(app, resources={
        r"/*": {
            "origins": ["http://localhost:3000"],
            "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
            "allow_headers": ["Content-Type", "Authorization"],
            "expose_headers": ["Authorization"],
            "supports_credentials": True,
            "max_age": 3600
        }
    })
    
    # Initialize extensions
    jwt = JWTManager(app)
    
    # Initialize API with swagger documentation
    api = Api(app, version='1.0', title='Hospital Dashboard API',
             description='A modern hospital dashboard API with real-time data processing')
    
    # Register blueprints
    from api.auth import auth_ns
    from api.dashboard import dashboard_ns
    from api.data import data_ns
    
    api.add_namespace(auth_ns, path='/auth')
    api.add_namespace(dashboard_ns, path='/dashboard')
    api.add_namespace(data_ns, path='/data')
    
    @app.route('/health')
    def health_check():
        return {'status': 'healthy'}, 200
    
    return app

if __name__ == '__main__':
    app = create_app()
    app.run(debug=True, host='0.0.0.0', port=5000) 