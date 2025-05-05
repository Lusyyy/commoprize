from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from models import User, db

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    
    if not data or not data.get('username') or not data.get('password'):
        return jsonify({'status': 'error', 'message': 'Username dan password diperlukan'}), 400
    
    user = User.query.filter_by(username=data['username']).first()
    
    if not user or not user.check_password(data['password']):
        return jsonify({'status': 'error', 'message': 'Username atau password salah'}), 401
    
    # Gunakan ID user sebagai identity (bukan username)
    access_token = create_access_token(identity=user.id)
    
    return jsonify({
        'status': 'success',
        'token': access_token,  # Gunakan 'token' untuk konsistensi dengan frontend
        'user': user.to_dict()
    })

@auth_bp.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    
    if not data or not data.get('username') or not data.get('password'):
        return jsonify({'status': 'error', 'message': 'Username dan password diperlukan'}), 400
    
    if User.query.filter_by(username=data['username']).first():
        return jsonify({'status': 'error', 'message': 'Username sudah digunakan'}), 400
    
    user = User(username=data['username'], is_admin=data.get('is_admin', False))
    user.set_password(data['password'])
    
    db.session.add(user)
    db.session.commit()
    
    return jsonify({'status': 'success', 'message': 'User berhasil dibuat'})

@auth_bp.route('/me', methods=['GET'])
@jwt_required()
def get_user():
    user_id = get_jwt_identity()  # Mendapatkan ID user dari token
    user = User.query.get(user_id)
    
    if not user:
        return jsonify({'status': 'error', 'message': 'User tidak ditemukan'}), 404
    
    return jsonify({'status': 'success', 'user': user.to_dict()})

@auth_bp.route('/verify', methods=['GET'])
@jwt_required()
def verify_token():
    """
    Endpoint untuk verifikasi token JWT
    """
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    if not user:
        return jsonify({"status": "error", "message": "User tidak ditemukan"}), 404
    
    return jsonify({
        "status": "success",
        "message": "Token valid",
        "user": user.to_dict()
    })