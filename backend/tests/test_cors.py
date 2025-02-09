import pytest
import os
import tempfile
from unittest.mock import patch
from app import create_app
import mongomock
from models.db import get_db, get_client, init_db

@pytest.fixture
def app():
    # Set testing environment
    os.environ['TESTING'] = 'true'
    
    # Create a temporary directory for uploads during testing
    test_upload_dir = tempfile.mkdtemp()
    
    # Create the Flask app with test config
    app = create_app()
    app.config.update({
        'TESTING': True,
        'UPLOAD_DIR': test_upload_dir,
        'MONGODB_URI': 'mongomock://localhost'
    })
    
    with app.app_context():
        # Initialize the database
        init_db(app)
        
        # Get the database connection
        db = get_db()
        
        # Create test collections if they don't exist
        if 'public_charts' not in db.list_collection_names():
            db.create_collection('public_charts')
        if 'users' not in db.list_collection_names():
            db.create_collection('users')
        
        # Add a test public chart
        db.public_charts.delete_many({})  # Clear existing data
        db.public_charts.insert_one({
            '_id': 'test-chart',
            'title': 'Test Chart',
            'type': 'line',
            'data': {'values': [1, 2, 3]}
        })
        
        # Verify the data was inserted
        print("\nDebug: Collections in database:", db.list_collection_names())
        print("Debug: Public charts count:", db.public_charts.count_documents({}))
        test_chart = db.public_charts.find_one({'_id': 'test-chart'})
        print("Debug: Test chart:", test_chart)
    
    yield app
    
    # Clean up
    os.environ.pop('TESTING', None)
    try:
        os.rmdir(test_upload_dir)
    except OSError:
        pass

@pytest.fixture
def client(app):
    return app.test_client()

def test_cors_headers(client):
    """Test CORS headers for API endpoints"""
    headers = {
        'Origin': 'http://localhost:3000',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type, Authorization'
    }
    response = client.options('/auth/login', headers=headers)
    assert response.status_code == 200
    assert response.headers.get('Access-Control-Allow-Origin') == 'http://localhost:3000'
    
    # Check headers in a way that's independent of order
    allowed_headers = set(response.headers.get('Access-Control-Allow-Headers', '').split(', '))
    expected_headers = {'Content-Type', 'Authorization'}
    assert allowed_headers == expected_headers
    
    # Check methods in a way that's independent of order
    allowed_methods = set(response.headers.get('Access-Control-Allow-Methods', '').split(', '))
    expected_methods = {'GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'}
    assert allowed_methods == expected_methods

def test_cors_unauthorized_origin(client):
    """Test CORS headers with unauthorized origin"""
    response = client.get('/auth/profile', headers={'Origin': 'http://unauthorized.com'})
    assert response.status_code == 401  # Should be unauthorized without valid token
    assert response.headers.get('Access-Control-Allow-Origin') != 'http://unauthorized.com'

def test_cors_public_chart(client):
    """Test CORS headers for public chart endpoint"""
    # Debug: Check database state before making the request
    with client.application.app_context():
        db = get_db()
        print("\nDebug: Collections before request:", db.list_collection_names())
        print("Debug: Public charts count before request:", db.public_charts.count_documents({}))
        test_chart = db.public_charts.find_one({'_id': 'test-chart'})
        print("Debug: Test chart before request:", test_chart)
    
    response = client.get('/dashboard/public/chart/test-chart')
    assert response.status_code == 200  # Chart should exist now
    assert response.headers.get('Access-Control-Allow-Origin') == '*'  # Public endpoint should allow all origins
    
    # Test response data
    data = response.get_json()
    assert data['title'] == 'Test Chart'
    assert data['type'] == 'line'
    assert data['data']['values'] == [1, 2, 3]