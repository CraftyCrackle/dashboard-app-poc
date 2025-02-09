from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime
from flask_login import UserMixin
from bson import ObjectId
from models.db import get_db

class User(UserMixin):
    def __init__(self, email, password=None, name=None, organization=None, role='user', created_at=None, updated_at=None, _id=None):
        self.email = email
        self.password = password
        self.name = name
        self.organization = organization
        self.role = role
        self.created_at = created_at or datetime.utcnow()
        self.updated_at = updated_at or datetime.utcnow()
        self._id = _id

    def get_id(self):
        return str(self._id) if self._id else None

    def is_authenticated(self):
        return True

    def is_active(self):
        return True

    def is_anonymous(self):
        return False

    def check_password(self, password):
        if not self.password:
            return False
        return check_password_hash(self.password, password)

    @staticmethod
    def check_password_hash(password_hash, password):
        return check_password_hash(password_hash, password)

    @classmethod
    def create(cls, email, password, name=None, organization=None, role='user'):
        try:
            db = get_db()
            password_hash = generate_password_hash(password)
            user_data = {
                'email': email,
                'password': password_hash,
                'name': name,
                'organization': organization,
                'role': role,
                'created_at': datetime.utcnow(),
                'updated_at': datetime.utcnow()
            }
            result = db.users.insert_one(user_data)
            user_data['_id'] = result.inserted_id
            return cls(**user_data)
        except Exception as e:
            print(f"Error creating user: {str(e)}")
            return None

    @classmethod
    def get_by_email(cls, email):
        try:
            db = get_db()
            user_data = db.users.find_one({'email': email})
            if user_data:
                return cls(**user_data)
            return None
        except Exception as e:
            print(f"Error getting user by email: {str(e)}")
            return None

    @classmethod
    def get_by_id(cls, user_id):
        try:
            db = get_db()
            user_data = db.users.find_one({'_id': ObjectId(user_id)})
            if user_data:
                return cls(**user_data)
            return None
        except Exception as e:
            print(f"Error getting user by ID: {str(e)}")
            return None

    def update_password(self, new_password):
        try:
            db = get_db()
            password_hash = generate_password_hash(new_password)
            db.users.update_one(
                {'_id': self._id},
                {
                    '$set': {
                        'password': password_hash,
                        'updated_at': datetime.utcnow()
                    }
                }
            )
            self.password = password_hash
            return True
        except Exception as e:
            print(f"Error updating password: {str(e)}")
            return False

    def to_dict(self):
        return {
            'id': str(self._id),
            'email': self.email,
            'name': self.name,
            'organization': self.organization,
            'role': self.role,
            'created_at': self.created_at,
            'updated_at': self.updated_at
        } 