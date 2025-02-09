from app import create_app
from models.db import get_db

app = create_app()

with app.app_context():
    db = get_db()
    api_key = db.api_keys.find_one({"key": "T3O8a2W3HhhlnnYb8AAadBIE47HN6b7imH2DzrkS"})
    print("API Key found:", api_key)
