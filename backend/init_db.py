from pymongo import MongoClient
from werkzeug.security import generate_password_hash
from datetime import datetime
import time
import os

def init_db():
    max_retries = 30
    retry_interval = 2

    for attempt in range(max_retries):
        try:
            print(f"Database initialization attempt {attempt + 1}/{max_retries}")
            
            # Connect to MongoDB using the URI from environment variable
            mongodb_uri = os.getenv('MONGODB_URI', 'mongodb://mongodb:27017/hospital_dashboard?replicaSet=rs0&directConnection=true')
            print(f"Connecting to MongoDB at: {mongodb_uri}")
            
            client = MongoClient(mongodb_uri)
            db = client.get_database()  # This will use the database name from the URI
            
            # Test the connection
            client.admin.command('ping')
            print("Successfully connected to MongoDB")
            
            # Wait for replica set to be ready
            time.sleep(2)
            
            # Check if admin user already exists
            existing_user = db.users.find_one({'email': 'admin@hospital.com'})
            
            if existing_user is None:
                # Create admin user
                admin_user = {
                    'email': 'admin@hospital.com',
                    'password': generate_password_hash('admin123'),
                    'name': 'Admin User',
                    'organization': 'Hospital Admin',
                    'role': 'admin',
                    'created_at': datetime.utcnow()
                }
                
                # Insert admin user
                result = db.users.insert_one(admin_user)
                print(f"Default admin user created successfully with ID: {result.inserted_id}")
            else:
                print("Admin user already exists with ID:", existing_user['_id'])
                # Update the password to ensure it's correct
                db.users.update_one(
                    {'email': 'admin@hospital.com'},
                    {'$set': {'password': generate_password_hash('admin123')}}
                )
                print("Admin password has been reset")
            
            # Create necessary indexes
            db.users.create_index('email', unique=True)
            
            print("Database initialization completed successfully")
            return
            
        except Exception as e:
            print(f"Attempt {attempt + 1} failed: {str(e)}")
            if attempt < max_retries - 1:
                print(f"Retrying in {retry_interval} seconds...")
                time.sleep(retry_interval)
            else:
                print("Max retries reached. Database initialization failed.")
                raise e

if __name__ == '__main__':
    print("Starting database initialization...")
    init_db()
    print("Database initialization completed") 