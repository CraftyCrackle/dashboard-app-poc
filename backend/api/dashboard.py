from flask_restx import Namespace, Resource, fields
from flask import request, make_response, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from models.db import get_db, db
from bson import ObjectId
from datetime import datetime
import json

dashboard_ns = Namespace('dashboard', description='Dashboard operations')

# Models for request/response
chart_model = dashboard_ns.model('Chart', {
    'type': fields.String(required=True, description='Chart type (line, bar, pie, etc.)'),
    'title': fields.String(required=True, description='Chart title'),
    'data_source': fields.String(required=True, description='Data source name'),
    'config': fields.Raw(required=True, description='Chart configuration')
})

dashboard_model = dashboard_ns.model('Dashboard', {
    'name': fields.String(required=True, description='Dashboard name'),
    'description': fields.String(required=False, description='Dashboard description'),
    'charts': fields.List(fields.Nested(chart_model), required=True, description='List of charts')
})

@dashboard_ns.route('')
class Dashboards(Resource):
    @jwt_required()
    def get(self):
        """Get all dashboards for the current user's organization"""
        try:
            print("GET /dashboard - Fetching dashboards")
            db = get_db()
            current_user_id = get_jwt_identity()
            print(f"Current user ID: {current_user_id}")
            
            user = db.users.find_one({'_id': ObjectId(current_user_id)})
            if not user:
                print("User not found")
                return {'message': 'User not found'}, 404
                
            print(f"Fetching dashboards for organization: {user['organization']}")
            dashboards = list(db.dashboards.find({
                'organization': user['organization']
            }))
            
            print(f"Found {len(dashboards)} dashboards")
            result = [{
                'id': str(dashboard['_id']),
                'name': dashboard['name'],
                'description': dashboard.get('description', ''),
                'created_at': dashboard['created_at'].isoformat(),
                'updated_at': dashboard['updated_at'].isoformat(),
                'charts': dashboard.get('charts', []),
                'charts_count': len(dashboard.get('charts', []))
            } for dashboard in dashboards]
            
            print("Returning dashboards:", result)
            return result
        except Exception as e:
            print(f"Error in GET /dashboard: {str(e)}")
            return {'message': f'Error fetching dashboards: {str(e)}'}, 500
    
    @jwt_required()
    @dashboard_ns.expect(dashboard_model)
    def post(self):
        """Create a new dashboard"""
        current_user_id = get_jwt_identity()
        db = get_db()
        data = request.get_json()
        
        user = db.users.find_one({'_id': ObjectId(current_user_id)})
        
        dashboard = {
            'name': data['name'],
            'description': data.get('description', ''),
            'organization': user['organization'],
            'created_by': ObjectId(current_user_id),
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow(),
            'charts': data['charts']
        }
        
        result = db.dashboards.insert_one(dashboard)
        
        # Create audit log entry for dashboard and chart creation
        audit_entry = {
            'action': 'dashboard_created',
            'action_type': 'dashboard',
            'performed_by': user['name'],
            'user_id': ObjectId(current_user_id),
            'organization': user['organization'],
            'timestamp': datetime.utcnow(),
            'details': f"Created dashboard '{data['name']}' with {len(data['charts'])} charts"
        }
        db.audit_log.insert_one(audit_entry)
        
        # Create individual audit entries for each chart
        for chart in data['charts']:
            chart_audit = {
                'action': 'chart_created',
                'action_type': 'chart',
                'performed_by': user['name'],
                'user_id': ObjectId(current_user_id),
                'organization': user['organization'],
                'timestamp': datetime.utcnow(),
                'details': f"Created chart '{chart['title']}' of type {chart['type']} using data source {chart['data_source']}"
            }
            db.audit_log.insert_one(chart_audit)
        
        return {
            'message': 'Dashboard created successfully',
            'dashboard_id': str(result.inserted_id)
        }, 201

@dashboard_ns.route('/<dashboard_id>')
class Dashboard(Resource):
    @jwt_required()
    def get(self, dashboard_id):
        """Get a specific dashboard"""
        db = get_db()
        user = db.users.find_one({'_id': ObjectId(get_jwt_identity())})
        
        dashboard = db.dashboards.find_one({
            '_id': ObjectId(dashboard_id),
            'organization': user['organization']
        })
        
        if not dashboard:
            return {'message': 'Dashboard not found'}, 404
        
        return {
            'id': str(dashboard['_id']),
            'name': dashboard['name'],
            'description': dashboard.get('description', ''),
            'created_at': dashboard['created_at'].isoformat(),
            'updated_at': dashboard['updated_at'].isoformat(),
            'charts': dashboard['charts']
        }
    
    @jwt_required()
    @dashboard_ns.expect(dashboard_model)
    def put(self, dashboard_id):
        """Update a dashboard"""
        current_user_id = get_jwt_identity()
        db = get_db()
        data = request.get_json()
        
        user = db.users.find_one({'_id': ObjectId(current_user_id)})
        
        dashboard = db.dashboards.find_one({
            '_id': ObjectId(dashboard_id),
            'organization': user['organization']
        })
        
        if not dashboard:
            return {'message': 'Dashboard not found'}, 404
        
        updates = {
            'name': data['name'],
            'description': data.get('description', ''),
            'charts': data['charts'],
            'updated_at': datetime.utcnow()
        }
        
        db.dashboards.update_one(
            {'_id': ObjectId(dashboard_id)},
            {'$set': updates}
        )
        
        return {'message': 'Dashboard updated successfully'}
    
    @jwt_required()
    def delete(self, dashboard_id):
        """Delete a dashboard"""
        db = get_db()
        user = db.users.find_one({'_id': ObjectId(get_jwt_identity())})
        
        result = db.dashboards.delete_one({
            '_id': ObjectId(dashboard_id),
            'organization': user['organization']
        })
        
        if result.deleted_count == 0:
            return {'message': 'Dashboard not found'}, 404
            
        return {'message': 'Dashboard deleted successfully'}

@dashboard_ns.route('/<dashboard_id>/data')
class DashboardData(Resource):
    @jwt_required()
    def get(self, dashboard_id):
        """Get data for all charts in a dashboard"""
        try:
            print(f"GET /dashboard/{dashboard_id}/data - Fetching chart data")
            db = get_db()
            current_user_id = get_jwt_identity()
            print(f"Current user ID: {current_user_id}")
            
            user = db.users.find_one({'_id': ObjectId(current_user_id)})
            if not user:
                print("User not found")
                return {'message': 'User not found'}, 404
            
            print(f"Fetching dashboard for organization: {user['organization']}")
            dashboard = db.dashboards.find_one({
                '_id': ObjectId(dashboard_id),
                'organization': user['organization']
            })
            
            if not dashboard:
                print("Dashboard not found")
                return {'message': 'Dashboard not found'}, 404
            
            print(f"Found dashboard with {len(dashboard.get('charts', []))} charts")
            charts_data = {}
            for chart in dashboard.get('charts', []):
                print(f"Processing chart: {chart.get('title')}")
                # Query data based on chart configuration
                pipeline = self._build_aggregation_pipeline(chart)
                print(f"Aggregation pipeline: {pipeline}")
                data = list(db.raw_data.aggregate(pipeline))
                print(f"Raw data count: {len(data)}")
                
                # Transform data for chart visualization
                transformed_data = self._transform_data_for_chart(chart, data)
                print(f"Transformed data: {transformed_data}")
                
                charts_data[chart['title']] = {
                    'type': chart['type'],
                    'data': transformed_data
                }
            
            print("Returning charts data")
            return charts_data
        except Exception as e:
            print(f"Error in GET /dashboard/{dashboard_id}/data: {str(e)}")
            return {'message': f'Error fetching dashboard data: {str(e)}'}, 500
    
    def _build_aggregation_pipeline(self, chart):
        """Build MongoDB aggregation pipeline based on chart configuration"""
        pipeline = []
        
        # Add initial match stage
        match_stage = {'$match': {'data_source': chart['data_source']}}
        pipeline.append(match_stage)
        
        # Apply early limit to reduce memory usage
        pipeline.append({'$limit': 1000})  # Hard limit to prevent memory issues
        
        if 'config' in chart:
            config = chart['config']
            
            # Project only needed fields to reduce memory usage
            project_stage = {
                '$project': {
                    'data': 1
                }
            }
            pipeline.append(project_stage)
            
            # Group by specified field and calculate aggregates
            if 'group_by' in config and 'measure' in config:
                group_stage = {
                    '$group': {
                        '_id': f"$data.{config['group_by']}"
                    }
                }
                
                # Add aggregation based on specified type
                agg_type = config.get('aggregate', 'none')
                measure_field = f"$data.{config['measure']}"
                
                if agg_type == 'sum':
                    group_stage['$group']['value'] = {'$sum': measure_field}
                elif agg_type == 'avg':
                    group_stage['$group']['value'] = {'$avg': measure_field}
                elif agg_type == 'count':
                    group_stage['$group']['value'] = {'$sum': 1}
                elif agg_type == 'min':
                    group_stage['$group']['value'] = {'$min': measure_field}
                elif agg_type == 'max':
                    group_stage['$group']['value'] = {'$max': measure_field}
                else:  # 'none' or any other value
                    # For no aggregation, just use the first value in each group
                    group_stage['$group']['value'] = {'$first': measure_field}
                
                pipeline.append(group_stage)
                
                # Add sort after group
                sort_stage = {'$sort': {'value': -1}}  # Sort by value descending
                pipeline.append(sort_stage)
                
                # Limit grouped results
                pipeline.append({'$limit': 20})  # Show top 20 results
            else:
                # If no grouping specified, return raw data with limits
                pipeline.append({'$limit': 100})
        
        print(f"Generated pipeline for chart {chart.get('title')}: {pipeline}")
        return pipeline
    
    def _transform_data_for_chart(self, chart, data):
        """Transform aggregated data into chart-friendly format"""
        try:
            if not data or not isinstance(data, list):
                return {
                    'labels': [],
                    'datasets': [{
                        'label': chart.get('title', 'Untitled'),
                        'data': []
                    }]
                }
            
            # Handle raw data format (not aggregated)
            if data and isinstance(data[0], dict) and 'data' in data[0]:
                # Extract data from the 'data' field
                data = [item.get('data', {}) for item in data if isinstance(item, dict)]
                
                # Get the specified fields from config
                config = chart.get('config', {})
                x_field = config.get('group_by', '')
                y_field = config.get('measure', '')
                
                if not x_field or not y_field:
                    return {
                        'labels': [],
                        'datasets': [{
                            'label': chart.get('title', 'Untitled'),
                            'data': []
                        }]
                    }
                
                # Group and aggregate the data
                grouped_data = {}
                for item in data:
                    if not isinstance(item, dict):
                        continue
                    key = str(item.get(x_field, ''))
                    try:
                        value = float(item.get(y_field, 0))
                    except (TypeError, ValueError):
                        value = 0
                    if key in grouped_data:
                        grouped_data[key] += value
                    else:
                        grouped_data[key] = value
                
                # Sort by value and limit to top 20
                sorted_data = sorted(grouped_data.items(), key=lambda x: x[1], reverse=True)[:20]
                labels = [item[0] for item in sorted_data]
                values = [item[1] for item in sorted_data]
            else:
                # Handle pre-aggregated data
                labels = []
                values = []
                for item in data:
                    if not isinstance(item, dict):
                        continue
                    labels.append(str(item.get('_id', '')))
                    try:
                        value = float(item.get('value', 0))
                    except (TypeError, ValueError):
                        value = 0
                    values.append(value)
            
            # Get chart type-specific colors
            colors = self._get_chart_colors(len(labels))
            
            # Create chart data structure
            chart_data = {
                'labels': labels,
                'datasets': [{
                    'label': chart.get('title', 'Untitled'),
                    'data': values,
                    'backgroundColor': colors['background'],
                    'borderColor': colors['border'] if chart.get('type') != 'pie' else colors['background'],
                    'borderWidth': 1
                }]
            }
            
            return chart_data
        except Exception as e:
            print(f"Error transforming data for chart: {str(e)}")
            # Return empty chart data on error
            return {
                'labels': [],
                'datasets': [{
                    'label': chart.get('title', 'Untitled'),
                    'data': []
                }]
            }
    
    def _get_chart_colors(self, count):
        """Generate chart colors based on the number of data points"""
        base_colors = [
            {'r': 255, 'g': 99, 'b': 132},
            {'r': 54, 'g': 162, 'b': 235},
            {'r': 255, 'g': 206, 'b': 86},
            {'r': 75, 'g': 192, 'b': 192},
            {'r': 153, 'g': 102, 'b': 255}
        ]
        
        colors = {
            'background': [],
            'border': []
        }
        
        for i in range(count):
            color = base_colors[i % len(base_colors)]
            colors['background'].append(f"rgba({color['r']}, {color['g']}, {color['b']}, 0.5)")
            colors['border'].append(f"rgba({color['r']}, {color['g']}, {color['b']}, 1)")
        
        return colors 

@dashboard_ns.route('/<dashboard_id>/chart/<chart_title>')
class DashboardChart(Resource):
    @jwt_required()
    def options(self, dashboard_id, chart_title):
        """Handle preflight request for DELETE method"""
        response = make_response()
        response.headers.add('Access-Control-Allow-Origin', 'http://localhost:3000')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
        response.headers.add('Access-Control-Allow-Methods', 'DELETE')
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        return response

    @jwt_required()
    def delete(self, dashboard_id, chart_title):
        """Delete a specific chart from a dashboard"""
        try:
            db = get_db()
            current_user_id = get_jwt_identity()
            
            user = db.users.find_one({'_id': ObjectId(current_user_id)})
            if not user:
                return {'message': 'User not found'}, 404
            
            # Find the dashboard and verify ownership
            dashboard = db.dashboards.find_one({
                '_id': ObjectId(dashboard_id),
                'organization': user['organization']
            })
            
            if not dashboard:
                return {'message': 'Dashboard not found'}, 404
            
            # Remove the chart with the specified title
            updated_charts = [chart for chart in dashboard.get('charts', []) 
                            if chart.get('title') != chart_title]
            
            # If there are no charts left, delete the entire dashboard
            if len(updated_charts) == 0:
                result = db.dashboards.delete_one({
                    '_id': ObjectId(dashboard_id),
                    'organization': user['organization']
                })
                if result.deleted_count == 0:
                    return {'message': 'Failed to delete empty dashboard'}, 500
            else:
                # Update the dashboard with the new charts list
                result = db.dashboards.update_one(
                    {'_id': ObjectId(dashboard_id)},
                    {
                        '$set': {
                            'charts': updated_charts,
                            'updated_at': datetime.utcnow()
                        }
                    }
                )
                if result.modified_count == 0:
                    return {'message': 'Chart not found'}, 404
            
            response = make_response({'message': 'Chart deleted successfully'})
            response.headers.add('Access-Control-Allow-Origin', 'http://localhost:3000')
            response.headers.add('Access-Control-Allow-Credentials', 'true')
            return response
            
        except Exception as e:
            print(f"Error deleting chart: {str(e)}")
            return {'message': f'Error deleting chart: {str(e)}'}, 500 

@dashboard_ns.route('/public/chart/<chart_id>')
class PublicChart(Resource):
    def get(self, chart_id):
        """Get a public chart by ID"""
        db = get_db()
        chart = db.public_charts.find_one({'_id': chart_id})
        
        if not chart:
            return {'message': 'Chart not found'}, 404
            
        return chart

    def options(self, chart_id):
        """Handle preflight request"""
        response = make_response()
        response.headers['Access-Control-Allow-Origin'] = '*'
        response.headers['Access-Control-Allow-Methods'] = 'GET, OPTIONS'
        response.headers['Access-Control-Allow-Headers'] = 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range'
        return response 