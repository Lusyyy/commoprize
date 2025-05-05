import os
import numpy as np
import tensorflow as tf
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from flask_jwt_extended import JWTManager, jwt_required, get_jwt_identity
import joblib
import mysql.connector
from models import db, User
from config import Config
from auth import auth_bp
from admin import admin_bp  # Impor blueprint admin yang sudah berisi semua route
from datetime import datetime, timedelta
import logging
import scraping
 

app = Flask(__name__)
app.config.from_object(Config)

# Konfigurasi JWT
app.config['JWT_SECRET_KEY'] = 'rahasia-kunci-yang-sangat-aman'  # Ganti dengan secret key yang benar
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(hours=1)

# Inisialisasi ekstensi
CORS(app)
jwt = JWTManager(app)
db.init_app(app)

# JWT error handlers
@jwt.invalid_token_loader
def invalid_token_callback(error):
    logging.error(f"Invalid JWT token: {error}")
    return jsonify({"status": "error", "message": "Invalid token"}), 401

@jwt.expired_token_loader
def expired_token_callback(jwt_header, jwt_data):
    logging.error(f"Expired JWT token: {jwt_data}")
    return jsonify({"status": "error", "message": "Token has expired"}), 401

@jwt.unauthorized_loader
def missing_token_callback(error):
    logging.error(f"Missing JWT token: {error}")
    return jsonify({"status": "error", "message": "Authorization header is missing"}), 401

# Konfigurasi logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("app.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger()

# Registrasi blueprints
app.register_blueprint(auth_bp, url_prefix='/api/auth')
app.register_blueprint(admin_bp, url_prefix='/api/admin')

# Buat direktori uploads jika belum ada
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

# Inisialisasi database saat aplikasi dimulai
with app.app_context():
    db.create_all()
    
    # Buat user admin jika belum ada
    if not User.query.filter_by(username='admin').first():
        admin = User(username='admin', is_admin=True)
        admin.set_password('admin123')
        db.session.add(admin)
        
        # Buat user biasa untuk testing
        user = User(username='user', is_admin=False)
        user.set_password('user123')
        db.session.add(user)
        
        db.session.commit()

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SCALER_DIR = os.path.join(BASE_DIR, "scalers")
MODEL_DIR = os.path.join(BASE_DIR, "models")
DATASET_DIR = os.path.join(BASE_DIR, "datasets")

for directory in [SCALER_DIR, MODEL_DIR, DATASET_DIR]:
    os.makedirs(directory, exist_ok=True)

# Fungsi koneksi database
def connect_db():
    try:
        return mysql.connector.connect(
            host="localhost", 
            user="root", 
            password="", 
            database="harga_komoditas", 
            autocommit=True
        )
    except mysql.connector.Error as err:
        print(f"❌ Gagal koneksi database: {err}")
        return None

# Load model dan scaler
def load_model(komoditas):
    # Format nama komoditas
    komoditas_formatted = komoditas.lower().replace(" ", "_").replace("-", "_")
    
    # Buat nama file yang diharapkan
    model_filename = f"{komoditas_formatted}_model.h5"
    scaler_filename = f"{komoditas_formatted}_scaler.pkl"
    
    model_path = os.path.join(MODEL_DIR, model_filename)
    scaler_path = os.path.join(SCALER_DIR, scaler_filename)
    
    logger.info(f"🔍 Mencari model di: {model_path}")
    logger.info(f"🔍 Mencari scaler di: {scaler_path}")

    if not os.path.exists(model_path) or not os.path.exists(scaler_path):
        print(f"❌ Model atau scaler untuk {komoditas} tidak ditemukan.")
        return None, None
    
    try:
        model = tf.keras.models.load_model(model_path)
        scaler = joblib.load(scaler_path)
        print("✅ Model dan scaler berhasil dimuat.")
        return model, scaler
    except Exception as e:
        print(f"❌ Gagal memuat model atau scaler: {e}")
        return None, None

# Ambil 60 harga terakhir dari database
def get_last_60_prices(komoditas):
    db = connect_db()
    if not db:
        return None
    
    try:
        with db.cursor() as cursor:
            query = """
                SELECT harga FROM harga_komoditas
                WHERE LOWER(REPLACE(REPLACE(komoditas, ' ', '_'), '-', '_')) = LOWER(%s)
                ORDER BY tanggal DESC LIMIT 60
            """
            cursor.execute(query, (komoditas.lower().replace(" ", "_").replace("-", "_"),))
            result = cursor.fetchall()

        if not result:
            print(f"⚠️ Tidak ada data harga untuk {komoditas}")
            return None

        prices = [row[0] for row in result]
        
        if len(prices) < 60:
            avg_price = np.mean(prices)
            prices.extend([avg_price] * (60 - len(prices)))

        return list(reversed(prices))
    except mysql.connector.Error as err:
        print(f"❌ Gagal mengambil data harga: {err}")
        return None
    finally:
        db.close()


@app.route("/api/predict-with-filter", methods=["POST"])
def predict_with_filter():
    try:
        data = request.get_json()
        komoditas = data.get("komoditas")
        filter_days = data.get("filter_days", 30)  # Default 30 hari
        
        # Validasi input
        if not komoditas:
            return jsonify({"status": "error", "message": "Parameter 'komoditas' dibutuhkan."}), 400
            
        if filter_days not in [3, 7, 30]:
            return jsonify({"status": "error", "message": "Filter hari harus 3, 7, atau 30."}), 400
        
        # Ambil data historis untuk visualisasi
        db = connect_db()
        if not db:
            return jsonify({"status": "error", "message": "Gagal terhubung ke database"}), 500
            
        try:
            with db.cursor(dictionary=True) as cursor:
                query = """
                    SELECT harga, tanggal FROM harga_komoditas
                    WHERE LOWER(REPLACE(REPLACE(komoditas, ' ', '_'), '-', '_')) = LOWER(%s)
                    ORDER BY tanggal DESC LIMIT 60
                """
                cursor.execute(query, (komoditas.lower().replace(" ", "_").replace("-", "_"),))
                historical_data = cursor.fetchall()
        finally:
            db.close()
            
        if not historical_data:
            return jsonify({"status": "error", "message": f"Data historis tidak ditemukan untuk komoditas '{komoditas}'"}), 404
        
        # Siapkan data untuk prediksi
        harga = get_last_60_prices(komoditas)
        if harga is None:
            return jsonify({"status": "error", "message": f"Data tidak ditemukan untuk '{komoditas}'"}), 404

        # Load model dan scaler
        model, scaler = load_model(komoditas)
        if not model or not scaler:
            return jsonify({"status": "error", "message": f"Model atau scaler untuk '{komoditas}' tidak tersedia."}), 404
        
        # Proses prediksi untuk jumlah hari yang diminta
        predictions = []
        harga_np = np.array(harga, dtype=np.float32).reshape(-1, 1)
        
        # Data yang akan digunakan untuk prediksi
        current_data = harga_np.copy()
        
        # Dapatkan tanggal terakhir dari data historis untuk mulai prediksi
        from datetime import datetime, timedelta
        if historical_data and len(historical_data) > 0:
            last_date = historical_data[0]["tanggal"]  # Historical data sudah diurutkan DESC
            
            # Log untuk debugging
            logger.info(f"Raw last_date dari DB: {last_date}, tipe: {type(last_date)}")
            
            # Pastikan last_date adalah objek datetime
            if isinstance(last_date, str):
                last_date = datetime.strptime(last_date, "%Y-%m-%d")
            
            # Periksa bulan dan koreksi jika perlu
            current_month = datetime.now().month
            if last_date.month != current_month:
                logger.info(f"Mengoreksi bulan dari {last_date.month} ke {current_month}")
                # Buat tanggal baru dengan bulan yang benar (bulan saat ini)
                last_date = datetime(last_date.year, current_month, last_date.day)
            
            # Tanggal awal prediksi adalah 1 hari setelah data terakhir
            start_date = last_date + timedelta(days=1)
            logger.info(f"Tanggal awal prediksi: {start_date.strftime('%Y-%m-%d')}")
        else:
            # Fallback ke tanggal saat ini jika tidak ada data historis
            start_date = datetime.now()
        
        for i in range(filter_days):
            # Ambil 60 data terbaru untuk prediksi
            input_data = current_data[-60:].reshape(1, 60, 1)
            
            # Normalisasi data
            input_scaled = scaler.transform(input_data.reshape(-1, 1)).reshape(1, 60, 1)
            
            # Prediksi
            pred = model.predict(input_scaled)
            
            # Denormalisasi hasil
            predicted_price = scaler.inverse_transform(pred).flatten()[0]
            
            # Tanggal prediksi
            prediction_date = start_date + timedelta(days=i)
            
            # Tambahkan ke hasil
            predictions.append({
                "tanggal": prediction_date.strftime("%Y-%m-%d"),
                "prediksi": float(predicted_price),
                "hari_ke": i+1
            })
            
            # Update data untuk prediksi selanjutnya
            new_value = np.array([[predicted_price]], dtype=np.float32)
            current_data = np.vstack((current_data, new_value))
        
        # Format data historis untuk chart
        historical_data_formatted = []
        for item in reversed(historical_data[:30]):  # Terbaru ke terlama, batasi 30 hari
            tanggal_item = item["tanggal"]
            
            # Pastikan tanggal menggunakan bulan yang benar
            if hasattr(tanggal_item, "strftime"):
                current_month = datetime.now().month
                if tanggal_item.month != current_month:
                    # Koreksi bulan jika perlu
                    tanggal_item = datetime(tanggal_item.year, current_month, tanggal_item.day)
                formatted_date = tanggal_item.strftime("%Y-%m-%d")
            else:
                formatted_date = tanggal_item
                
            historical_data_formatted.append({
                "tanggal": formatted_date,
                "harga": float(item["harga"])
            })
        
        # Simpan riwayat prediksi ke database
        try:
            db = connect_db()
            if db:
                with db.cursor() as cursor:
                    for pred in predictions:
                        query = """
                            INSERT INTO prediksi_history 
                            (komoditas, tanggal_prediksi, tanggal_dibuat, harga_prediksi, filter_days, user_id)
                            VALUES (%s, %s, NOW(), %s, %s, %s)
                        """
                        # Gunakan user_id dari JWT atau null jika tidak ada
                        user_id = None
                        if request.headers.get('Authorization'):
                            try:
                                from flask_jwt_extended import get_jwt_identity
                                user_id = get_jwt_identity()
                            except:
                                pass
                                
                        cursor.execute(
                            query,
                            (komoditas, pred["tanggal"], pred["prediksi"], filter_days, user_id)
                        )
                db.close()
        except Exception as e:
            logger.error(f"Error menyimpan riwayat prediksi: {e}")
            # Lanjutkan meskipun ada error, tidak perlu return

        # Format last_date ke string dengan bulan yang benar
        if hasattr(last_date, "strftime"):
            last_date_str = last_date.strftime("%Y-%m-%d")
        else:
            last_date_str = str(last_date)

        return jsonify({
            "status": "success", 
            "komoditas": komoditas, 
            "filter_days": filter_days,
            "predictions": predictions,
            "historical_data": historical_data_formatted,
            "last_date": last_date_str
        })
        
    except Exception as e:
        logger.error(f"❌ Error di API /predict-with-filter: {e}")
        return jsonify({"status": "error", "message": f"Gagal mendapatkan prediksi: {str(e)}"}), 500

# API untuk mendapatkan riwayat prediksi (histori admin)
@app.route("/api/admin/prediction-history", methods=["GET"])
@jwt_required()  # Pastikan hanya user terautentikasi yang bisa mengakses
def get_prediction_history():
    try:
        # Cek apakah user adalah admin
        current_user_id = get_jwt_identity()
        admin_check = db.session.query(User).filter_by(id=current_user_id, is_admin=True).first()
        
        if not admin_check:
            return jsonify({"status": "error", "message": "Unauthorized access"}), 403
            
        # Parameter filter
        komoditas = request.args.get('komoditas')
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        limit = request.args.get('limit', 100)
        
        conn = connect_db()
        if not conn:
            return jsonify({"status": "error", "message": "Gagal terhubung ke database"}), 500
            
        try:
            with conn.cursor(dictionary=True) as cursor:
                query = """
                    SELECT ph.id, ph.komoditas, ph.tanggal_prediksi, ph.tanggal_dibuat, 
                           ph.harga_prediksi, ph.filter_days,
                           u.username as requested_by
                    FROM prediksi_history ph
                    LEFT JOIN users u ON ph.user_id = u.id
                    WHERE 1=1
                """
                
                params = []
                
                # Tambahkan filter jika ada
                if komoditas:
                    query += " AND LOWER(REPLACE(REPLACE(ph.komoditas, ' ', '_'), '-', '_')) = LOWER(%s)"
                    params.append(komoditas.lower().replace(" ", "_").replace("-", "_"))
                    
                if start_date:
                    query += " AND ph.tanggal_dibuat >= %s"
                    params.append(start_date)
                    
                if end_date:
                    query += " AND ph.tanggal_dibuat <= %s"
                    params.append(end_date)
                
                # Tambahkan sorting dan limit
                query += " ORDER BY ph.tanggal_dibuat DESC LIMIT %s"
                params.append(int(limit))
                
                cursor.execute(query, params)
                history = cursor.fetchall()
                
                # Format tanggal untuk respon JSON
                for item in history:
                    if hasattr(item["tanggal_prediksi"], "strftime"):
                        item["tanggal_prediksi"] = item["tanggal_prediksi"].strftime("%Y-%m-%d")
                    if hasattr(item["tanggal_dibuat"], "strftime"):
                        item["tanggal_dibuat"] = item["tanggal_dibuat"].strftime("%Y-%m-%d %H:%M:%S")
            
            return jsonify({
                "status": "success",
                "history": history
            })
            
        finally:
            conn.close()
            
    except Exception as e:
        logger.error(f"❌ Error di API /admin/prediction-history: {e}")
        return jsonify({"status": "error", "message": f"Gagal mendapatkan riwayat prediksi: {str(e)}"}), 500


# API prediksi harga
@app.route("/api/predict", methods=["POST"])
def predict():
    try:
        data = request.get_json()
        komoditas = data.get("komoditas")

        if not komoditas:
            return jsonify({"status": "error", "message": "Parameter 'komoditas' dibutuhkan."}), 400
        
        harga = get_last_60_prices(komoditas)
        if harga is None:
            return jsonify({"status": "error", "message": f"Data tidak ditemukan untuk '{komoditas}'"}), 404

        model, scaler = load_model(komoditas)
        if not model or not scaler:
            return jsonify({"status": "error", "message": f"Model atau scaler untuk '{komoditas}' tidak tersedia."}), 404
        
        harga_np = np.array(harga, dtype=np.float32).reshape(-1, 1)
        
        if harga_np.shape[0] < 60:
            return jsonify({"status": "error", "message": "Data harga kurang dari 60 hari."}), 400

        harga_scaled = scaler.transform(harga_np).reshape(1, 60, 1)
        pred = model.predict(harga_scaled)
        harga_prediksi = scaler.inverse_transform(pred).flatten()[0]

        return jsonify({"status": "success", "komoditas": komoditas, "predicted_price": round(float(harga_prediksi), 2)})
    except Exception as e:
        logger.error(f"❌ Error di API /predict: {e}")
        return jsonify({"status": "error", "message": f"Gagal mendapatkan prediksi: {str(e)}"}), 500


# API untuk mendapatkan harga terbaru
@app.route('/api/get_latest_prices', methods=['GET'])
def get_latest_prices():
    commodity = request.args.get('commodity')
    
    if not commodity:
        return jsonify({'status': 'error', 'message': 'Parameter commodity tidak ditemukan'}), 400

    try:
        db = connect_db()
        if not db:
            return jsonify({'status': 'error', 'message': 'Gagal terhubung ke database'}), 500

        with db.cursor(dictionary=True) as cursor:
            query = """
                SELECT harga, tanggal FROM harga_komoditas
                WHERE LOWER(REPLACE(REPLACE(komoditas, ' ', '_'), '-', '_')) = LOWER(%s)
                ORDER BY tanggal DESC LIMIT 60
            """
            cursor.execute(query, (commodity.lower().replace(" ", "_").replace("-", "_"),))
            data = cursor.fetchall()

        if not data:
            return jsonify({'status': 'error', 'message': f'Tidak ada data harga untuk {commodity}'}), 404

        return jsonify({'status': 'success', 'latest_prices': data})
    except Exception as e:
        logger.error(f"❌ Error saat mengambil data: {e}")
        return jsonify({'status': 'error', 'message': f'Gagal mengambil data harga: {str(e)}'}), 500
    finally:
        if db:
            db.close()
            

@app.route('/api/scrape', methods=['POST'])
def scrape_data():
    """
    Endpoint untuk scraping data
    """
    
    try:
        data = request.json or {}
        days_back = data.get('days_back', 70)
        
        if not isinstance(days_back, int) or days_back <= 0 or days_back > 365:
            return jsonify({
                'status': 'error',
                'message': 'parameter days_back harus berupa angka antara 1-365'
            }), 400
            
        logger.info(f"menjalankan scraping untuk {days_back} hari terakhir")
        result = scraping.scrape_and_store(days_back)
        
        return jsonify(result)
    
    except Exception as e:
        logger.error(f"error pada endpoint /api/scrape: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@app.route('/api/check-mapping', methods=['GET'])
def check_mapping():
    """Endpoint untuk memeriksa integritas pemetaan komoditas"""
    try:
        result = scraping.check_komoditas_mapping_integrity()
        return jsonify(result)
    
    except Exception as e:
        logger.error(f"Error pada endpoint /api/check-mapping: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@app.route('/api/data-status', methods=['GET'])
def data_status():
   
    try:
        days = request.args.get('days', 70, type=int)
        result = scraping.get_data_status(days)
        return jsonify(result)
    
    except Exception as e:
        logger.error(f"Error pada endpoint /api/data-status: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@app.route('/api/komoditas', methods=['GET'])
def get_komoditas():
    """
    Endpoint untuk mendapatkan daftar komoditas yang tersedia
    """
    try:
        return jsonify({
            'status': 'success',
            'komoditas': list(scraping.KOMODITAS_DIPERLUKAN),
            'mapping': scraping.KOMODITAS_MAPPING
        })
    
    except Exception as e:
        logger.error(f"Error pada endpoint /api/komoditas: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500
    
if __name__ == "__main__":
    app.run(debug=True)