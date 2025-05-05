from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import LSTM, Dense, Dropout
from tensorflow.keras.optimizers import Adam
from tensorflow.keras.callbacks import EarlyStopping
import numpy as np
from sklearn.metrics import mean_squared_error, mean_absolute_error

def build_lstm_model(X_train):
   
    # dimensi input
    input_shape = (X_train.shape[1], 1)
    
    # model
    model = Sequential([
        LSTM(units=50, return_sequences=True, input_shape=input_shape),
        Dropout(0.2),
        LSTM(units=50, return_sequences=False),
        Dropout(0.2),
        Dense(units=1)
    ])
    
    model.compile(optimizer=Adam(), loss='mean_squared_error')
    
    return model

def train_model(model, X_train, y_train, X_test, y_test, epochs=100, batch_size=32):
    
    # berhenti cepat agar ga overfitting
    early_stopping = EarlyStopping(
        monitor='val_loss',
        patience=20,
        restore_best_weights=True
    )
    
    # training model
    history = model.fit(
        X_train, y_train,
        epochs=epochs,
        batch_size=batch_size,
        validation_data=(X_test, y_test),
        callbacks=[early_stopping],
        verbose=1
    )
    
    return history

def evaluate_model(model, X_test, y_test):
    
    # prediksi
    y_pred = model.predict(X_test)
    
    rmse = np.sqrt(mean_squared_error(y_test, y_pred))
    mae = mean_absolute_error(y_test, y_pred)
    
    return {
        'rmse': float(rmse),
        'mae': float(mae)
    }

def predict_future(model, scaler, last_sequence, days=30):
    
    predictions = []
    
    #copy sequence terakhir untuk prediksi
    current_sequence = last_sequence.copy()
    
    # prediksi n hari ke depan
    for _ in range(days):
       
        x_input = current_sequence.reshape(1, current_sequence.shape[0], 1)
        next_pred = model.predict(x_input)[0][0]
        predictions.append(next_pred)
        current_sequence = np.append(current_sequence[1:], [next_pred])
        
    predictions = np.array(predictions).reshape(-1, 1)
    
    predictions_denorm = scaler.inverse_transform(predictions)
    
    return predictions_denorm