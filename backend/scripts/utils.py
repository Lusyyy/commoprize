import pandas as pd
import numpy as np
from sklearn.preprocessing import MinMaxScaler
import os
import pandas as pd
import numpy as np
from sklearn.preprocessing import MinMaxScaler
import os

def load_and_clean_data(file_path):
  
    try:
        print(f"Memproses file: {file_path}")
        df = pd.read_csv(file_path, delimiter=';')
   
        date_formats = ['%d/%m/%Y', '%Y-%m-%d']
        for date_format in date_formats:
            try:
                df['Tanggal'] = pd.to_datetime(df['Tanggal'], format=date_format)
                print(f"Berhasil mengkonversi tanggal dengan format {date_format}")
                break
            except Exception as e:
                print(f"Error konversi tanggal dengan format {date_format}: {e}")
                continue
        else:
            try:
                df['Tanggal'] = pd.to_datetime(df['Tanggal'])
                print("Berhasil mengkonversi tanggal dengan format default")
            except Exception as e2:
                raise ValueError(f"Gagal mengkonversi tanggal: {e2}")
        
        # Jika kolom tidak bernama "Harga", coba temukan
        if "Harga" not in df.columns:
            # Gunakan kolom kedua sebagai Harga
            if len(df.columns) > 1:
                harga_column = df.columns[1]
                df = df.rename(columns={harga_column: "Harga"})
                print(f"Menggunakan kolom {harga_column} sebagai Harga")
            else:
                raise ValueError("Tidak dapat menemukan kolom harga")
        
        df.set_index('Tanggal', inplace=True)
        # isi nilai hilangggg
        df = df.ffill()  
    
        if len(df) < 60:
            raise ValueError(f"Data tidak cukup untuk model LSTM. Hanya tersedia {len(df)} baris, minimal 60 baris diperlukan.")
    
        df = df.reset_index()
        
        print(f"Preprocessing berhasil: {len(df)} baris data")
        return df
    
    except Exception as e:
        error_msg = f"Error saat memuat atau membersihkan data: {str(e)}"
        print(error_msg)
        raise Exception(error_msg)

def normalize_data(df, dataset_name, scalers):
    
    if 'Tanggal' in df.columns:
        df = df.set_index('Tanggal')
    scalers[dataset_name] = MinMaxScaler(feature_range=(0, 1))
    df_scaled = scalers[dataset_name].fit_transform(df[['Harga']].values)
    
    print(f"Normalisasi selesai untuk {dataset_name}")
    print(f"Nilai asli: {df['Harga'].head().values}")
    print(f"Nilai ternormalisasi: {df_scaled[:5].flatten()}")
    
    return df_scaled

def create_dataset(data, time_step=60):
 
    X, y = [], []
    for i in range(len(data) - time_step - 1):
        X.append(data[i:(i + time_step), 0])
        y.append(data[i + time_step, 0])
    return np.array(X), np.array(y)

def split_data(X, y, train_size=0.8):
    train_len = int(len(X) * train_size)
    X_train, X_test = X[:train_len], X[train_len:]
    y_train, y_test = y[:train_len], y[train_len:]
    return X_train, X_test, y_train, y_test

def denormalize_data(scaled_data, dataset_name, scalers):
    return scalers[dataset_name].inverse_transform(scaled_data)

def evaluate_model(model, X_test, y_test):
   
    from sklearn.metrics import mean_squared_error, mean_absolute_error
    
    y_pred = model.predict(X_test)
    rmse = np.sqrt(mean_squared_error(y_test, y_pred))
    mae = mean_absolute_error(y_test, y_pred)
    return rmse, mae