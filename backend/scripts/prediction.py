import numpy as np
import pandas as pd
import joblib
from tensorflow.keras.models import load_model

def load_model_and_scaler(model_path, scaler_path):
    """
    Memuat model dan scaler yang telah disimpan
    """
    model = load_model(model_path)
    scaler = joblib.load(scaler_path)
    return model, scaler

def prepare_input_data(data, scaler, time_step=60):
    """
    Menyiapkan data input untuk prediksi
    """
    # Normalisasi data
    scaled_data = scaler.transform(data)
    
    # Membuat sequence data
    X = []
    for i in range(len(scaled_data) - time_step):
        X.append(scaled_data[i:(i + time_step), 0])
    
    return np.array(X).reshape(-1, time_step, 1)

def predict_future(model, last_sequence, steps_ahead=30, scaler=None):
#    prediksi masa depann
    future_predictions = []
    current_sequence = last_sequence.copy()
    
    for _ in range(steps_ahead):
        
        current_reshape = current_sequence.reshape(1, -1, 1)
      
        next_pred = model.predict(current_reshape)[0, 0]
        
        future_predictions.append(next_pred)
       
        current_sequence = np.append(current_sequence[1:], next_pred)
    
    # Denormalisasi jika scaler disediakan
    if scaler:
        future_predictions = scaler.inverse_transform(
            np.array(future_predictions).reshape(-1, 1)
        )
    
    return future_predictions

def predict_bpp(data_file, model_file, scaler_file, future_days=30):

    # Muat data
    df = pd.read_csv(data_file, delimiter=';')
    df['Tanggal'] = pd.to_datetime(df['Tanggal'], format='%d/%m/%Y')
    df.set_index('Tanggal', inplace=True)
    
    # Muat model dan scaler
    model, scaler = load_model_and_scaler(model_file, scaler_file)
    
    # Siapkan data input
    data = df[['Harga']].values
    X = prepare_input_data(data, scaler)
    
    # Prediksi pada data yang ada
    predictions = model.predict(X)
    predictions = scaler.inverse_transform(predictions)
    
    # Prediksi masa depan
    last_sequence = scaler.transform(data[-60:])
    future_preds = predict_future(model, last_sequence.flatten(), future_days, scaler)
    
    # Buat dataframe hasil
    last_date = df.index[-1]
    future_dates = pd.date_range(start=last_date + pd.Timedelta(days=1), periods=future_days)
    
    future_df = pd.DataFrame({
        'Tanggal': future_dates,
        'Prediksi_Harga': future_preds.flatten()
    })
    future_df.set_index('Tanggal', inplace=True)
    
    return future_df