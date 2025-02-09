import pytest
from datetime import datetime
from werkzeug.security import generate_password_hash
from models.user import User

def test_user_creation(mock_db):
    # Test user creation
    User.db = mock_db  # Set the database for the User model
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

def test_get_user_by_email(mock_db):
    # Set the database for the User model
    User.db = mock_db
    
    # Create a test user
    user = User.create(
        email='test@example.com',
        password='test123',
        name='Test User',
        organization='Test Org',
        role='user'
    )

    # Test getting user by email
    found_user = User.get_by_email('test@example.com')
    assert found_user is not None
    assert found_user.email == 'test@example.com'
    assert found_user.name == 'Test User'

    # Test getting non-existent user
    not_found_user = User.get_by_email('nonexistent@example.com')
    assert not_found_user is None

def test_password_check(mock_db):
    # Set the database for the User model
    User.db = mock_db
    
    # Create a test user
    user = User.create(
        email='test@example.com',
        password='test123',
        name='Test User',
        organization='Test Org',
        role='user'
    )

    # Test correct password
    assert user.check_password('test123')
    # Test incorrect password
    assert not user.check_password('wrong_password')

def test_update_password(mock_db):
    # Set the database for the User model
    User.db = mock_db
    
    # Create a test user
    user = User.create(
        email='test@example.com',
        password='test123',
        name='Test User',
        organization='Test Org',
        role='user'
    )

    # Update password
    old_password = user.password
    user.update_password('new_password123')
    assert user.password != old_password
    assert user.check_password('new_password123')
    assert not user.check_password('test123')

def test_to_dict(mock_db):
    # Set the database for the User model
    User.db = mock_db
    
    # Create a test user
    user = User.create(
        email='test@example.com',
        password='test123',
        name='Test User',
        organization='Test Org',
        role='user'
    )

    # Test to_dict method
    user_dict = user.to_dict()
    assert user_dict['email'] == 'test@example.com'
    assert user_dict['name'] == 'Test User'
    assert user_dict['organization'] == 'Test Org'
    assert user_dict['role'] == 'user'
    assert 'password' not in user_dict  # Password should not be included in dict 