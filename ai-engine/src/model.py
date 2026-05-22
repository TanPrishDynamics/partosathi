import tensorflow as tf
from tensorflow.keras.models import Model
from tensorflow.keras.layers import Input, LSTM, Dropout, Dense

def build_model(input_shape=(10, 6)):
    """
    Constructs the LSTM architecture for regression and classification.
    """
    inputs = Input(shape=input_shape, name="input_layer")
    
    # LSTM Layers
    x = LSTM(64, return_sequences=True, name="lstm_1")(inputs)
    x = Dropout(0.2, name="dropout_1")(x)
    x = LSTM(32, name="lstm_2")(x)
    x = Dropout(0.2, name="dropout_2")(x)
    
    # Shared Dense
    x = Dense(32, activation='relu', name="dense_shared")(x)
    
    # Output Branches
    # 1. Delivery time (regression)
    time_output = Dense(1, activation='linear', name="time_output")(x)
    
    # 2. Risk level (classification: Normal, Prolonged, Emergency)
    risk_output = Dense(3, activation='softmax', name="risk_output")(x)
    
    model = Model(inputs=inputs, outputs=[time_output, risk_output])
    
    # Compile
    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=0.001),
        loss={
            'time_output': 'mse',
            'risk_output': 'categorical_crossentropy'
        },
        metrics={
            'time_output': 'mae',
            'risk_output': 'accuracy'
        }
    )
    
    return model
