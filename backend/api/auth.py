from flask_restx import Namespace, Resource, fields
from flask import request, make_response, send_file
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from werkzeug.security import generate_password_hash, check_password_hash
from models.user import User
from models.db import get_db
from bson.objectid import ObjectId
from datetime import datetime, timedelta
import secrets
import string
import pandas as pd
import io
import re
from functools import wraps

auth_ns = Namespace('auth', description='Authentication operations')

def auth_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get('Authorization')
        if not auth_header:
            return {'message': 'No authentication provided'}, 401

        db = get_db()
        try:
            if auth_header.startswith('Bearer '):
                token = auth_header.split(' ')[1]
                
                # First try as API key
                key_data = db.api_keys.find_one({
                    'key': token,
                    'is_active': True
                })
                
                if key_data:
                    # Update last used timestamp
                    db.api_keys.update_one(
                        {'_id': key_data['_id']},
                        {'$set': {'last_used': datetime.utcnow()}}
                    )
                    
                    # Get user information
                    user = db.users.find_one({'_id': key_data['user_id']})
                    if not user:
                        return {'message': 'User not found'}, 404
                    
                    # Create audit log entry
                    audit_entry = {
                        'action': f'api_request_{request.method.lower()}',
                        'action_type': 'api',
                        'performed_by': user['name'],
                        'user_id': key_data['user_id'],
                        'organization': user['organization'],
                        'timestamp': datetime.utcnow(),
                        'details': f"API request to {request.path} using API key '{key_data['name']}'"
                    }
                    db.audit_log.insert_one(audit_entry)
                    
                    # Set user ID for the request
                    request.user_id = str(key_data['user_id'])
                    return f(*args, **kwargs)
                
                # If not an API key, try as JWT
                try:
                    from flask_jwt_extended import verify_jwt_in_request
                    verify_jwt_in_request()
                    return f(*args, **kwargs)
                except Exception as jwt_error:
                    return {'message': 'Invalid authentication token'}, 401
            
            return {'message': 'Invalid authorization format'}, 401
            
        except Exception as e:
            return {'message': f'Authentication error: {str(e)}'}, 401
    
    return decorated

# Models for request/response
login_model = auth_ns.model('Login', {
    'email': fields.String(required=True, description='User email'),
    'password': fields.String(required=True, description='User password')
})

register_model = auth_ns.model('Register', {
    'email': fields.String(required=True, description='User email'),
    'password': fields.String(required=True, description='User password'),
    'name': fields.String(required=True, description='User full name'),
    'organization': fields.String(required=True, description='User organization'),
    'role': fields.String(required=True, description='User role', enum=['admin', 'user', 'viewer'])
})

@auth_ns.route('/login')
class Login(Resource):
    @auth_ns.expect(login_model)
    def post(self):
        data = request.get_json()
        db = get_db()
        
        print(f"Login attempt for email: {data['email']}")
        
        user = db.users.find_one({'email': data['email']})
        if not user:
            print(f"User not found with email: {data['email']}")
            return {'message': 'Invalid credentials'}, 401
            
        if check_password_hash(user['password'], data['password']):
            print(f"Login successful for user: {user['email']}")
            access_token = create_access_token(identity=str(user['_id']))
            return {
                'access_token': access_token,
                'user': {
                    'email': user['email'],
                    'name': user['name'],
                    'organization': user['organization'],
                    'role': user['role']
                }
            }
        
        print(f"Invalid password for user: {user['email']}")
        return {'message': 'Invalid credentials'}, 401

@auth_ns.route('/register')
class Register(Resource):
    @auth_ns.expect(register_model)
    def post(self):
        data = request.get_json()
        db = get_db()
        
        if db.users.find_one({'email': data['email']}):
            return {'message': 'Email already registered'}, 400
        
        user = {
            'email': data['email'],
            'password': generate_password_hash(data['password']),
            'name': data['name'],
            'organization': data['organization'],
            'role': data['role'],
            'created_at': datetime.utcnow()
        }
        
        result = db.users.insert_one(user)
        access_token = create_access_token(identity=str(result.inserted_id))
        
        return {
            'message': 'User registered successfully',
            'access_token': access_token
        }, 201

@auth_ns.route('/profile')
class Profile(Resource):
    @auth_required
    def options(self):
        """Handle preflight request for PUT method"""
        response = make_response()
        response.headers.add('Access-Control-Allow-Origin', 'http://localhost:3000')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
        response.headers.add('Access-Control-Allow-Methods', 'GET,PUT')
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        return response

    @auth_required
    def get(self):
        try:
            # Get user ID from either JWT or API key
            user_id = request.user_id if hasattr(request, 'user_id') else get_jwt_identity()
            db = get_db()
            
            user = db.users.find_one({'_id': ObjectId(user_id)})
            if not user:
                return {'message': 'User not found'}, 404
            
            response = make_response({
                'email': user['email'],
                'name': user['name'],
                'organization': user['organization'],
                'role': user['role']
            })
            response.headers.add('Access-Control-Allow-Origin', 'http://localhost:3000')
            response.headers.add('Access-Control-Allow-Credentials', 'true')
            return response
        except Exception as e:
            return {'message': f'Error fetching profile: {str(e)}'}, 500

    @auth_required
    def put(self):
        try:
            user_id = request.user_id if hasattr(request, 'user_id') else get_jwt_identity()
            data = request.get_json()
            db = get_db()
            
            updates = {}
            allowed_fields = ['name', 'organization']
            for field in allowed_fields:
                if field in data:
                    updates[field] = data[field]
            
            if updates:
                db.users.update_one(
                    {'_id': ObjectId(user_id)},
                    {'$set': updates}
                )
                
            response = make_response({'message': 'Profile updated successfully'})
            response.headers.add('Access-Control-Allow-Origin', 'http://localhost:3000')
            response.headers.add('Access-Control-Allow-Credentials', 'true')
            return response
        except Exception as e:
            return {'message': f'Error updating profile: {str(e)}'}, 500

@auth_ns.route('/profile/change-password')
class ChangePassword(Resource):
    @jwt_required()
    def put(self):
        """Change user password"""
        current_user_id = get_jwt_identity()
        data = request.get_json()
        db = get_db()
        
        # Get current user
        user = db.users.find_one({'_id': ObjectId(current_user_id)})
        if not user:
            return {'message': 'User not found'}, 404
            
        # Verify current password
        if not check_password_hash(user['password'], data['current_password']):
            return {'message': 'Current password is incorrect'}, 401
            
        # Update password
        new_password_hash = generate_password_hash(data['new_password'])
        db.users.update_one(
            {'_id': ObjectId(current_user_id)},
            {'$set': {
                'password': new_password_hash,
                'updated_at': datetime.utcnow()
            }}
        )
        
        response = make_response({'message': 'Password updated successfully'})
        response.headers.add('Access-Control-Allow-Origin', 'http://localhost:3000')
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        return response

@auth_ns.route('/profile/api-endpoints')
class ApiEndpoints(Resource):
    @jwt_required()
    def get(self):
        """Get user's API endpoints"""
        current_user_id = get_jwt_identity()
        db = get_db()
        
        user = db.users.find_one({'_id': ObjectId(current_user_id)})
        if not user:
            return {'message': 'User not found'}, 404
        
        # Get API endpoints for the user
        endpoints = list(db.api_endpoints.find({'user_id': ObjectId(current_user_id)}))
        
        response = make_response({
            'endpoints': [{
                'id': str(endpoint['_id']),
                'name': endpoint['name'],
                'endpoint': endpoint['endpoint'],
                'method': endpoint['method'],
                'description': endpoint.get('description', ''),
                'created_at': endpoint['created_at'].isoformat(),
                'is_active': endpoint.get('is_active', True)
            } for endpoint in endpoints]
        })
        response.headers.add('Access-Control-Allow-Origin', 'http://localhost:3000')
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        return response

    @jwt_required()
    def post(self):
        """Create a new API endpoint"""
        current_user_id = get_jwt_identity()
        data = request.get_json()
        db = get_db()
        
        # Validate required fields
        required_fields = ['name', 'endpoint', 'method']
        if not all(field in data for field in required_fields):
            return {'message': 'Missing required fields'}, 400
            
        # Create new endpoint
        new_endpoint = {
            'user_id': ObjectId(current_user_id),
            'name': data['name'],
            'endpoint': data['endpoint'],
            'method': data['method'].upper(),
            'description': data.get('description', ''),
            'is_active': data.get('is_active', True),
            'created_at': datetime.utcnow()
        }
        
        result = db.api_endpoints.insert_one(new_endpoint)
        
        response = make_response({
            'message': 'API endpoint created successfully',
            'endpoint_id': str(result.inserted_id)
        })
        response.headers.add('Access-Control-Allow-Origin', 'http://localhost:3000')
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        return response

@auth_ns.route('/profile/api-endpoints/<endpoint_id>')
class ApiEndpoint(Resource):
    @jwt_required()
    def put(self, endpoint_id):
        """Update an API endpoint"""
        current_user_id = get_jwt_identity()
        data = request.get_json()
        db = get_db()
        
        # Update endpoint
        result = db.api_endpoints.update_one(
            {
                '_id': ObjectId(endpoint_id),
                'user_id': ObjectId(current_user_id)
            },
            {
                '$set': {
                    'name': data.get('name'),
                    'endpoint': data.get('endpoint'),
                    'method': data.get('method', '').upper(),
                    'description': data.get('description', ''),
                    'is_active': data.get('is_active', True)
                }
            }
        )
        
        if result.matched_count == 0:
            return {'message': 'API endpoint not found'}, 404
            
        response = make_response({'message': 'API endpoint updated successfully'})
        response.headers.add('Access-Control-Allow-Origin', 'http://localhost:3000')
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        return response

    @jwt_required()
    def delete(self, endpoint_id):
        """Delete an API endpoint"""
        current_user_id = get_jwt_identity()
        db = get_db()
        
        result = db.api_endpoints.delete_one({
            '_id': ObjectId(endpoint_id),
            'user_id': ObjectId(current_user_id)
        })
        
        if result.deleted_count == 0:
            return {'message': 'API endpoint not found'}, 404
            
        response = make_response({'message': 'API endpoint deleted successfully'})
        response.headers.add('Access-Control-Allow-Origin', 'http://localhost:3000')
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        return response

@auth_ns.route('/team-members')
class TeamMembers(Resource):
    @jwt_required()
    def get(self):
        """Get organization team members"""
        current_user_id = get_jwt_identity()
        db = get_db()
        
        user = db.users.find_one({'_id': ObjectId(current_user_id)})
        if not user:
            return {'message': 'User not found'}, 404
            
        # Get team members from the same organization
        members = list(db.users.find({'organization': user['organization']}))
        
        response = make_response({
            'members': [{
                'id': str(member['_id']),
                'email': member['email'],
                'name': member['name'],
                'role': member['role'],
                'status': 'Active'  # You might want to add a status field to your user model
            } for member in members]
        })
        response.headers.add('Access-Control-Allow-Origin', 'http://localhost:3000')
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        return response

    @jwt_required()
    def post(self):
        """Invite a new team member"""
        current_user_id = get_jwt_identity()
        data = request.get_json()
        db = get_db()
        
        user = db.users.find_one({'_id': ObjectId(current_user_id)})
        if not user:
            return {'message': 'User not found'}, 404
            
        # Create invitation
        invitation = {
            'email': data['email'],
            'name': data['name'],
            'role': data['role'],
            'organization': user['organization'],
            'invited_by': str(user['_id']),
            'created_at': datetime.utcnow(),
            'expires_at': datetime.utcnow() + timedelta(days=7),
            'token': ''.join(secrets.choice(string.ascii_letters + string.digits) for _ in range(32))
        }
        
        db.invitations.insert_one(invitation)
        
        # TODO: Send invitation email
        
        response = make_response({'message': 'Invitation sent successfully'})
        response.headers.add('Access-Control-Allow-Origin', 'http://localhost:3000')
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        return response

@auth_ns.route('/api-keys')
class ApiKeys(Resource):
    @jwt_required()
    def get(self):
        """Get user's API keys"""
        current_user_id = get_jwt_identity()
        db = get_db()
        
        keys = list(db.api_keys.find({'user_id': ObjectId(current_user_id)}))
        
        response = make_response({
            'keys': [{
                'id': str(key['_id']),
                'name': key['name'],
                'key': key['key'],
                'created_at': key['created_at'].isoformat(),
                'last_used': key.get('last_used', key['created_at']).isoformat(),
                'is_active': key.get('is_active', True)
            } for key in keys]
        })
        response.headers.add('Access-Control-Allow-Origin', 'http://localhost:3000')
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        return response

    @jwt_required()
    def post(self):
        """Generate a new API key"""
        current_user_id = get_jwt_identity()
        data = request.get_json()
        db = get_db()
        
        # Generate API key
        api_key = ''.join(secrets.choice(string.ascii_letters + string.digits) for _ in range(40))
        
        # Store API key
        key_data = {
            'user_id': ObjectId(current_user_id),
            'name': data['name'],
            'key': api_key,
            'created_at': datetime.utcnow(),
            'expires_at': datetime.utcnow() + timedelta(days=int(data['expiration'])) if data['expiration'] != 'never' else None,
            'is_active': True
        }
        
        result = db.api_keys.insert_one(key_data)
        
        response = make_response({
            'message': 'API key generated successfully',
            'key': api_key
        })
        response.headers.add('Access-Control-Allow-Origin', 'http://localhost:3000')
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        return response

@auth_ns.route('/settings/retention')
class RetentionSettings(Resource):
    @jwt_required()
    def get(self):
        """Get data retention settings"""
        current_user_id = get_jwt_identity()
        db = get_db()
        
        settings = db.retention_settings.find_one({'user_id': ObjectId(current_user_id)})
        if not settings:
            settings = {
                'dataRetentionPeriod': '365',
                'archiveData': True,
                'automaticCleanup': True
            }
        
        response = make_response(settings)
        response.headers.add('Access-Control-Allow-Origin', 'http://localhost:3000')
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        return response

    @jwt_required()
    def put(self):
        """Update data retention settings"""
        current_user_id = get_jwt_identity()
        data = request.get_json()
        db = get_db()
        
        db.retention_settings.update_one(
            {'user_id': ObjectId(current_user_id)},
            {'$set': {
                'dataRetentionPeriod': data['dataRetentionPeriod'],
                'archiveData': data['archiveData'],
                'automaticCleanup': data['automaticCleanup'],
                'updated_at': datetime.utcnow()
            }},
            upsert=True
        )
        
        response = make_response({'message': 'Settings updated successfully'})
        response.headers.add('Access-Control-Allow-Origin', 'http://localhost:3000')
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        return response

@auth_ns.route('/settings/notifications')
class NotificationSettings(Resource):
    @jwt_required()
    def get(self):
        """Get notification settings"""
        current_user_id = get_jwt_identity()
        db = get_db()
        
        settings = db.notification_settings.find_one({'user_id': ObjectId(current_user_id)})
        if not settings:
            settings = {
                'emailNotifications': True,
                'dailyReports': True,
                'alertThreshold': '80',
                'alertRecipients': ''
            }
        
        response = make_response(settings)
        response.headers.add('Access-Control-Allow-Origin', 'http://localhost:3000')
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        return response

    @jwt_required()
    def put(self):
        """Update notification settings"""
        current_user_id = get_jwt_identity()
        data = request.get_json()
        db = get_db()
        
        db.notification_settings.update_one(
            {'user_id': ObjectId(current_user_id)},
            {'$set': {
                'emailNotifications': data['emailNotifications'],
                'dailyReports': data['dailyReports'],
                'alertThreshold': data['alertThreshold'],
                'alertRecipients': data['alertRecipients'],
                'updated_at': datetime.utcnow()
            }},
            upsert=True
        )
        
        response = make_response({'message': 'Settings updated successfully'})
        response.headers.add('Access-Control-Allow-Origin', 'http://localhost:3000')
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        return response

@auth_ns.route('/audit-log')
class AuditLog(Resource):
    @jwt_required()
    def get(self):
        """Get audit log entries"""
        current_user_id = get_jwt_identity()
        db = get_db()
        
        user = db.users.find_one({'_id': ObjectId(current_user_id)})
        if not user:
            return {'message': 'User not found'}, 404
            
        # Get audit log entries for the organization
        filter_type = request.args.get('type', 'all')
        query = {'organization': user['organization']}
        
        if filter_type != 'all':
            query['action_type'] = filter_type
            
        entries = list(db.audit_log.find(query).sort('timestamp', -1).limit(100))
        
        response = make_response({
            'entries': [{
                'id': str(entry['_id']),
                'action': entry['action'],
                'performed_by': entry['performed_by'],
                'timestamp': entry['timestamp'].isoformat(),
                'details': entry['details']
            } for entry in entries]
        })
        response.headers.add('Access-Control-Allow-Origin', 'http://localhost:3000')
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        return response

    @jwt_required()
    def post(self):
        """Create an audit log entry"""
        current_user_id = get_jwt_identity()
        data = request.get_json()
        db = get_db()
        
        user = db.users.find_one({'_id': ObjectId(current_user_id)})
        if not user:
            return {'message': 'User not found'}, 404
            
        entry = {
            'action': data['action'],
            'action_type': data.get('action_type', 'other'),
            'performed_by': user['name'],
            'user_id': ObjectId(current_user_id),
            'organization': user['organization'],
            'timestamp': datetime.utcnow(),
            'details': data.get('details', '')
        }
        
        db.audit_log.insert_one(entry)
        
        response = make_response({'message': 'Audit log entry created'})
        response.headers.add('Access-Control-Allow-Origin', 'http://localhost:3000')
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        return response

@auth_ns.route('/team-members/template')
class TeamMemberTemplate(Resource):
    @jwt_required()
    def options(self):
        """Handle preflight request for GET method"""
        response = make_response()
        response.headers.add('Access-Control-Allow-Origin', 'http://localhost:3000')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
        response.headers.add('Access-Control-Allow-Methods', 'GET')
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        return response

    @jwt_required()
    def get(self):
        """Download Excel template for user upload"""
        try:
            # Create template DataFrame with example data
            template_df = pd.DataFrame([
                {
                    'email': 'example@hospital.com',
                    'name': 'John Doe',
                    'role': 'user',
                    'organization': 'Optional - Will use your organization if not specified',
                    'department': 'Cardiology',
                    'phone': '+1234567890',
                    'position': 'Doctor',
                    'password': 'Welcome123!'  # Standard initial password
                }
            ])
            
            # Create Excel file in memory
            output = io.BytesIO()
            with pd.ExcelWriter(output, engine='xlsxwriter') as writer:
                template_df.to_excel(writer, sheet_name='Template', index=False)
                
                # Get workbook and worksheet objects
                workbook = writer.book
                worksheet = writer.sheets['Template']
                
                # Add dropdown for role
                roles_list = ['user', 'admin', 'viewer']
                worksheet.data_validation('C2:C1048576', {
                    'validate': 'list',
                    'source': roles_list
                })
                
                # Format headers
                header_format = workbook.add_format({
                    'bold': True,
                    'bg_color': '#4B0082',
                    'font_color': 'white'
                })
                for col_num, value in enumerate(template_df.columns.values):
                    worksheet.write(0, col_num, value, header_format)
                
                # Adjust column widths
                for i, col in enumerate(template_df.columns):
                    worksheet.set_column(i, i, 20)
                
                # Add instructions sheet
                instructions_df = pd.DataFrame([
                    ['email', 'Required. Must be a valid email address'],
                    ['name', 'Required. Full name of the user'],
                    ['role', 'Required. Must be one of: user, admin, viewer'],
                    ['organization', 'Optional. Will use your organization if not specified'],
                    ['department', 'Optional. User\'s department'],
                    ['phone', 'Optional. User\'s contact number'],
                    ['position', 'Optional. User\'s job position'],
                    ['password', 'Optional. Will use "Welcome123!" if not specified']
                ], columns=['Field', 'Description'])
                
                instructions_df.to_excel(writer, sheet_name='Instructions', index=False)
                instructions_sheet = writer.sheets['Instructions']
                
                # Format instructions
                for i, col in enumerate(instructions_df.columns):
                    instructions_sheet.set_column(i, i, 25 if i == 0 else 50)
                
                # Add note about password
                instructions_sheet.write(10, 0, 'Note:', workbook.add_format({'bold': True}))
                instructions_sheet.write(10, 1, 'The default password for all users is "Welcome123!" if not specified. Users should change their password upon first login.')
            
            output.seek(0)
            response = make_response(send_file(
                output,
                mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                as_attachment=True,
                download_name='user_upload_template.xlsx'
            ))
            response.headers.add('Access-Control-Allow-Origin', 'http://localhost:3000')
            response.headers.add('Access-Control-Allow-Credentials', 'true')
            return response
            
        except Exception as e:
            print(f"Error generating template: {str(e)}")
            return {'message': 'Failed to generate template'}, 500

@auth_ns.route('/team-members/upload')
class TeamMemberUpload(Resource):
    @jwt_required()
    def post(self):
        """Upload and process users from Excel file"""
        try:
            if 'file' not in request.files:
                return {'message': 'No file provided'}, 400
            
            file = request.files['file']
            if not file.filename.endswith(('.xlsx', '.xls')):
                return {'message': 'Invalid file format. Please use Excel (.xlsx, .xls)'}, 400
            
            # Read Excel file
            df = pd.read_excel(file)
            required_columns = ['email', 'name', 'role']
            if not all(col in df.columns for col in required_columns):
                return {'message': 'Missing required columns: email, name, role'}, 400
            
            # Get current user's organization
            current_user_id = get_jwt_identity()
            db = get_db()
            current_user = db.users.find_one({'_id': ObjectId(current_user_id)})
            if not current_user:
                return {'message': 'Current user not found'}, 404
                
            default_org = current_user['organization']
            default_password = 'Welcome123!'  # Standard initial password
            
            # Process users
            processed = 0
            errors = []
            
            for _, row in df.iterrows():
                try:
                    # Validate email
                    email = row['email'].strip()
                    if not re.match(r"[^@]+@[^@]+\.[^@]+", email):
                        errors.append(f"Invalid email format: {email}")
                        continue
                    
                    # Check if user already exists
                    if db.users.find_one({'email': email}):
                        errors.append(f"User already exists: {email}")
                        continue
                    
                    # Get password (use default if not specified or empty)
                    password = row.get('password', '').strip() or default_password
                    
                    # Create user with all available fields
                    user_data = {
                        'email': email,
                        'name': row['name'].strip(),
                        'password': generate_password_hash(password),
                        'role': row['role'].strip().lower(),
                        'organization': row.get('organization', default_org).strip(),
                        'department': row.get('department', '').strip(),
                        'phone': row.get('phone', '').strip(),
                        'position': row.get('position', '').strip(),
                        'created_at': datetime.utcnow(),
                        'updated_at': datetime.utcnow(),
                        'created_by': ObjectId(current_user_id),
                        'must_change_password': True,  # Force password change on first login
                        'status': 'active'
                    }
                    
                    # Validate role
                    if user_data['role'] not in ['user', 'admin', 'viewer']:
                        errors.append(f"Invalid role for {email}: {user_data['role']}")
                        continue
                    
                    result = db.users.insert_one(user_data)
                    processed += 1
                    
                    # Log the action
                    db.audit_log.insert_one({
                        'action': 'user_created',
                        'performed_by': ObjectId(current_user_id),
                        'affected_user': result.inserted_id,
                        'timestamp': datetime.utcnow(),
                        'details': f"User {email} created via bulk upload"
                    })
                    
                except Exception as e:
                    errors.append(f"Error processing {row.get('email', 'unknown')}: {str(e)}")
            
            return {
                'message': 'File processed successfully',
                'processed': processed,
                'errors': errors,
                'default_password': default_password if processed > 0 else None
            }, 201
            
        except Exception as e:
            print(f"Error processing file: {str(e)}")
            return {'message': f'Error processing file: {str(e)}'}, 500 