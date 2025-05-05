from flask import Blueprint, jsonify, request, send_file
from flask_jwt_extended import jwt_required, get_jwt_identity
from werkzeug.utils import secure_filename
import os
import sys
import threading
import subprocess
import time
import pandas as pd
from datetime import datetime, timedelta
from models import User, db
import logging
from functools import wraps
import glob
import csv
import tensorflow as tf
import numpy as np
import joblib
import mysql.connector

# Ambil logger yang sudah dikonfigurasi
logger = logging.getLogger()

# PENTING: Blueprint harus didefinisikan sebelum menggunakannya
admin_bp = Blueprint('admin', __name__)

# BASE_DIR perlu ditentukan
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATASET_DIR = os.path.join(BASE_DIR, "datasets")
MODEL_DIR = os.path.join(BASE_DIR, "models")
SCALER_DIR = os.path.join(BASE_DIR, "scalers")
SCRIPTS_DIR = os.path.join(BASE_DIR, "scripts")
PLOT_DIR = os.path.join(BASE_DIR, "plots")

# Buat direktori jika belum ada
for directory in [DATASET_DIR, MODEL_DIR, SCALER_DIR, PLOT_DIR]:
    os.makedirs(directory, exist_ok=True)

# Tambahkan path scripts ke sys.path agar bisa mengimport fungsi dari scripts
if SCRIPTS_DIR not in sys.path:
    sys.path.append(SCRIPTS_DIR)

# Import fungsi preprocessing dari scripts/utils.py
try:
    from scripts.utils import load_and_clean_data
    logger.info("Berhasil import fungsi load_and_clean_data dari scripts/utils.py")
except ImportError as e:
    logger.error(f"Error saat import dari scripts/utils.py: {e}")
    # Jika gagal import, buat fungsi kosong sebagai fallback
    def load_and_clean_data(file_path):
        return pd.read_csv(file_path, delimiter=';')

# Validasi file
ALLOWED_EXTENSIONS = {'csv'}
TRAINING_STATUS = {
    'is_training': False,
    'komoditas': None,
    'start_time': None,
    'end_time': None,
    'progress': 0,
    'status': None,
    'message': None
}

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@admin_bp.route('/test', methods=['GET'])
def test_endpoint():
    """
    Endpoint pengujian tanpa JWT
    """
    return jsonify({
        "status": "success",
        "message": "Test endpoint berhasil diakses",
        "training_status": TRAINING_STATUS
    })

# @admin_bp.route('/preprocess-data', methods=['POST'])
# # @jwt_required()  # Uncomment setelah JWT issue diselesaikan
# def preprocess_data():
#     """
#     Endpoint untuk melakukan preprocessing pada semua dataset
#     atau dataset tertentu jika komoditas diberikan
#     """
#     try:
#         data = request.get_json()
#         specific_komoditas = data.get('komoditas') if data else None
        
#         # Path ke direktori dataset
#         dataset_dir = os.path.join(BASE_DIR, "datasets")
        
#         # Import glob jika belum
#         import glob
        
#         # Dapatkan semua file CSV atau file tertentu jika komoditas diberikan
#         if specific_komoditas:
#             komoditas_formatted = specific_komoditas.lower().replace(" ", "_").replace("-", "_")
#             csv_files = glob.glob(os.path.join(dataset_dir, f"{komoditas_formatted}.csv"))
#         else:
#             csv_files = glob.glob(os.path.join(dataset_dir, "*.csv"))
            
#         if not csv_files:
#             return jsonify({
#                 "status": "error", 
#                 "message": f"Tidak ada file CSV yang ditemukan untuk diproses"
#             }), 404
        
#         # List untuk menyimpan hasil preprocessing
#         results = []
        
#         # Proses setiap file
#         for file_path in csv_files:
#             try:
#                 filename = os.path.basename(file_path)
#                 komoditas_name = os.path.splitext(filename)[0]
                
#                 # Log info
#                 logger.info(f"Preprocessing file: {filename}")
                
#                 # Baca ukuran file sebelum preprocessing
#                 original_size = os.path.getsize(file_path)
                
#                 # Simpan beberapa baris file asli untuk debugging
#                 original_sample = ""
#                 try:
#                     with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
#                         original_sample = ''.join([next(f, '') for _ in range(5)])
#                 except:
#                     pass
                
#                 # Preprocessing dataset menggunakan fungsi dari utils.py
#                 start_time = time.time()
#                 preprocessed_df = load_and_clean_data(file_path)
#                 processing_time = time.time() - start_time
                
#                 # Simpan hasil preprocessing ke file yang sama (overwrite)
#                 # PENTING: Simpan kolom Tanggal sebagai kolom (bukan index)
#                 preprocessed_df.to_csv(file_path, sep=';', index=False)
                
#                 # Preview data untuk response
#                 preview_data = []
#                 for _, row in preprocessed_df.head(5).iterrows():
#                     preview_data.append({
#                         'Tanggal': row['Tanggal'].strftime('%Y-%m-%d') if isinstance(row['Tanggal'], pd.Timestamp) else str(row['Tanggal']),
#                         'Harga': float(row['Harga'])
#                     })
                
#                 # Tambahkan info ke hasil
#                 results.append({
#                     "komoditas": komoditas_name,
#                     "file": filename,
#                     "rows": len(preprocessed_df),
#                     "original_sample": original_sample,
#                     "preview_data": preview_data,
#                     "processing_time": round(processing_time, 2),
#                     "status": "success"
#                 })
                
#                 logger.info(f"Preprocessing berhasil untuk {filename}: {len(preprocessed_df)} baris")
#             except Exception as e:
#                 # Jika error pada satu file, lanjut ke file berikutnya
#                 logger.error(f"Error saat preprocessing {os.path.basename(file_path)}: {str(e)}")
#                 results.append({
#                     "komoditas": os.path.splitext(os.path.basename(file_path))[0],
#                     "file": os.path.basename(file_path),
#                     "error": str(e),
#                     "status": "failed"
#                 })
        
#         # Hitung statistik
#         success_count = sum(1 for r in results if r['status'] == 'success')
#         failed_count = sum(1 for r in results if r['status'] == 'failed')
        
#         message = f"Preprocessing selesai: {success_count} berhasil, {failed_count} gagal"
        
#         return jsonify({
#             "status": "success",
#             "message": message,
#             "results": results
#         })
        
#     except Exception as e:
#         logger.error(f"Error saat preprocessing data: {str(e)}")
#         return jsonify({"status": "error", "message": f"Error: {str(e)}"}), 500
@admin_bp.route('/preprocess-data', methods=['POST'])
def preprocess_data():
    """
    Endpoint untuk melakukan preprocessing pada semua dataset atau dataset tertentu
    """
    try:
        data = request.get_json()
        specific_komoditas = data.get('komoditas') if data else None
        
        # Path ke direktori dataset
        dataset_dir = os.path.join(BASE_DIR, "datasets")
        
        # Import glob jika belum
        import glob
        
        # Dapatkan semua file CSV atau file tertentu jika komoditas diberikan
        if specific_komoditas:
            komoditas_formatted = specific_komoditas.lower().replace(" ", "_").replace("-", "_")
            csv_files = glob.glob(os.path.join(dataset_dir, f"{komoditas_formatted}.csv"))
        else:
            csv_files = glob.glob(os.path.join(dataset_dir, "*.csv"))
            
        if not csv_files:
            return jsonify({
                "status": "error", 
                "message": f"Tidak ada file CSV yang ditemukan untuk diproses"
            }), 404
        
        # List untuk menyimpan hasil preprocessing
        results = []
        
        # Import MinMaxScaler
        from sklearn.preprocessing import MinMaxScaler
        
        # Proses setiap file
        for file_path in csv_files:
            try:
                filename = os.path.basename(file_path)
                komoditas_name = os.path.splitext(filename)[0]
                
                # Log info
                logger.info(f"Preprocessing file: {filename}")
                
                # Baca ukuran file sebelum preprocessing
                original_size = os.path.getsize(file_path)
                
                # Simpan beberapa baris file asli untuk debugging
                original_sample = ""
                try:
                    with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                        original_sample = ''.join([next(f, '') for _ in range(5)])
                except:
                    pass
                
                # Preprocessing dataset menggunakan fungsi dari utils.py
                start_time = time.time()
                preprocessed_df = load_and_clean_data(file_path)
                processing_time = time.time() - start_time
                
                # Normalisasi data untuk preview
                scaler = MinMaxScaler(feature_range=(0, 1))
                harga_normalized = scaler.fit_transform(preprocessed_df[['Harga']].values)
                normalized_df = preprocessed_df.copy()
                normalized_df['Harga_Normalized'] = harga_normalized
                
                # Simpan hasil preprocessing ke file yang sama (overwrite)
                # PENTING: Simpan kolom Tanggal sebagai kolom (bukan index)
                preprocessed_df.to_csv(file_path, sep=';', index=False)
                
                # Preview data untuk response (termasuk yang dinormalisasi)
                preview_data = []
                for _, row in normalized_df.head(5).iterrows():
                    preview_data.append({
                        'Tanggal': row['Tanggal'].strftime('%Y-%m-%d') if isinstance(row['Tanggal'], pd.Timestamp) else str(row['Tanggal']),
                        'Harga': float(row['Harga']),
                        'Harga_Normalized': float(row['Harga_Normalized'][0]) if isinstance(row['Harga_Normalized'], np.ndarray) else float(row['Harga_Normalized'])
                    })
                
                # Tambahkan info ke hasil
                results.append({
                    "komoditas": komoditas_name,
                    "file": filename,
                    "rows": len(preprocessed_df),
                    "original_sample": original_sample,
                    "preview_data": preview_data,
                    "processing_time": round(processing_time, 2),
                    "status": "success"
                })
                
                logger.info(f"Preprocessing berhasil untuk {filename}: {len(preprocessed_df)} baris")
            except Exception as e:
                # Jika error pada satu file, lanjut ke file berikutnya
                logger.error(f"Error saat preprocessing {os.path.basename(file_path)}: {str(e)}")
                results.append({
                    "komoditas": os.path.splitext(os.path.basename(file_path))[0],
                    "file": os.path.basename(file_path),
                    "error": str(e),
                    "status": "failed"
                })
        
        # Hitung statistik
        success_count = sum(1 for r in results if r['status'] == 'success')
        failed_count = sum(1 for r in results if r['status'] == 'failed')
        
        message = f"Preprocessing selesai: {success_count} berhasil, {failed_count} gagal"
        
        return jsonify({
            "status": "success",
            "message": message,
            "results": results
        })
        
    except Exception as e:
        logger.error(f"Error saat preprocessing data: {str(e)}")
        return jsonify({"status": "error", "message": f"Error: {str(e)}"}), 500

@admin_bp.route('/upload-csv', methods=['POST'])
# @jwt_required()  # Uncomment setelah JWT issue diselesaikan
def upload_csv():
    """
    Endpoint untuk admin mengupload file CSV komoditas.
    Selalu menggantikan file yang sudah ada jika komoditas sama.
    """
    try:
        # Cek apakah request mengandung file
        if 'file' not in request.files:
            return jsonify({"status": "error", "message": "Tidak ada file yang diunggah"}), 400
        
        file = request.files['file']
        komoditas = request.form.get('komoditas')
        
        if not komoditas:
            return jsonify({"status": "error", "message": "Parameter 'komoditas' dibutuhkan"}), 400
        
        # Format nama komoditas
        komoditas_formatted = komoditas.lower().replace(" ", "_").replace("-", "_")
        
        # Jika user tidak memilih file
        if file.filename == '':
            return jsonify({"status": "error", "message": "Tidak ada file yang dipilih"}), 400
        
        if file and allowed_file(file.filename):
            # Path file dataset
            filename = f"{komoditas_formatted}.csv"
            file_path = os.path.join(DATASET_DIR, filename)
            
            # Log jika file sudah ada (akan diganti)
            if os.path.exists(file_path):
                logger.info(f"File {filename} sudah ada dan akan diganti")
            
            # Simpan file (selalu menggantikan file lama jika ada)
            file.save(file_path)
            logger.info(f"File {filename} berhasil disimpan di {file_path}")
            
            # Baca file untuk mendeteksi format
            try:
                # Coba baca beberapa baris pertama dari file untuk mendeteksi delimiter
                with open(file_path, 'r') as f:
                    sample = f.read(1000)  # Baca 1000 karakter pertama
                
                # Coba deteksi delimiter
                sniffer = csv.Sniffer()
                dialect = sniffer.sniff(sample)
                delimiter = dialect.delimiter
                
                # Baca file dengan delimiter yang terdeteksi
                df = pd.read_csv(file_path, delimiter=delimiter)
                row_count = len(df)
                
                # Log kolom-kolom yang ada untuk debugging
                logger.info(f"Kolom yang terdeteksi: {list(df.columns)}")
                
                return jsonify({
                    "status": "success", 
                    "message": f"File {filename} berhasil disimpan dengan {row_count} baris data",
                    "file_path": file_path,
                    "row_count": row_count,
                    "detected_delimiter": delimiter,
                    "detected_columns": list(df.columns),
                    "requires_preprocessing": True,
                    "filename": filename,
                    "timestamp": datetime.now().isoformat(),
                    "rows": row_count
                })
                
            except Exception as e:
                logger.error(f"Error saat membaca file CSV: {str(e)}")
                
                # Fallback: coba baca file tanpa mendeteksi format
                try:
                    df = pd.read_csv(file_path, sep=None, engine='python')
                    row_count = len(df)
                    return jsonify({
                        "status": "success", 
                        "message": f"File {filename} berhasil disimpan dengan {row_count} baris data (format tidak standar)",
                        "file_path": file_path,
                        "row_count": row_count,
                        "detected_columns": list(df.columns),
                        "requires_preprocessing": True,
                        "filename": filename,
                        "timestamp": datetime.now().isoformat(),
                        "rows": row_count
                    })
                except Exception as e2:
                    logger.error(f"Error lanjutan saat membaca file CSV: {str(e2)}")
                    return jsonify({
                        "status": "success", 
                        "message": f"File {filename} berhasil disimpan, tetapi format file tidak dapat dideteksi",
                        "file_path": file_path,
                        "requires_preprocessing": True,
                        "filename": filename,
                        "timestamp": datetime.now().isoformat()
                    })
                
        return jsonify({"status": "error", "message": "Tipe file tidak diperbolehkan. Gunakan .csv"}), 400
        
    except Exception as e:
        logger.error(f"Error saat upload CSV: {str(e)}")
        return jsonify({"status": "error", "message": f"Error: {str(e)}"}), 500

@admin_bp.route('/upload-dataset', methods=['POST'])
# @jwt_required()  # Uncomment setelah JWT issue diselesaikan
def upload_dataset():
    """
    Alias untuk upload-csv endpoint agar sesuai dengan nama di React component.
    """
    return upload_csv()
    
def run_training_process(komoditas=None):
    """
    Fungsi untuk menjalankan training model secara asynchronous
    """
    global TRAINING_STATUS
    
    try:
        TRAINING_STATUS['is_training'] = True
        TRAINING_STATUS['komoditas'] = komoditas
        TRAINING_STATUS['start_time'] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        TRAINING_STATUS['status'] = 'running'
        TRAINING_STATUS['message'] = 'Proses training sedang berjalan'
        
        # Log dimulainya training
        logger.info(f"🔄 Memulai training model untuk komoditas: {komoditas}")
        
        # Siapkan path ke script training
        main_script = os.path.join(SCRIPTS_DIR, "main.py")
        
        # Jalankan script main.py dengan subprocess
        # Jika komoditas spesifik, tambahkan sebagai argument
        cmd = ['python', main_script]
        if komoditas:
            cmd.append('--komoditas')
            cmd.append(komoditas)
            
        # Simulasi progress (karena progress asli sulit didapat dari subprocess)
        total_time = 1800  # 30 menit dalam detik
        increment = 5  # update setiap 5 detik
        steps = total_time // increment
        
        process = subprocess.Popen(cmd, 
                                  stdout=subprocess.PIPE, 
                                  stderr=subprocess.PIPE)
        
        # Simulasi update progress
        for i in range(steps):
            if process.poll() is not None:  # Proses selesai
                break
                
            progress = min(99, int((i / steps) * 100))
            TRAINING_STATUS['progress'] = progress
            time.sleep(increment)
        
        # Tunggu hingga proses selesai
        stdout, stderr = process.communicate()
        
        if process.returncode == 0:
            TRAINING_STATUS['status'] = 'completed'
            TRAINING_STATUS['message'] = 'Training berhasil diselesaikan'
            TRAINING_STATUS['progress'] = 100
            logger.info(f"✅ Training model berhasil untuk komoditas: {komoditas}")
            
            # Simpan metadata ke database
            try:
                # Jika komoditas spesifik, simpan 1 record, jika tidak, simpan untuk semua komoditas
                db = mysql.connector.connect(
                    host="localhost", 
                    user="root", 
                    password="", 
                    database="harga_komoditas"
                )
                cursor = db.cursor()
                
                # Tanggal training saat ini
                training_date = datetime.now()
                # Tanggal untuk training berikutnya (1 bulan dari sekarang)
                next_training_date = training_date + timedelta(days=30)
                
                if komoditas:
                    # Training untuk komoditas spesifik
                    komoditas_list = [komoditas]
                else:
                    # Training untuk semua komoditas
                    komoditas_list = [
                        "Bawang Merah", "Bawang Putih", "Beras Medium", "Beras Premium",
                        "Cabai Merah Keriting", "Cabai Rawit Merah", "Daging Ayam Ras",
                        "Daging Sapi", "Gula Pasir", "Kedelai", "Telur Ayam Ras"
                    ]
                
                for k in komoditas_list:
                    # Format nama komoditas
                    komoditas_formatted = k.lower().replace(" ", "_").replace("-", "_")
                    
                    # Get metrics if available
                    rmse = 0.0
                    mae = 0.0
                    model_file = os.path.join(MODEL_DIR, f"{komoditas_formatted}_model.h5")
                    if os.path.exists(model_file):
                        # Check if model metrics saved in a file
                        metrics_file = os.path.join(MODEL_DIR, f"{komoditas_formatted}_metrics.json")
                        if os.path.exists(metrics_file):
                            try:
                                import json
                                with open(metrics_file, 'r') as f:
                                    metrics = json.load(f)
                                    rmse = metrics.get('rmse', 0.0) 
                                    mae = metrics.get('mae', 0.0)
                            except:
                                pass
                    
                    # First check if record exists
                    query = """
                        SELECT id FROM model_training_history 
                        WHERE komoditas = %s
                    """
                    cursor.execute(query, (k,))
                    result = cursor.fetchone()
                    
                    if result:
                        # Update existing record
                        query = """
                            UPDATE model_training_history 
                            SET training_date = %s, rmse = %s, mae = %s, next_training_date = %s
                            WHERE komoditas = %s
                        """
                        cursor.execute(query, (
                            training_date.strftime('%Y-%m-%d %H:%M:%S'),
                            rmse,
                            mae,
                            next_training_date.strftime('%Y-%m-%d %H:%M:%S'),
                            k
                        ))
                    else:
                        # Insert new record
                        query = """
                            INSERT INTO model_training_history 
                            (komoditas, training_date, rmse, mae, next_training_date)
                            VALUES (%s, %s, %s, %s, %s)
                        """
                        cursor.execute(query, (
                            k,
                            training_date.strftime('%Y-%m-%d %H:%M:%S'),
                            rmse,
                            mae,
                            next_training_date.strftime('%Y-%m-%d %H:%M:%S')
                        ))
                
                db.commit()
                cursor.close()
                db.close()
                logger.info("✅ Training metadata saved to database")
            except Exception as e:
                logger.error(f"❌ Error saving training metadata: {str(e)}")
            
        else:
            TRAINING_STATUS['status'] = 'failed'
            TRAINING_STATUS['message'] = f"Training gagal: {stderr.decode('utf-8')}"
            logger.error(f"❌ Training model gagal: {stderr.decode('utf-8')}")
            
    except Exception as e:
        TRAINING_STATUS['status'] = 'failed'
        TRAINING_STATUS['message'] = f"Training gagal: {str(e)}"
        logger.error(f"❌ Error saat training model: {str(e)}")
    finally:
        TRAINING_STATUS['is_training'] = False
        TRAINING_STATUS['end_time'] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

@admin_bp.route('/train-model', methods=['POST'])
# @jwt_required()  # Uncomment setelah JWT issue diselesaikan
def train_model_endpoint():
    """
    Endpoint untuk memulai proses training model
    """
    global TRAINING_STATUS
    
    # Uncomment untuk mengembalikan autentikasi
    # current_user_id = get_jwt_identity()
    # user = User.query.get(current_user_id)
    
    # if not user or not user.is_admin:
    #     return jsonify({"status": "error", "message": "Unauthorized, admin only"}), 403
    
    # Cek apakah proses training sedang berjalan
    if TRAINING_STATUS['is_training']:
        return jsonify({
            "status": "error", 
            "message": "Proses training sedang berjalan", 
            "training_status": TRAINING_STATUS
        }), 409
    
    data = request.get_json()
    komoditas = data.get("komoditas") if data else None
    
    # Cek apakah file CSV untuk komoditas ada
    if komoditas:
        komoditas_formatted = komoditas.lower().replace(" ", "_").replace("-", "_")
        file_path = os.path.join(DATASET_DIR, f"{komoditas_formatted}.csv")
        
        if not os.path.exists(file_path):
            return jsonify({
                "status": "error", 
                "message": f"File CSV untuk {komoditas} tidak ditemukan"
            }), 404
    
    # Mulai training dalam thread terpisah
    training_thread = threading.Thread(target=run_training_process, args=(komoditas,))
    training_thread.daemon = True
    training_thread.start()
    
    return jsonify({
        "status": "success", 
        "message": "Proses training model telah dimulai",
        "training_status": TRAINING_STATUS
    })

@admin_bp.route('/training-status', methods=['GET'])
# @jwt_required()  # Uncomment setelah JWT issue diselesaikan
def training_status():
    """
    Endpoint untuk mendapatkan status training
    """
    # Uncomment untuk mengembalikan autentikasi
    # current_user_id = get_jwt_identity()
    # user = User.query.get(current_user_id)
    
    # if not user:
    #     return jsonify({"status": "error", "message": "Unauthorized"}), 401
    
    return jsonify({
        "status": "success", 
        "training_status": TRAINING_STATUS
    })
    
@admin_bp.route('/training-history', methods=['GET'])
# @jwt_required()  # Uncomment setelah JWT issue diselesaikan
def get_training_history():
    """
    Endpoint untuk mendapatkan history training model
    """
    try:
        db = mysql.connector.connect(
            host="localhost", 
            user="root", 
            password="", 
            database="harga_komoditas"
        )
        cursor = db.cursor(dictionary=True)
        
        query = """
            SELECT * FROM model_training_history
            ORDER BY training_date DESC
        """
        cursor.execute(query)
        history = cursor.fetchall()
        
        cursor.close()
        db.close()
        
        # Add model file status
        for item in history:
            komoditas_formatted = item['komoditas'].lower().replace(" ", "_").replace("-", "_")
            model_file = os.path.join(MODEL_DIR, f"{komoditas_formatted}_model.h5")
            item['model_exists'] = os.path.exists(model_file)
            
            # Convert dates to string for JSON serialization
            if isinstance(item['training_date'], datetime):
                item['training_date'] = item['training_date'].strftime('%Y-%m-%d %H:%M:%S')
            if isinstance(item['next_training_date'], datetime):
                item['next_training_date'] = item['next_training_date'].strftime('%Y-%m-%d %H:%M:%S')
                
            # Calculate days until next training
            try:
                next_date = datetime.strptime(item['next_training_date'], '%Y-%m-%d %H:%M:%S')
                days_remaining = (next_date - datetime.now()).days
                item['days_until_next_training'] = max(0, days_remaining)
            except:
                item['days_until_next_training'] = 0
        
        return jsonify({
            "status": "success",
            "history": history
        })
        
    except Exception as e:
        logger.error(f"Error saat mengambil history training: {str(e)}")
        return jsonify({"status": "error", "message": f"Error: {str(e)}"}), 500

@admin_bp.route('/test-upload', methods=['POST'])
def test_upload():
    """
    Endpoint pengujian untuk upload tanpa JWT
    """
    try:
        # Cek apakah request mengandung file
        if 'file' not in request.files:
            return jsonify({"status": "error", "message": "Tidak ada file yang diunggah"}), 400
        
        file = request.files['file']
        komoditas = request.form.get('komoditas')
        
        if not komoditas:
            return jsonify({"status": "error", "message": "Parameter 'komoditas' dibutuhkan"}), 400
        
        # Simpan file ke temporary location
        file_content = file.read()
        
        # Return success untuk testing
        return jsonify({
            "status": "success", 
            "message": f"Test upload berhasil untuk {komoditas}, ukuran file: {len(file_content)} bytes"
        })
        
    except Exception as e:
        logger.error(f"Error saat test upload: {str(e)}")
        return jsonify({"status": "error", "message": f"Error: {str(e)}"}), 500

@admin_bp.route('/test-training', methods=['POST'])
def test_training():
    """
    Endpoint pengujian untuk training tanpa JWT
    """
    try:
        data = request.get_json()
        komoditas = data.get("komoditas") if data else None
        
        return jsonify({
            "status": "success",
            "message": f"Test training berhasil dimulai untuk {komoditas or 'semua komoditas'}",
            "training_status": {
                "is_training": True,
                "komoditas": komoditas,
                "progress": 10,
                "status": "running",
                "message": "Training sedang berjalan (test)",
                "start_time": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "end_time": None
            }
        })
        
    except Exception as e:
        logger.error(f"Error saat test training: {str(e)}")
        return jsonify({"status": "error", "message": f"Error: {str(e)}"}), 500

@admin_bp.route('/plot-image/<string:komoditas>', methods=['GET'])
# @jwt_required()
def get_plot_image(komoditas):
    """
    Endpoint untuk mengambil file gambar visualisasi hasil training terbaru
    """
    try:
        komoditas_formatted = komoditas.lower().replace(" ", "_").replace("-", "_")
        
        # Cari semua file prediksi dan training history untuk komoditas ini
        import glob
        prediction_files = glob.glob(os.path.join(PLOT_DIR, f"{komoditas_formatted}*predictions*.png"))
        training_files = glob.glob(os.path.join(PLOT_DIR, f"{komoditas_formatted}*training_history*.png"))
        
        # Jenis plot yang diminta (predictions atau training_history)
        plot_type = request.args.get('type', 'predictions')  # Default ke predictions
        
        # Log untuk debugging
        logger.info(f"Mencari plot untuk {komoditas_formatted}, tipe: {plot_type}")
        logger.info(f"Prediction files: {prediction_files}")
        logger.info(f"Training files: {training_files}")
        
        # Pilih file terbaru sesuai tipe
        if plot_type == 'training_history' and training_files:
            # Urutkan berdasarkan timestamp terbaru (nama file berisi timestamp)
            latest_file = sorted(training_files, key=os.path.getctime, reverse=True)[0]
            logger.info(f"Menggunakan training history file terbaru: {latest_file}")
        elif prediction_files:
            # Urutkan berdasarkan timestamp terbaru
            latest_file = sorted(prediction_files, key=os.path.getctime, reverse=True)[0]
            logger.info(f"Menggunakan prediction file terbaru: {latest_file}")
        else:
            # Jika tidak ada file yang sesuai, coba fallback ke tipe lain
            if plot_type == 'training_history' and prediction_files:
                latest_file = sorted(prediction_files, key=os.path.getctime, reverse=True)[0]
                logger.info(f"Fallback ke prediction file: {latest_file}")
            elif plot_type == 'predictions' and training_files:
                latest_file = sorted(training_files, key=os.path.getctime, reverse=True)[0]
                logger.info(f"Fallback ke training history file: {latest_file}")
            else:
                logger.error(f"Tidak ada file plot ditemukan untuk {komoditas_formatted}")
                return jsonify({
                    "status": "error", 
                    "message": f"Visualisasi untuk {komoditas} tidak ditemukan"
                }), 404
        
        # Return file gambar terbaru dengan cache_timeout=0 untuk menghindari caching
        return send_file(latest_file, mimetype='image/png')
        
    except Exception as e:
        logger.error(f"Error saat mengambil file gambar: {str(e)}")
        return jsonify({"status": "error", "message": f"Error: {str(e)}"}), 500

# Tambahkan endpoint baru khusus untuk plot prediksi
@admin_bp.route('/prediction-plot/<string:komoditas>', methods=['GET'])
# @jwt_required()
def get_prediction_plot(komoditas):
    """
    Endpoint khusus untuk mengambil plot prediksi hasil training
    """
    try:
        komoditas_formatted = komoditas.lower().replace(" ", "_").replace("-", "_")
        
        # Cari semua file prediksi untuk komoditas ini
        import glob
        prediction_files = glob.glob(os.path.join(PLOT_DIR, f"{komoditas_formatted}*predictions*.png"))
        
        if not prediction_files:
            logger.error(f"Tidak ada file plot prediksi ditemukan untuk {komoditas_formatted}")
            return jsonify({
                "status": "error", 
                "message": f"Plot prediksi untuk {komoditas} tidak ditemukan"
            }), 404
            
        # Ambil file terbaru
        latest_file = sorted(prediction_files, key=os.path.getctime, reverse=True)[0]
        logger.info(f"Menggunakan prediction file terbaru: {latest_file}")
        
        # Return file gambar terbaru dengan cache_timeout=0 untuk menghindari caching
        return send_file(latest_file, mimetype='image/png')
        
    except Exception as e:
        logger.error(f"Error saat mengambil file plot prediksi: {str(e)}")
        return jsonify({"status": "error", "message": f"Error: {str(e)}"}), 500

# Perbaikan pada endpoint get_all_plot_images
@admin_bp.route('/plot-images', methods=['GET'])
# @jwt_required()
def get_all_plot_images():
    """
    Endpoint untuk mendapatkan daftar semua file gambar visualisasi
    """
    try:
        plots_data = {}
        
        # Daftar komoditas
        komoditas_list = ["bawang_merah", "bawang_putih", "beras_medium", "beras_premium",
                         "cabai_merah_keriting", "cabai_rawit_merah", "daging_ayam_ras",
                         "daging_sapi", "gula_pasir", "kedelai", "telur_ayam_ras"]
        
        import glob
        
        # Loop untuk setiap komoditas
        for komoditas in komoditas_list:
            
            # Cari semua file plot untuk komoditas ini
            prediction_files = glob.glob(os.path.join(PLOT_DIR, f"{komoditas}*predictions*.png"))
            training_files = glob.glob(os.path.join(PLOT_DIR, f"{komoditas}*training_history*.png"))
            
            # Log untuk debugging
            print(f"Komoditas: {komoditas}")
            print(f"Prediction files: {prediction_files}")
            print(f"Training files: {training_files}")
            
            # Ambil file terbaru dari masing-masing tipe jika ada
            latest_prediction = None
            latest_training = None
            
            if prediction_files:
                latest_prediction = sorted(prediction_files, key=os.path.getctime, reverse=True)[0]
                latest_prediction = os.path.basename(latest_prediction)
            
            if training_files:
                latest_training = sorted(training_files, key=os.path.getctime, reverse=True)[0]
                latest_training = os.path.basename(latest_training)
            
            # Konversi nama komoditas untuk tampilan
            display_name = komoditas.replace('_', ' ').title()
            
            # Dapatkan timestamp dari file untuk mengetahui kapan terakhir diupdate
            prediction_timestamp = None
            training_timestamp = None
            
            if latest_prediction:
                try:
                    prediction_timestamp = datetime.fromtimestamp(os.path.getctime(
                        os.path.join(PLOT_DIR, latest_prediction))).strftime("%Y-%m-%d %H:%M:%S")
                except Exception as e:
                    print(f"Error getting prediction timestamp: {e}")
                
            if latest_training:
                try:
                    training_timestamp = datetime.fromtimestamp(os.path.getctime(
                        os.path.join(PLOT_DIR, latest_training))).strftime("%Y-%m-%d %H:%M:%S")
                except Exception as e:
                    print(f"Error getting training timestamp: {e}")
            
            plots_data[display_name] = {
                'prediction_plot': latest_prediction,
                'training_plot': latest_training,
                'prediction_url': f"/api/admin/prediction-plot/{komoditas}?t={time.time()}" if latest_prediction else None,
                'training_url': f"/api/admin/plot-image/{komoditas}?type=training_history&t={time.time()}" if latest_training else None,
                'prediction_timestamp': prediction_timestamp,
                'training_timestamp': training_timestamp
            }
        
        return jsonify({
            "status": "success",
            "plots": plots_data
        })
        
    except Exception as e:
        logger.error(f"Error saat mengambil daftar plot: {str(e)}")
        return jsonify({"status": "error", "message": f"Error: {str(e)}"}), 500
    
@admin_bp.route('/datasets', methods=['GET'])
# @jwt_required()  # Uncomment setelah JWT issue diselesaikan
def get_datasets():
    """
    Endpoint untuk mendapatkan daftar dataset yang sudah diupload
    """
    try:
        datasets = []
        
        # Ambil semua file CSV dari folder datasets
        csv_files = glob.glob(os.path.join(DATASET_DIR, "*.csv"))
        
        for file_path in csv_files:
            filename = os.path.basename(file_path)
            komoditas = os.path.splitext(filename)[0]
            
            # Coba baca file untuk mendapatkan jumlah baris
            try:
                df = pd.read_csv(file_path, delimiter=';')
                row_count = len(df)
            except Exception as e:
                logger.error(f"Error saat membaca file {filename}: {str(e)}")
                row_count = 0
                
            # Tambahkan ke list datasets
            datasets.append({
                "komoditas": komoditas,
                "filename": filename,
                "rows": row_count,
                "timestamp": datetime.fromtimestamp(os.path.getmtime(file_path)).strftime("%Y-%m-%d %H:%M:%S")
            })
            
        return jsonify({
            "status": "success",
            "datasets": datasets
        })
    except Exception as e:
        logger.error(f"Error saat mengambil daftar dataset: {str(e)}")
        return jsonify({"status": "error", "message": f"Error: {str(e)}"}), 500

@admin_bp.route('/delete-dataset', methods=['DELETE'])
# @jwt_required()  # Uncomment setelah JWT issue diselesaikan
def delete_dataset():
    """
    Endpoint untuk menghapus dataset komoditas.
    """
    try:
        data = request.get_json()
        komoditas = data.get('komoditas')
        
        if not komoditas:
            return jsonify({"status": "error", "message": "Parameter 'komoditas' dibutuhkan"}), 400
        
        # Format nama komoditas
        komoditas_formatted = komoditas.lower().replace(" ", "_").replace("-", "_")
        
        # Path file dataset
        filename = f"{komoditas_formatted}.csv"
        file_path = os.path.join(DATASET_DIR, filename)
        
        # Cek apakah file ada
        if not os.path.exists(file_path):
            return jsonify({"status": "error", "message": f"Dataset untuk {komoditas} tidak ditemukan"}), 404
        
        # Hapus file
        os.remove(file_path)
        
        # Hapus juga file hasil preprocessing jika ada
        preprocessed_dir = os.path.join(BASE_DIR, "preprocessed")
        os.makedirs(preprocessed_dir, exist_ok=True)
        preprocessed_file = os.path.join(preprocessed_dir, filename)
        if os.path.exists(preprocessed_file):
            os.remove(preprocessed_file)
        
        # Hapus model terkait jika ada
        model_file = os.path.join(MODEL_DIR, f"{komoditas_formatted}_model.h5")
        if os.path.exists(model_file):
            os.remove(model_file)
        
        # Hapus scaler terkait jika ada
        scaler_file = os.path.join(SCALER_DIR, f"{komoditas_formatted}_scaler.pkl")
        if os.path.exists(scaler_file):
            os.remove(scaler_file)
        
        # Hapus plot terkait jika ada
        plot_file = os.path.join(PLOT_DIR, f"{komoditas_formatted}_predictions.png")
        if os.path.exists(plot_file):
            os.remove(plot_file)
        
        return jsonify({
            "status": "success",
            "message": f"Dataset {komoditas} berhasil dihapus"
        })
        
    except Exception as e:
        logger.error(f"Error saat menghapus dataset: {str(e)}")
        return jsonify({"status": "error", "message": f"Error: {str(e)}"}), 500

@admin_bp.route('/predict-future/<string:komoditas>', methods=['GET'])
# @jwt_required()  # Uncomment setelah JWT issue diselesaikan
def predict_future(komoditas):
    """
    Endpoint untuk memprediksi harga 30 hari ke depan
    """
    try:
        # Format nama komoditas
        komoditas_formatted = komoditas.lower().replace(" ", "_").replace("-", "_")
        
        # Path ke model dan scaler
        model_path = os.path.join(MODEL_DIR, f"{komoditas_formatted}_model.h5")
        scaler_path = os.path.join(SCALER_DIR, f"{komoditas_formatted}_scaler.pkl")
        
        # Periksa apakah model dan scaler ada
        if not os.path.exists(model_path) or not os.path.exists(scaler_path):
            return jsonify({
                "status": "error", 
                "message": f"Model atau scaler untuk {komoditas} tidak ditemukan"
            }), 404
            
        # Ambil data harga terakhir 60 hari
        from app import get_last_60_prices  # Import fungsi dari app.py
        
        harga_60_hari = get_last_60_prices(komoditas)
        if not harga_60_hari:
            return jsonify({
                "status": "error", 
                "message": f"Data harga 60 hari terakhir untuk {komoditas} tidak ditemukan"
            }), 404
        
        # Load model dan scaler
        model = tf.keras.models.load_model(model_path)
        scaler = joblib.load(scaler_path)
        
        # Preprocess data
        harga_np = np.array(harga_60_hari, dtype=np.float32).reshape(-1, 1)
        harga_scaled = scaler.transform(harga_np)
        
        # Prediksi 30 hari ke depan
        future_predictions = []
        current_sequence = harga_scaled.flatten()[-60:]  # Ambil 60 data terakhir
        
        # Tanggal terakhir dari data
        # Ambil tanggal terakhir dari database
        db = mysql.connector.connect(
            host="localhost", 
            user="root", 
            password="", 
            database="harga_komoditas"
        )
        cursor = db.cursor()
        query = """
            SELECT MAX(tanggal) FROM harga_komoditas
            WHERE LOWER(REPLACE(REPLACE(komoditas, ' ', '_'), '-', '_')) = LOWER(%s)
        """
        cursor.execute(query, (komoditas_formatted,))
        last_date = cursor.fetchone()[0]
        cursor.close()
        db.close()
        
        if not last_date:
            # Fallback jika tidak ada data tanggal
            last_date = datetime.now().date()
            
        # Generate tanggal 30 hari ke depan
        future_dates = [(last_date + timedelta(days=i+1)).strftime('%Y-%m-%d') for i in range(30)]
        
        # Prediksi 30 hari ke depan
        for _ in range(30):
            # Reshape untuk prediksi
            current_reshape = current_sequence.reshape(1, 60, 1)
            
            # Prediksi satu langkah ke depan
            next_pred = model.predict(current_reshape)[0, 0]
            
            # Tambahkan ke daftar prediksi
            future_predictions.append(next_pred)
            
            # Update sequence (hapus elemen pertama, tambahkan prediksi)
            current_sequence = np.append(current_sequence[1:], next_pred)
        
        # Denormalisasi hasil prediksi
        future_predictions_np = np.array(future_predictions).reshape(-1, 1)
        future_predictions_denorm = scaler.inverse_transform(future_predictions_np)
        
        # Buat result dengan tanggal dan prediksi
        result = []
        for i in range(30):
            result.append({
                'tanggal': future_dates[i],
                'prediksi': round(float(future_predictions_denorm[i][0]), 2)
            })
        
        return jsonify({
            "status": "success",
            "komoditas": komoditas,
            "predictions": result
        })
        
    except Exception as e:
        logger.error(f"Error saat prediksi 30 hari: {str(e)}")
        return jsonify({"status": "error", "message": f"Error: {str(e)}"}), 500


@admin_bp.route('/models', methods=['GET'])
# @jwt_required()  # Uncomment setelah JWT issue diselesaikan
def get_models():
    """
    Endpoint untuk mendapatkan daftar model yang tersedia
    """
    try:
        import glob
        
        model_files = glob.glob(os.path.join(MODEL_DIR, "*.h5"))
        model_list = []
        
        for model_file in model_files:
            filename = os.path.basename(model_file)
            komoditas = filename.split('_model.h5')[0]
            
            # Cek juga scaler terkait
            scaler_file = os.path.join(SCALER_DIR, f"{komoditas}_scaler.pkl")
            has_scaler = os.path.exists(scaler_file)
            
            # Cek juga dataset terkait
            dataset_file = os.path.join(DATASET_DIR, f"{komoditas}")
            has_dataset = os.path.exists(dataset_file)
            
            model_list.append({
                "komoditas": komoditas,
                "model_file": filename,
                "has_scaler": has_scaler,
                "has_dataset": has_dataset,
                "created_at": datetime.fromtimestamp(os.path.getctime(model_file)).strftime('%Y-%m-%d %H:%M:%S')
            })
        
        return jsonify({
            "status": "success", 
            "models": model_list
        })
        
    except Exception as e:
        logger.error(f"Error saat mengambil daftar model: {str(e)}")
        return jsonify({"status": "error", "message": f"Error: {str(e)}"}), 500