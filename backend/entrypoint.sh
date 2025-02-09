#!/bin/sh
python init_db.py
gunicorn --bind 0.0.0.0:5000 --workers 4 "app:create_app()" 