import os
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
from datetime import datetime
import glob
import joblib
import tensorflow as tf
from sklearn.preprocessing import MinMaxScaler
import argparse
import json
import sys

current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.append(current_dir)

from utils import load_and_clean_data, create_dataset, split_data
from model import build_lstm_model, train_model, evaluate_model, predict_future
import visualization

# Direktori utama
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATASET_DIR = os.path.join(BASE_DIR, "datasets")
MODEL_DIR = os.path.join(BASE_DIR, "models")
SCALER_DIR = os.path.join(BASE_DIR, "scalers")
PLOT_DIR = os.path.join(BASE_DIR, "plots")


for directory in [DATASET_DIR, MODEL_DIR, SCALER_DIR, PLOT_DIR]:
    os.makedirs(directory, exist_ok=True)

def load_datasets(specific_komoditas=None):

    datasets = {}
    
    # Dapatkan semua file CSV atau file tertentu jika komoditas diberikan
    if specific_komoditas:
        komoditas_formatted = specific_komoditas.lower().replace(" ", "_").replace("-", "_")
        csv_files = glob.glob(os.path.join(DATASET_DIR, f"{komoditas_formatted}.csv"))
    else:
        csv_files = glob.glob(os.path.join(DATASET_DIR, "*.csv"))
    
    # Muat setiap dataset
    for file_path in csv_files:
        dataset_name = os.path.splitext(os.path.basename(file_path))[0]
        try:
            # Gunakan fungsi load_and_clean_data dari utils.py
            df = load_and_clean_data(file_path)
            datasets[dataset_name] = df
            print(f"Loaded dataset: {dataset_name}, shape: {df.shape}")
        except Exception as e:
            print(f"Error loading dataset {dataset_name}: {e}")
    
    return datasets

def train_models(komoditas=None):

    # Proses dataset
    datasets = load_datasets(komoditas)
    
    # Dictionary untuk menyimpan hasil
    results = {}
    
    for dataset_name, df in datasets.items():
        print(f"Training model for {dataset_name}...")
        
        try:
            # Pastikan Tanggal menjadi index
            if 'Tanggal' in df.columns:
                df = df.set_index('Tanggal')
            
            # Normalisasi data
            scaler = MinMaxScaler(feature_range=(0, 1))
            scaled_data = scaler.fit_transform(df[['Harga']].values)
            
            # Simpan scaler untuk digunakan saat prediksi nanti
            scaler_path = os.path.join(SCALER_DIR, f"{dataset_name}_scaler.pkl")
            joblib.dump(scaler, scaler_path)
            
            # Buat time series dataset
            X, y = create_dataset(scaled_data, time_step=60)
            
            # Reshape data untuk LSTM [samples, time steps, features]
            X = X.reshape(X.shape[0], X.shape[1], 1)
            
            # Split data untuk training dan testing
            X_train, X_test, y_train, y_test = split_data(X, y, train_size=0.8)
            
            # Buat model LSTM
            model = build_lstm_model(X_train)
            
            # Training model
            history = train_model(model, X_train, y_train, X_test, y_test)
            
            # Simpan model
            model_path = os.path.join(MODEL_DIR, f"{dataset_name}_model.h5")
            model.save(model_path)
            
            # Plot dan simpan history training (loss) dengan timestamp
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            loss_plot_filename = visualization.plot_training_history(history, dataset_name, PLOT_DIR)
            
            # Evaluasi model
            y_pred = model.predict(X_test)
            
            # Denormalisasi prediksi dan data aktual untuk evaluasi
            y_pred_denorm = scaler.inverse_transform(y_pred)
            y_test_denorm = scaler.inverse_transform(y_test.reshape(-1, 1))
            
            # Hitung metrik
            metrics = evaluate_model(model, X_test, y_test)
            
            # Simpan metrik ke file
            metrics_path = os.path.join(MODEL_DIR, f"{dataset_name}_metrics.json")
            with open(metrics_path, 'w') as f:
                json.dump(metrics, f)
            
            # Plot dan simpan prediksi vs aktual dengan timestamp
            predictions = {dataset_name: {'y_pred': y_pred_denorm, 'y_test': y_test_denorm}}
            evaluations = {dataset_name: metrics}
            # pred_plot_filename = visualization.plot_predictions(dataset_name, predictions, evaluations, PLOT_DIR)
            try:
                pred_plot_filename = visualization.plot_predictions(dataset_name, predictions, evaluations, PLOT_DIR)
                print(f"Plot prediksi berhasil dibuat: {pred_plot_filename}")
            except Exception as e:
                print(f"Error membuat plot prediksi: {e}")
                pred_plot_filename = None
                        
            # Simpan hasil ke dictionary
            results[dataset_name] = {
                'metrics': metrics,
                'model_path': model_path,
                'loss_plot': os.path.join(PLOT_DIR, loss_plot_filename),
                'pred_plot': os.path.join(PLOT_DIR, pred_plot_filename)
            }
            
            print(f"Training completed for {dataset_name}")
            print(f"RMSE: {metrics['rmse']:.4f}, MAE: {metrics['mae']:.4f}")
            
        except Exception as e:
            print(f"Error training model for {dataset_name}: {e}")
            results[dataset_name] = {
                'error': str(e),
                'status': 'failed'
            }
    
    return results

def preprocess_commodity_data(komoditas, file_path):
   
    # Baca data
    df = load_and_clean_data(file_path)
    
    return df

def train_commodity_model(komoditas):
    
    print(f"Starting training for {komoditas}")
    results = train_models(komoditas)
    
    # Format nama komoditas
    komoditas_formatted = komoditas.lower().replace(" ", "_").replace("-", "_")
    
    if komoditas_formatted in results:
        return results[komoditas_formatted]
    else:
        return {"status": "failed", "message": "Model training failed"}

# Jika file dijalankan langsung
if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Train LSTM models for prediksi harga komoditas')
    parser.add_argument('--komoditas', type=str, help='Nama komoditas spesifik untuk dilatih (opsional)')
    
    args = parser.parse_args()
    
    # Train model
    results = train_models(args.komoditas)
    
    # Print hasil
    for dataset_name, result in results.items():
        if 'error' in result:
            print(f"Error training {dataset_name}: {result['error']}")
        else:
            print(f"Training completed for {dataset_name}")
            print(f"RMSE: {result['metrics']['rmse']:.4f}, MAE: {result['metrics']['mae']:.4f}")