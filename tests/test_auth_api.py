import pytest
from flask import Flask
from flask_jwt_extended import JWTManager
from api.auth import auth_ns
from flask_restx import Api
from models.user import User

@pytest.fixture
def app_with_auth(app, mock_db):
    # Initialize JWT
    jwt = JWTManager(app)
    
    # Set up the API
    api = Api(app)
    api.add_namespace(auth_ns)
    
    # Set the database for the User model
    User.db = mock_db
    
    return app

@pytest.fixture
def auth_client(app_with_auth):
    return app_with_auth.test_client()

def test_register(auth_client, mock_db):
    # Test successful registration
    response = auth_client.post('/api/auth/register', json={
        'email': 'test@example.com',
        'password': 'test123',
        'name': 'Test User',
        'organization': 'Test Org',
        'role': 'user'
    })
    assert response.status_code == 201
    assert response.json['message'] == 'User registered successfully'

    # Test duplicate email registration
    response = auth_client.post('/api/auth/register', json={
        'email': 'test@example.com',
        'password': 'test123',
        'name': 'Test User 2',
        'organization': 'Test Org',
        'role': 'user'
    })
    assert response.status_code == 400
    assert 'already exists' in response.json['message']

def test_login(auth_client, mock_db):
    # Create a test user
    response = auth_client.post('/api/auth/register', json={
        'email': 'test@example.com',
        'password': 'test123',
        'name': 'Test User',
        'organization': 'Test Org',
        'role': 'user'
    })
    assert response.status_code == 201

    # Test successful login
    response = auth_client.post('/api/auth/login', json={
        'email': 'test@example.com',
        'password': 'test123'
    })
    assert response.status_code == 200
    assert 'access_token' in response.json

    # Test invalid password
    response = auth_client.post('/api/auth/login', json={
        'email': 'test@example.com',
        'password': 'wrong_password'
    })
    assert response.status_code == 401

    # Test non-existent user
    response = auth_client.post('/api/auth/login', json={
        'email': 'nonexistent@example.com',
        'password': 'test123'
    })
    assert response.status_code == 401

def test_profile(auth_client, mock_db):
    # Create and login a test user
    register_response = auth_client.post('/api/auth/register', json={
        'email': 'test@example.com',
        'password': 'test123',
        'name': 'Test User',
        'organization': 'Test Org',
        'role': 'user'
    })
    assert register_response.status_code == 201

    login_response = auth_client.post('/api/auth/login', json={
        'email': 'test@example.com',
        'password': 'test123'
    })
    assert login_response.status_code == 200
    access_token = login_response.json['access_token']

    # Test getting profile with valid token
    headers = {'Authorization': f'Bearer {access_token}'}
    response = auth_client.get('/api/auth/profile', headers=headers)
    assert response.status_code == 200
    assert response.json['email'] == 'test@example.com'
    assert response.json['name'] == 'Test User'

    # Test getting profile without token
    response = auth_client.get('/api/auth/profile')
    assert response.status_code == 401

    # Test getting profile with invalid token
    headers = {'Authorization': 'Bearer invalid_token'}
    response = auth_client.get('/api/auth/profile', headers=headers)
    assert response.status_code == 422 