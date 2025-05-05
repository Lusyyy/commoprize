from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash

db = SQLAlchemy()

class User(db.Model):
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    is_admin = db.Column(db.Boolean, default=False)
    
    def set_password(self, password):
        self.password_hash = generate_password_hash(password)
        
    def check_password(self, password):
        return check_password_hash(self.password_hash, password)
    
    def to_dict(self):
        return {
            'id': self.id,
            'username': self.username,
            'is_admin': self.is_admin
        }

class DatasetUpload(db.Model):
    __tablename__ = 'dataset_uploads'
    
    id = db.Column(db.Integer, primary_key=True)
    filename = db.Column(db.String(255), nullable=False)
    uploaded_by = db.Column(db.Integer, db.ForeignKey('users.id'))
    upload_date = db.Column(db.DateTime, default=db.func.current_timestamp())
    commodity_name = db.Column(db.String(100), nullable=False)
    status = db.Column(db.String(50), default='pending')  # pending, processing, completed, error
    
    def to_dict(self):
        return {
            'id': self.id,
            'filename': self.filename,
            'upload_date': self.upload_date.strftime('%Y-%m-%d %H:%M:%S'),
            'commodity_name': self.commodity_name,
            'status': self.status
        }