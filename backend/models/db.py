from pymongo import MongoClient
from flask import current_app, g
import os
import mongomock

# Store the mock client at module level for testing
_mock_client = None

def get_client():
    """
    Returns a MongoDB client instance.
    Can be overridden in tests.
    """
    global _mock_client
    
    if not hasattr(g, 'mongo_client'):
        if current_app and current_app.config.get('TESTING'):
            if _mock_client is None:
                _mock_client = mongomock.MongoClient()
            g.mongo_client = _mock_client
        else:
            g.mongo_client = MongoClient(os.getenv('MONGODB_URI', 'mongodb://mongodb:27017/'))
    return g.mongo_client

# Initialize a default client and database for module-level access
if os.getenv('TESTING'):
    _default_client = mongomock.MongoClient()
else:
    _default_client = MongoClient(os.getenv('MONGODB_URI', 'mongodb://mongodb:27017/'))
db = _default_client['hospital_dashboard']

def get_db():
    """
    Returns a MongoDB database connection.
    Creates a new connection if one doesn't exist for the current application context.
    """
    if 'db' not in g:
        client = get_client()
        g.db = client['hospital_dashboard']
    return g.db

def close_db(e=None):
    """
    Closes the MongoDB connection if it exists.
    """
    db = g.pop('db', None)
    if db is not None and not current_app.config.get('TESTING'):
        db.client.close()
    g.pop('mongo_client', None)

def init_db(app=None):
    """
    Initializes the database with the application context.
    Creates indexes and initial collections if needed.
    """
    db = get_db()
    
    # Create indexes
    db.users.create_index('email', unique=True)
    db.organizations.create_index('name', unique=True)
    db.dashboards.create_index([('organization', 1), ('name', 1)], unique=True)
    
    # Create initial collections if they don't exist
    if 'users' not in db.list_collection_names():
        db.create_collection('users')
    
    if 'organizations' not in db.list_collection_names():
        db.create_collection('organizations')
    
    if 'dashboards' not in db.list_collection_names():
        db.create_collection('dashboards')
    
    if 'data_sources' not in db.list_collection_names():
        db.create_collection('data_sources')
    
    if 'events' not in db.list_collection_names():
        db.create_collection('events')

def register_db(app):
    """
    Registers database functions with the Flask application.
    """
    app.teardown_appcontext(close_db)
    init_db(app) 