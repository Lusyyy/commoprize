import os
from datetime import timedelta

class Config:
    SECRET_KEY = 'your-secret-key-change-in-production'
    SQLALCHEMY_DATABASE_URI = 'mysql+pymysql://root:@localhost/harga_komoditas'
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    JWT_SECRET_KEY = 'jwt-secret-key-change-in-production'
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=1)
    UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'uploads')
    ALLOWED_EXTENSIONS = {'csv'}