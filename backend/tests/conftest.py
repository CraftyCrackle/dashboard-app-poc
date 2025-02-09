import pytest
import os
import sys
from mongomock import MongoClient
from flask import Flask
from flask_jwt_extended import JWTManager
from flask_restx import Api
from api.auth import auth_ns
from models.db import get_db

# Add the backend directory to Python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

@pytest.fixture
def app():
    app = Flask(__name__)
    app.config['TESTING'] = True
    app.config['JWT_SECRET_KEY'] = 'test-secret-key'
    JWTManager(app)
    
    # Initialize API
    api = Api(app)
    api.add_namespace(auth_ns, path='/api/auth')
    
    return app

@pytest.fixture
def client(app):
    return app.test_client()

@pytest.fixture
def mock_db(monkeypatch):
    mock_client = MongoClient()
    mock_db = mock_client.db
    
    def mock_get_db():
        return mock_db
    
    monkeypatch.setattr('models.db.get_db', mock_get_db)
    return mock_db

# Test configuration
def pytest_configure(config):
    """
    Allows plugins and conftest files to perform initial configuration.
    This hook is called for every plugin and initial conftest file
    after command line options have been parsed.
    """
    os.environ['TESTING'] = 'True'
    os.environ['MONGODB_URI'] = 'mongodb://mongomock:27017/test_db'
    os.environ['JWT_SECRET_KEY'] = 'test-secret-key' 