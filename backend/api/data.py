from flask_restx import Namespace, Resource, fields
from flask import request, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from werkzeug.utils import secure_filename
from kafka import KafkaProducer
import pandas as pd
import json
import os
from datetime import datetime
from models.db import get_db
from bson import ObjectId
from functools import wraps

data_ns = Namespace('data', description='Data ingestion operations')

def api_key_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get('Authorization')
        if not auth_header:
            return {'message': 'No API key provided'}, 401
            
        try:
            # Extract API key from Authorization header
            if not auth_header.startswith('Bearer '):
                return {'message': 'Invalid authorization format'}, 401
                
            api_key = auth_header.split(' ')[1]
            db = get_db()
            
            # Find active API key
            key_data = db.api_keys.find_one({
                'key': api_key,
                'is_active': True
            })
            
            if not key_data:
                return {'message': 'Invalid or inactive API key'}, 401
                
            # Update last used timestamp
            db.api_keys.update_one(
                {'_id': key_data['_id']},
                {'$set': {'last_used': datetime.utcnow()}}
            )
            
            # Get user information for audit log
            user = db.users.find_one({'_id': key_data['user_id']})
            if not user:
                return {'message': 'User not found'}, 404
            
            # Create audit log entry for API request
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
            
            # Set user_id for the request
            request.user_id = key_data['user_id']
            return f(*args, **kwargs)
            
        except Exception as e:
            return {'message': f'Authentication error: {str(e)}'}, 401
            
    return decorated

# Sample data for demonstration
SAMPLE_DATA = {
    'industry_revenue': {
        'Manufacturing': 450,
        'Healthcare': 380,
        'Technology': 520,
        'Retail': 290,
        'Finance': 400
    },
    'monthly_trends': {
        'Manufacturing': {
            'Jan': 65, 'Feb': 59, 'Mar': 80, 'Apr': 81, 'May': 56, 'Jun': 55
        },
        'Healthcare': {
            'Jan': 28, 'Feb': 48, 'Mar': 40, 'Apr': 19, 'May': 86, 'Jun': 27
        }
    },
    'size_distribution': {
        'Small': 30,
        'Medium': 45,
        'Large': 15,
        'Enterprise': 10
    },
    'employee_growth': {
        '2019': 1200,
        '2020': 1350,
        '2021': 1500,
        '2022': 1800,
        '2023': 2100
    }
}

# Kafka producer instance
producer = None

def get_kafka_producer():
    global producer
    if producer is None:
        try:
            producer = KafkaProducer(
                bootstrap_servers=current_app.config['KAFKA_BOOTSTRAP_SERVERS'],
                value_serializer=lambda v: json.dumps(v).encode('utf-8'),
                api_version=(0, 10),
                request_timeout_ms=5000,  # 5 second timeout
                max_block_ms=5000,  # 5 second max block
                acks='all',
                retries=1,
                retry_backoff_ms=500
            )
        except Exception as e:
            print(f"Warning: Failed to create Kafka producer: {str(e)}")
            producer = None
    return producer

def close_kafka_producer():
    global producer
    if producer is not None:
        try:
            producer.close(timeout=5)  # 5 second timeout
            producer = None
        except Exception as e:
            print(f"Error closing Kafka producer: {str(e)}")
            producer = None

def get_upload_dir():
    """Get the configured upload directory, creating it if it doesn't exist."""
    upload_dir = current_app.config.get('UPLOAD_DIR', os.path.join(os.path.dirname(os.path.dirname(__file__)), 'uploads'))
    os.makedirs(upload_dir, exist_ok=True)
    return upload_dir

# Models for request/response
file_upload_model = data_ns.model('FileUpload', {
    'data_source': fields.String(required=True, description='Name of the data source'),
    'description': fields.String(required=False, description='Description of the data')
})

stream_data_model = data_ns.model('StreamData', {
    'data_source': fields.String(required=True, description='Name of the data source'),
    'data': fields.Raw(required=True, description='JSON data to stream')
})

@data_ns.route('/upload')
class FileUpload(Resource):
    @api_key_required
    @data_ns.expect(file_upload_model)
    def post(self):
        """Upload and process a CSV file"""
        temp_path = None
        try:
            current_user_id = request.user_id
            db = get_db()
            
            if 'file' not in request.files:
                return {'message': 'No file provided'}, 400
                
            file = request.files['file']
            if file.filename == '':
                return {'message': 'No file selected'}, 400
                
            if not file.filename.endswith('.csv'):
                return {'message': 'Invalid file format. Only CSV files are allowed.'}, 400
            
            # Save file temporarily
            filename = secure_filename(file.filename)
            temp_path = os.path.join(get_upload_dir(), f"{datetime.utcnow().timestamp()}_{filename}")
            file.save(temp_path)
            
            try:
                # Read CSV file
                df = pd.read_csv(temp_path)
                
                # Convert DataFrame to JSON
                data = json.loads(df.to_json(orient='records'))
                
                # Get metadata from request
                metadata = request.form.to_dict()
                if 'data_source' not in metadata:
                    return {'message': 'data_source is required'}, 400
                
                # Store data source information
                data_source = {
                    'name': metadata['data_source'],
                    'description': metadata.get('description', ''),
                    'type': 'file',
                    'filename': filename,
                    'user_id': ObjectId(current_user_id),
                    'created_at': datetime.utcnow(),
                    'record_count': len(data),
                    'columns': list(df.columns),
                    'numeric_columns': list(df.select_dtypes(include=['float64', 'int64']).columns)
                }
                
                result = db.data_sources.insert_one(data_source)
                
                # Store data in MongoDB
                if data:
                    db.raw_data.insert_many([{
                        'data_source_id': result.inserted_id,
                        'data_source': metadata['data_source'],
                        'timestamp': datetime.utcnow(),
                        'data': record,
                        'user_id': ObjectId(current_user_id)
                    } for record in data])
                
                # Create audit log entry for data upload
                user = db.users.find_one({'_id': ObjectId(current_user_id)})
                audit_entry = {
                    'action': 'data_uploaded',
                    'action_type': 'data',
                    'performed_by': user['name'],
                    'user_id': ObjectId(current_user_id),
                    'organization': user['organization'],
                    'timestamp': datetime.utcnow(),
                    'details': f"Uploaded file '{filename}' with {len(data)} records to data source '{metadata['data_source']}'"
                }
                db.audit_log.insert_one(audit_entry)
                
                return {
                    'message': 'File processed successfully',
                    'records_processed': len(data),
                    'data_source_id': str(result.inserted_id),
                    'columns': list(df.columns)
                }, 201
                
            except pd.errors.EmptyDataError:
                return {'message': 'The uploaded file is empty'}, 400
            except pd.errors.ParserError:
                return {'message': 'Error parsing file. Please ensure it is a valid CSV file'}, 400
            except Exception as e:
                print(f"Error processing file: {str(e)}")
                return {'message': f'Error processing file: {str(e)}'}, 500
                
        except Exception as e:
            print(f"Unexpected error in upload endpoint: {str(e)}")
            return {'message': f'Server error: {str(e)}'}, 500
            
        finally:
            # Clean up temporary file
            if temp_path and os.path.exists(temp_path):
                try:
                    os.remove(temp_path)
                except Exception as e:
                    print(f"Error removing temporary file: {str(e)}")

@data_ns.route('/stream')
class StreamData(Resource):
    @api_key_required
    @data_ns.expect(stream_data_model)
    def post(self):
        current_user_id = request.user_id
        data = request.get_json()
        db = get_db()
        
        try:
            # Validate required fields
            if not data or 'data_source' not in data or 'data' not in data:
                return {'message': 'Missing required fields: data_source and data'}, 400

            # Check if data source exists, create if it doesn't
            data_source = db.data_sources.find_one({
                'name': data['data_source'],
                'user_id': ObjectId(current_user_id)
            })
            
            if not data_source:
                # Create new data source
                data_source = {
                    'name': data['data_source'],
                    'description': 'Data source created via API',
                    'type': 'api',
                    'user_id': ObjectId(current_user_id),
                    'created_at': datetime.utcnow(),
                    'record_count': 0,
                    'columns': list(data['data'].keys()) if isinstance(data['data'], dict) else []
                }
                result = db.data_sources.insert_one(data_source)
                data_source['_id'] = result.inserted_id

            # Store data in MongoDB
            raw_data = {
                'data_source_id': data_source['_id'],
                'data_source': data['data_source'],
                'timestamp': datetime.utcnow(),
                'data': data['data'],
                'user_id': ObjectId(current_user_id)
            }
            result = db.raw_data.insert_one(raw_data)

            # Update record count
            db.data_sources.update_one(
                {'_id': data_source['_id']},
                {'$inc': {'record_count': 1}}
            )

            # Try to stream through Kafka if available
            try:
                producer = get_kafka_producer()
                if producer:
                    producer.send('data_ingestion', {
                        'data_source': data['data_source'],
                        'timestamp': datetime.utcnow().isoformat(),
                        'data': data['data']
                    })
            except Exception as kafka_error:
                print(f"Warning: Kafka streaming failed: {str(kafka_error)}")
                # Continue since data is already stored in MongoDB
            
            return {
                'message': 'Data stored successfully',
                'record_id': str(result.inserted_id),
                'data_source_id': str(data_source['_id'])
            }, 201
            
        except Exception as e:
            print(f"Error in stream endpoint: {str(e)}")
            return {'message': f'Error processing data: {str(e)}'}, 500

@data_ns.route('/sources')
class DataSources(Resource):
    @jwt_required()
    def get(self):
        """Get all data sources for the current user"""
        db = get_db()
        sources = list(db.data_sources.find({'user_id': ObjectId(get_jwt_identity())}))
        
        return [{
            'id': str(source['_id']),
            'name': source['name'],
            'description': source.get('description', ''),
            'type': source['type'],
            'created_at': source['created_at'].isoformat(),
            'record_count': source.get('record_count', 0),
            'columns': source.get('columns', [])
        } for source in sources]

@data_ns.route('/source/<source_id>/data')
class SourceData(Resource):
    @api_key_required
    def get(self, source_id):
        """Get data for a specific source"""
        try:
            db = get_db()
            current_user_id = request.user_id
            
            # Verify the source exists and belongs to the user
            source = db.data_sources.find_one({
                '_id': ObjectId(source_id),
                'user_id': ObjectId(current_user_id)
            })
            
            if not source:
                return {'message': 'Data source not found'}, 404
            
            # Fetch the raw data
            data = list(db.raw_data.find({
                'data_source_id': ObjectId(source_id),
                'user_id': ObjectId(current_user_id)
            }))
            
            # Transform the data for response
            return [{
                'id': str(record['_id']),
                'data_source_id': str(record['data_source_id']),
                'data_source': record['data_source'],
                'timestamp': record['timestamp'].isoformat(),
                'data': record['data']
            } for record in data], 200
            
        except Exception as e:
            print(f"Error fetching source data: {str(e)}")
            return {'message': f'Error fetching data: {str(e)}'}, 500

@data_ns.route('/sample-data')
class SampleData(Resource):
    @jwt_required()
    def post(self):
        """Initialize sample data in the database"""
        try:
            db = get_db()
            current_user_id = get_jwt_identity()
            
            # Create sample data sources and their data
            sample_sources = [
                {
                    'name': 'Industry Revenue',
                    'description': 'Annual revenue by industry sector',
                    'type': 'sample',
                    'user_id': ObjectId(current_user_id),
                    'created_at': datetime.utcnow(),
                    'record_count': len(SAMPLE_DATA['industry_revenue']),
                    'columns': ['industry', 'revenue']
                },
                {
                    'name': 'Monthly Trends',
                    'description': 'Monthly performance trends by industry',
                    'type': 'sample',
                    'user_id': ObjectId(current_user_id),
                    'created_at': datetime.utcnow(),
                    'record_count': len(SAMPLE_DATA['monthly_trends']) * 6,
                    'columns': ['industry', 'month', 'value']
                },
                {
                    'name': 'Company Size Distribution',
                    'description': 'Distribution of companies by size',
                    'type': 'sample',
                    'user_id': ObjectId(current_user_id),
                    'created_at': datetime.utcnow(),
                    'record_count': len(SAMPLE_DATA['size_distribution']),
                    'columns': ['size', 'count']
                },
                {
                    'name': 'Employee Growth',
                    'description': 'Employee growth trend over years',
                    'type': 'sample',
                    'user_id': ObjectId(current_user_id),
                    'created_at': datetime.utcnow(),
                    'record_count': len(SAMPLE_DATA['employee_growth']),
                    'columns': ['year', 'employees']
                }
            ]
            
            # Insert sample sources
            source_ids = {}
            for source in sample_sources:
                result = db.data_sources.insert_one(source)
                source_ids[source['name']] = result.inserted_id
            
            # Insert sample data
            # Industry Revenue
            db.raw_data.insert_many([{
                'data_source_id': source_ids['Industry Revenue'],
                'data_source': 'Industry Revenue',
                'timestamp': datetime.utcnow(),
                'data': {'industry': industry, 'revenue': revenue},
                'user_id': ObjectId(current_user_id)
            } for industry, revenue in SAMPLE_DATA['industry_revenue'].items()])
            
            # Monthly Trends
            monthly_data = []
            for industry, months in SAMPLE_DATA['monthly_trends'].items():
                for month, value in months.items():
                    monthly_data.append({
                        'data_source_id': source_ids['Monthly Trends'],
                        'data_source': 'Monthly Trends',
                        'timestamp': datetime.utcnow(),
                        'data': {'industry': industry, 'month': month, 'value': value},
                        'user_id': ObjectId(current_user_id)
                    })
            db.raw_data.insert_many(monthly_data)
            
            # Size Distribution
            db.raw_data.insert_many([{
                'data_source_id': source_ids['Company Size Distribution'],
                'data_source': 'Company Size Distribution',
                'timestamp': datetime.utcnow(),
                'data': {'size': size, 'count': count},
                'user_id': ObjectId(current_user_id)
            } for size, count in SAMPLE_DATA['size_distribution'].items()])
            
            # Employee Growth
            db.raw_data.insert_many([{
                'data_source_id': source_ids['Employee Growth'],
                'data_source': 'Employee Growth',
                'timestamp': datetime.utcnow(),
                'data': {'year': year, 'employees': count},
                'user_id': ObjectId(current_user_id)
            } for year, count in SAMPLE_DATA['employee_growth'].items()])
            
            return {
                'message': 'Sample data initialized successfully',
                'data_sources': [str(id) for id in source_ids.values()]
            }, 201
            
        except Exception as e:
            print(f"Error initializing sample data: {str(e)}")
            return {'message': f'Error initializing sample data: {str(e)}'}, 500

@data_ns.route('/source/<source_id>')
class Source(Resource):
    @jwt_required()
    def delete(self, source_id):
        """Delete a specific data source and its associated data"""
        try:
            db = get_db()
            current_user_id = get_jwt_identity()
            
            # Verify the source exists and belongs to the user
            source = db.data_sources.find_one({
                '_id': ObjectId(source_id),
                'user_id': ObjectId(current_user_id)
            })
            
            if not source:
                return {'message': 'Data source not found'}, 404
            
            # Delete the data source
            db.data_sources.delete_one({
                '_id': ObjectId(source_id),
                'user_id': ObjectId(current_user_id)
            })
            
            # Delete all associated raw data
            db.raw_data.delete_many({
                'data_source_id': ObjectId(source_id),
                'user_id': ObjectId(current_user_id)
            })
            
            return {'message': 'Data source deleted successfully'}, 200
            
        except Exception as e:
            print(f"Error deleting source: {str(e)}")
            return {'message': f'Error deleting source: {str(e)}'}, 500 