import requests
import mysql.connector
from datetime import datetime, timedelta
import logging

# Konfigurasi logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("scraping.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Pemetaan nama komoditas dari API ke database
# Ini berguna jika nama di API berbeda dengan nama di database
KOMODITAS_MAPPING = {
    # Format: "Nama di API": "Nama di database"
    "Bawang Merah": "Bawang Merah",
    "Bawang Putih Bonggol": "Bawang Putih",  # Contoh pemetaan jika nama berbeda
    "Beras Medium": "Beras Medium",
    "Beras Premium": "Beras Premium",
    "Cabai Merah Keriting": "Cabai Merah Keriting",  # Contoh pemetaan dengan ejaan berbeda
    "Cabai Rawit Merah": "Cabai Rawit Merah",
    "Daging Ayam Ras": "Daging Ayam Ras",
    "Daging Sapi Murni": "Daging Sapi",
    "Gula Konsumsi": "Gula Pasir",
    "Kedelai Biji Kering (Impor)": "Kedelai",
    "Telur Ayam Ras": "Telur Ayam Ras"
}

# List komoditas yang diperlukan (versi di database)
KOMODITAS_DIPERLUKAN = {
    "Bawang Merah",
    "Bawang Putih",
    "Beras Medium",
    "Beras Premium",
    "Cabai Merah Keriting",
    "Cabai Rawit Merah",
    "Daging Ayam Ras",
    "Daging Sapi",
    "Gula Pasir",
    "Kedelai",
    "Telur Ayam Ras"
}

def connect_db():
    """Fungsi untuk koneksi ke database MySQL"""
    try:
        return mysql.connector.connect(
            host="localhost",
            user="root",
            password="",
            database="harga_komoditas",
            autocommit=True
        )
    except mysql.connector.Error as err:
        logger.error(f"❌ Gagal koneksi database: {err}")
        return None

def scrape_and_store(days_back=70):
    """
    Mengambil data dari API dan menyimpan ke database
    
    Args:
        days_back (int): Jumlah hari ke belakang untuk pengambilan data
    
    Returns:
        dict: Informasi hasil scraping
    """
    try:
        db = connect_db()
        if not db:
            raise Exception("Gagal koneksi ke database")
            
        cursor = db.cursor()
        
        BASE_URL = "https://api-panelhargav2.badanpangan.go.id/api/front/harga-pangan-table-province"
        province_id = 15  # Jawa Timur
        level_harga_id = 3  # Harga rata-rata (Konsumen)
        
        total_data_saved = 0
        failed_dates = []
        data_to_insert = []  # Menyimpan data untuk batch insert
        
        for i in range(days_back):
            date_str = (datetime.today() - timedelta(days=i)).strftime("%d/%m/%Y")
            tanggal = (datetime.today() - timedelta(days=i)).strftime("%Y-%m-%d")
            
            # Periksa apakah data sudah ada untuk tanggal ini
            cursor.execute("SELECT COUNT(*) FROM harga_komoditas WHERE tanggal=%s", (tanggal,))
            count = cursor.fetchone()[0]
            
            if count >= len(KOMODITAS_DIPERLUKAN):
                logger.info(f"✅ Data untuk {tanggal} sudah lengkap, skip.")
                continue
                
            # Fetch dari API
            params = {
                "province_id": province_id,
                "level_harga_id": level_harga_id,
                "period_date": date_str
            }
            
            try:
                response = requests.get(BASE_URL, params=params, timeout=10)
                response.raise_for_status()  # Memastikan respons sukses
                data = response.json()
                
                # Proses data jika ada
                if "grand_total" in data:
                    items_found = 0
                    for item in data["grand_total"]:
                        komoditas_api = item["komoditas"]
                        harga = item["rata_rata"]
                        
                        # Menggunakan pemetaan untuk mendapatkan nama di database
                        if komoditas_api in KOMODITAS_MAPPING:
                            komoditas_db = KOMODITAS_MAPPING[komoditas_api]
                            
                            # Cek apakah komoditas ini termasuk yang diperlukan
                            if komoditas_db in KOMODITAS_DIPERLUKAN:
                                # Validasi harga agar tidak NULL, non-numeric, atau negatif
                                if isinstance(harga, (int, float)) and harga > 0:
                                    cursor.execute(
                                        "SELECT COUNT(*) FROM harga_komoditas WHERE komoditas=%s AND tanggal=%s", 
                                        (komoditas_db, tanggal)
                                    )
                                    if cursor.fetchone()[0] == 0:
                                        data_to_insert.append((komoditas_db, harga, tanggal))
                                        items_found += 1
                                else:
                                    logger.warning(f"⚠️ Harga tidak valid untuk {komoditas_api} pada {tanggal}: {harga}")
                    
                    logger.info(f"🔍 Ditemukan {items_found} data baru untuk {tanggal}")
                else:
                    logger.warning(f"⚠️ Tidak ada data grand_total untuk {tanggal}")
                    failed_dates.append(tanggal)
            
            except requests.RequestException as req_err:
                logger.error(f"❌ Gagal request API untuk {tanggal}: {str(req_err)}")
                failed_dates.append(tanggal)
                continue
        
        # Batch insert untuk mempercepat penyimpanan
        if data_to_insert:
            query = "INSERT INTO harga_komoditas (komoditas, harga, tanggal) VALUES (%s, %s, %s)"
            cursor.executemany(query, data_to_insert)
            db.commit()
            total_data_saved = len(data_to_insert)
            logger.info(f"✅ {total_data_saved} data berhasil disimpan.")
        else:
            logger.info("ℹ️ Tidak ada data baru untuk disimpan.")
        
        cursor.close()
        db.close()
        
        result = {
            "status": "success",
            "data_saved": total_data_saved,
            "failed_dates": failed_dates if failed_dates else None
        }
        
        return result
    
    except Exception as e:
        logger.error(f"❌ Error dalam scrape_and_store: {str(e)}")
        return {
            "status": "error",
            "message": str(e)
        }

def check_komoditas_mapping_integrity():
    """
    Memeriksa integritas pemetaan komoditas
    - Memastikan semua komoditas yang diperlukan ada di pemetaan
    - Memastikan semua hasil pemetaan ada di daftar komoditas yang diperlukan
    """
    missing_komoditas = []
    invalid_mappings = []
    
    # Cek komoditas yang diperlukan tapi tidak ada di pemetaan
    for komoditas in KOMODITAS_DIPERLUKAN:
        if komoditas not in KOMODITAS_MAPPING.values():
            missing_komoditas.append(komoditas)
    
    # Cek hasil pemetaan yang tidak ada di daftar komoditas yang diperlukan
    for api_name, db_name in KOMODITAS_MAPPING.items():
        if db_name not in KOMODITAS_DIPERLUKAN:
            invalid_mappings.append(f"{api_name} -> {db_name}")
    
    return {
        "status": "ok" if not missing_komoditas and not invalid_mappings else "error",
        "missing_komoditas": missing_komoditas,
        "invalid_mappings": invalid_mappings
    }

def get_data_status(days=70):
    """
    Mendapatkan status ketersediaan data untuk periode tertentu
    
    Args:
        days (int): Jumlah hari ke belakang yang ingin diperiksa
    
    Returns:
        dict: Informasi status data
    """
    try:
        db = connect_db()
        if not db:
            raise Exception("Gagal koneksi ke database")
            
        cursor = db.cursor(dictionary=True)
        
        # Dapatkan N hari terakhir
        dates = []
        for i in range(days):
            date = (datetime.today() - timedelta(days=i)).strftime("%Y-%m-%d")
            dates.append(date)
        
        # Query untuk mendapatkan jumlah data per tanggal
        placeholders = ','.join(['%s'] * len(dates))
        query = f"""
            SELECT 
                tanggal, 
                COUNT(*) as jumlah_data
            FROM harga_komoditas 
            WHERE tanggal IN ({placeholders})
            GROUP BY tanggal
            ORDER BY tanggal DESC
        """
        
        cursor.execute(query, dates)
        results = cursor.fetchall()
        
        # Buat dictionary untuk mempermudah akses data
        data_by_date = {}
        for row in results:
            data_by_date[row['tanggal'].strftime('%Y-%m-%d')] = row
        
        # Buat response dengan semua tanggal, termasuk yang tidak ada datanya
        response_data = []
        for date in dates:
            if date in data_by_date:
                # Konversi tanggal menjadi string agar bisa di-serialize ke JSON
                row = data_by_date[date]
                if isinstance(row['tanggal'], datetime):
                    row['tanggal'] = row['tanggal'].strftime('%Y-%m-%d')
                response_data.append(row)
            else:
                response_data.append({
                    'tanggal': date,
                    'jumlah_data': 0
                })
        
        cursor.close()
        db.close()
        
        return {
            'status': 'success',
            'data': response_data,
            'total_komoditas_diperlukan': len(KOMODITAS_DIPERLUKAN)
        }
    
    except Exception as e:
        logger.error(f"❌ Error dalam get_data_status: {str(e)}")
        return {
            'status': 'error',
            'message': str(e)
        }

# Jika file ini dijalankan langsung
if __name__ == "__main__":
    # Cek integritas pemetaan terlebih dahulu
    mapping_check = check_komoditas_mapping_integrity()
    if mapping_check["status"] == "error":
        logger.error("❌ Masalah pada pemetaan komoditas:")
        if mapping_check["missing_komoditas"]:
            logger.error(f"  - Komoditas tidak terpetakan: {', '.join(mapping_check['missing_komoditas'])}")
        if mapping_check["invalid_mappings"]:
            logger.error(f"  - Pemetaan tidak valid: {', '.join(mapping_check['invalid_mappings'])}")
    else:
        logger.info("✅ Pemetaan komoditas valid.")
        result = scrape_and_store()
        logger.info(f"Hasil scraping: {result}")