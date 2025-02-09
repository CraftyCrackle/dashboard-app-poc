import pytest
from flask import Flask
from flask_jwt_extended import JWTManager
from api.auth import auth_ns
from flask_restx import Api
from models.db import db
import mongomock
import json
import pandas as pd
import io

@pytest.fixture
def app():
    app = Flask(__name__)
    app.config['JWT_SECRET_KEY'] = 'test-secret-key'
    app.config['TESTING'] = True
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
    mock_client = mongomock.MongoClient()
    mock_db = mock_client['hospital']
    monkeypatch.setattr('models.db.db', mock_db)
    return mock_db

def test_register(client, mock_db):
    # Test successful registration
    response = client.post('/api/auth/register', json={
        'email': 'test@example.com',
        'password': 'test123',
        'name': 'Test User',
        'organization': 'Test Org',
        'role': 'user'
    })
    
    assert response.status_code == 201
    data = json.loads(response.data)
    assert 'access_token' in data
    assert data['message'] == 'User registered successfully'
    
    # Verify user was created in database
    user = mock_db.users.find_one({'email': 'test@example.com'})
    assert user is not None
    assert user['name'] == 'Test User'
    
    # Test duplicate email registration
    response = client.post('/api/auth/register', json={
        'email': 'test@example.com',
        'password': 'test123',
        'name': 'Another User',
        'organization': 'Test Org',
        'role': 'user'
    })
    
    assert response.status_code == 400
    data = json.loads(response.data)
    assert data['message'] == 'Email already registered'

def test_login(client, mock_db):
    # Create a test user
    response = client.post('/api/auth/register', json={
        'email': 'test@example.com',
        'password': 'test123',
        'name': 'Test User',
        'organization': 'Test Org',
        'role': 'user'
    })
    
    # Test successful login
    response = client.post('/api/auth/login', json={
        'email': 'test@example.com',
        'password': 'test123'
    })
    
    assert response.status_code == 200
    data = json.loads(response.data)
    assert 'access_token' in data
    assert 'user' in data
    assert data['user']['email'] == 'test@example.com'
    assert data['user']['name'] == 'Test User'
    
    # Test invalid password
    response = client.post('/api/auth/login', json={
        'email': 'test@example.com',
        'password': 'wrong123'
    })
    
    assert response.status_code == 401
    data = json.loads(response.data)
    assert data['message'] == 'Invalid credentials'
    
    # Test non-existent user
    response = client.post('/api/auth/login', json={
        'email': 'nonexistent@example.com',
        'password': 'test123'
    })
    
    assert response.status_code == 401
    data = json.loads(response.data)
    assert data['message'] == 'Invalid credentials'

def test_profile(client, mock_db):
    # Create and login a test user
    register_response = client.post('/api/auth/register', json={
        'email': 'test@example.com',
        'password': 'test123',
        'name': 'Test User',
        'organization': 'Test Org',
        'role': 'user'
    })
    
    login_response = client.post('/api/auth/login', json={
        'email': 'test@example.com',
        'password': 'test123'
    })
    
    access_token = json.loads(login_response.data)['access_token']
    headers = {'Authorization': f'Bearer {access_token}'}
    
    # Test get profile
    response = client.get('/api/auth/profile', headers=headers)
    assert response.status_code == 200
    data = json.loads(response.data)
    assert data['email'] == 'test@example.com'
    assert data['name'] == 'Test User'
    assert data['organization'] == 'Test Org'
    
    # Test update profile
    response = client.put('/api/auth/profile', 
                         headers=headers,
                         json={'name': 'Updated Name'})
    assert response.status_code == 200
    
    # Verify profile was updated
    response = client.get('/api/auth/profile', headers=headers)
    data = json.loads(response.data)
    assert data['name'] == 'Updated Name'
    
    # Test unauthorized access
    response = client.get('/api/auth/profile')
    assert response.status_code == 401 

def test_download_template(client, mock_db):
    # Create and login a test user
    register_response = client.post('/api/auth/register', json={
        'email': 'test@example.com',
        'password': 'test123',
        'name': 'Test User',
        'organization': 'Test Org',
        'role': 'admin'
    })
    
    login_response = client.post('/api/auth/login', json={
        'email': 'test@example.com',
        'password': 'test123'
    })
    
    access_token = json.loads(login_response.data)['access_token']
    headers = {'Authorization': f'Bearer {access_token}'}
    
    # Test template download
    response = client.get('/api/auth/team-members/template', headers=headers)
    assert response.status_code == 200
    assert response.mimetype == 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    
    # Verify template content
    df = pd.read_excel(io.BytesIO(response.data))
    assert list(df.columns) == ['email', 'name', 'role', 'organization']

def test_upload_users(client, mock_db):
    # Create and login a test user
    register_response = client.post('/api/auth/register', json={
        'email': 'admin@example.com',
        'password': 'admin123',
        'name': 'Admin User',
        'organization': 'Test Org',
        'role': 'admin'
    })
    
    login_response = client.post('/api/auth/login', json={
        'email': 'admin@example.com',
        'password': 'admin123'
    })
    
    access_token = json.loads(login_response.data)['access_token']
    headers = {'Authorization': f'Bearer {access_token}'}
    
    # Create test Excel file
    output = io.BytesIO()
    df = pd.DataFrame([
        {
            'email': 'user1@example.com',
            'name': 'User One',
            'role': 'user',
            'organization': 'Test Org'
        },
        {
            'email': 'user2@example.com',
            'name': 'User Two',
            'role': 'viewer',
            'organization': 'Test Org'
        }
    ])
    df.to_excel(output, index=False)
    output.seek(0)
    
    # Test file upload
    response = client.post(
        '/api/auth/team-members/upload',
        headers=headers,
        data={'file': (output, 'test_users.xlsx')},
        content_type='multipart/form-data'
    )
    
    assert response.status_code == 201
    data = json.loads(response.data)
    assert data['processed'] == 2
    assert len(data['errors']) == 0
    
    # Verify users were created
    assert mock_db.users.find_one({'email': 'user1@example.com'}) is not None
    assert mock_db.users.find_one({'email': 'user2@example.com'}) is not None

def test_upload_users_validation(client, mock_db):
    # Create and login a test user
    register_response = client.post('/api/auth/register', json={
        'email': 'admin@example.com',
        'password': 'admin123',
        'name': 'Admin User',
        'organization': 'Test Org',
        'role': 'admin'
    })
    
    login_response = client.post('/api/auth/login', json={
        'email': 'admin@example.com',
        'password': 'admin123'
    })
    
    access_token = json.loads(login_response.data)['access_token']
    headers = {'Authorization': f'Bearer {access_token}'}
    
    # Create test Excel file with invalid data
    output = io.BytesIO()
    df = pd.DataFrame([
        {
            'email': 'invalid-email',  # Invalid email format
            'name': 'User One',
            'role': 'user',
            'organization': 'Test Org'
        },
        {
            'email': 'admin@example.com',  # Existing user
            'name': 'Admin User',
            'role': 'admin',
            'organization': 'Test Org'
        }
    ])
    df.to_excel(output, index=False)
    output.seek(0)
    
    # Test file upload with invalid data
    response = client.post(
        '/api/auth/team-members/upload',
        headers=headers,
        data={'file': (output, 'test_users.xlsx')},
        content_type='multipart/form-data'
    )
    
    assert response.status_code == 201
    data = json.loads(response.data)
    assert data['processed'] == 0
    assert len(data['errors']) == 2
    assert any('Invalid email format' in error for error in data['errors'])
    assert any('User already exists' in error for error in data['errors']) 