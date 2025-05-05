import os
import datetime
import matplotlib.pyplot as plt

def plot_training_history(history, dataset_name, plot_path):
    """
    Plot riwayat pelatihan model dan simpan sebagai gambar
    """
    plt.figure(figsize=(10, 6))
    plt.plot(history.history['loss'], label='Loss Pelatihan')
    plt.plot(history.history['val_loss'], label='Loss Validasi')
    plt.title(f'Loss Model untuk {dataset_name}')
    plt.xlabel('Epoch')
    plt.ylabel('Loss')
    plt.legend()
    plt.grid(True)
    
    # Tambahkan timestamp ke nama file
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"{dataset_name}_training_history_{timestamp}.png"
    
    # Hapus plot lama dengan nama yang sama (tanpa timestamp)
    old_files = [f for f in os.listdir(plot_path) if f.startswith(f"{dataset_name}_training_history")]
    for old_file in old_files:
        os.remove(os.path.join(plot_path, old_file))
    
    # Simpan plot baru
    plt.savefig(os.path.join(plot_path, filename))
    plt.close()
    
    # Return path file untuk referensi
    return filename

# 1. Modifikasi visualization.py
# Pastikan filename plot prediksi konsisten

def plot_predictions(dataset_name, predictions, evaluations, plot_path):
    """
    Plot hasil prediksi dan simpan sebagai gambar
    """
    y_pred = predictions[dataset_name]['y_pred']
    y_test = predictions[dataset_name]['y_test']
    
    plt.figure(figsize=(12, 6))
    plt.plot(y_test, label='Harga Aktual', linewidth=2)
    plt.plot(y_pred, label='Harga Prediksi', linewidth=2)
    
    # Tambahkan metrik evaluasi ke judul plot
    rmse = evaluations[dataset_name]["rmse"] if "rmse" in evaluations[dataset_name] else evaluations[dataset_name].get("RMSE", 0)
    mae = evaluations[dataset_name]["mae"] if "mae" in evaluations[dataset_name] else evaluations[dataset_name].get("MAE", 0)
    
    plt.title(f'Prediksi Harga untuk {dataset_name}\nRMSE: {rmse:.2f}, MAE: {mae:.2f}')
    plt.xlabel('Waktu')
    plt.ylabel('Harga (Rupiah)')
    plt.legend()
    plt.grid(True)
    plt.tight_layout()
    
    # Tambahkan timestamp ke nama file untuk versi unik
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    
    # PENTING: Gunakan format nama file yang konsisten 
    # Format harus sama dengan yang dicari di endpoint /plot-image
    filename = f"{dataset_name}_predictions_{timestamp}.png"
    
    # Hapus plot lama dengan nama yang sama (tanpa timestamp)
    old_files = [f for f in os.listdir(plot_path) if f.startswith(f"{dataset_name}_predictions")]
    for old_file in old_files:
        try:
            os.remove(os.path.join(plot_path, old_file))
            print(f"Menghapus plot lama: {old_file}")
        except Exception as e:
            print(f"Error menghapus file: {e}")
    
    # Simpan plot baru
    full_path = os.path.join(plot_path, filename)
    plt.savefig(full_path)
    print(f"Plot prediksi disimpan di: {full_path}")
    plt.close()
    
    # Return path file untuk referensi
    return filename

