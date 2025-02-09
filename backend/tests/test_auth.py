import pytest
from flask import Flask
from flask_jwt_extended import JWTManager
from werkzeug.security import generate_password_hash, check_password_hash
from models.user import User
from models.db import db
from datetime import datetime
import mongomock
import json

@pytest.fixture
def app():
    app = Flask(__name__)
    app.config['JWT_SECRET_KEY'] = 'test-secret-key'
    JWTManager(app)
    return app

@pytest.fixture
def client(app):
    return app.test_client()

@pytest.fixture
def mock_db(monkeypatch):
    mock_client = mongomock.MongoClient()
    mock_db = mock_client['hospital']
    monkeypatch.setattr('models.db.db', mock_db)
    return mock_db

def test_user_creation(mock_db):
    # Test user creation
    user = User.create(
        email='test@example.com',
        password='test123',
        name='Test User',
        organization='Test Org',
        role='user'
    )
    
    assert user is not None
    assert user.email == 'test@example.com'
    assert user.name == 'Test User'
    assert user.organization == 'Test Org'
    assert user.role == 'user'
    
    # Verify the user was saved to the database
    db_user = mock_db.users.find_one({'email': 'test@example.com'})
    assert db_user is not None
    assert db_user['email'] == 'test@example.com'
    assert check_password_hash(db_user['password'], 'test123')

def test_get_user_by_email(mock_db):
    # Create a test user
    mock_db.users.insert_one({
        'email': 'test@example.com',
        'password': generate_password_hash('test123'),
        'name': 'Test User',
        'organization': 'Test Org',
        'role': 'user',
        'created_at': datetime.utcnow(),
        'updated_at': datetime.utcnow()
    })
    
    # Test getting user by email
    user = User.get_by_email('test@example.com')
    assert user is not None
    assert user.email == 'test@example.com'
    assert user.name == 'Test User'
    
    # Test getting non-existent user
    user = User.get_by_email('nonexistent@example.com')
    assert user is None

def test_password_check():
    password = 'test123'
    password_hash = generate_password_hash(password)
    
    # Test correct password
    assert User.check_password(password_hash, password) is True
    
    # Test incorrect password
    assert User.check_password(password_hash, 'wrong123') is False

def test_update_password(mock_db):
    # Create a test user
    user = User.create(
        email='test@example.com',
        password='test123',
        name='Test User',
        organization='Test Org',
        role='user'
    )
    
    # Update password
    old_password_hash = user.password
    success = user.update_password('newpass123')
    
    assert success is True
    
    # Verify password was updated in database
    db_user = mock_db.users.find_one({'email': 'test@example.com'})
    assert db_user['password'] != old_password_hash
    assert check_password_hash(db_user['password'], 'newpass123')

def test_to_dict(mock_db):
    # Create a test user
    created_at = datetime.utcnow()
    user = User(
        email='test@example.com',
        name='Test User',
        organization='Test Org',
        role='user',
        created_at=created_at,
        updated_at=created_at
    )
    
    user_dict = user.to_dict()
    assert user_dict['email'] == 'test@example.com'
    assert user_dict['name'] == 'Test User'
    assert user_dict['organization'] == 'Test Org'
    assert user_dict['role'] == 'user'
    assert 'password' not in user_dict  # Ensure password is not included
    assert user_dict['created_at'] == created_at
    assert user_dict['updated_at'] == created_at 