import pytest
import os
import sys
from mongomock import MongoClient
from flask import Flask
from db import Database

# Add the backend directory to the Python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

@pytest.fixture
def app():
    app = Flask(__name__)
    app.config['TESTING'] = True
    app.config['JWT_SECRET_KEY'] = 'test-secret-key'
    return app

@pytest.fixture
def mock_db():
    client = MongoClient()
    db = Database(client, 'test_db')
    return db

@pytest.fixture
def client(app):
    return app.test_client() 