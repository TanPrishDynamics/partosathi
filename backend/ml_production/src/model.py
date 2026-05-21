import tensorflow as tf
from tensorflow.keras import layers, models

def build_model(input_shape=(10, 6)):
    """
    Implements the dual-output LSTM architecture.
    """
    inputs = layers.Input(shape=input_shape)
    
    # LSTM Backbone
    x = layers.LSTM(64, return_sequences=True)(inputs)
    x = layers.Dropout(0.2)(x)
    x = layers.LSTM(32)(x)
    x = layers.Dropout(0.2)(x)
    
    # Common Dense Layer
    shared = layers.Dense(32, activation='relu')(x)
    
    # Multi-Output Heads
    # 1. Expected time to delivery (Regression)
    time_output = layers.Dense(1, activation='linear', name='time_output')(shared)
    
    # 2. Risk level (Classification: Normal / Prolonged / Emergency)
    risk_output = layers.Dense(3, activation='softmax', name='risk_output')(shared)
    
    model = models.Model(inputs=inputs, outputs=[time_output, risk_output])
    
    optimizer = tf.keras.optimizers.Adam(learning_rate=0.001)
    
    model.compile(
        optimizer=optimizer,
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

def get_callbacks(model_path):
    """
    Standard callbacks for production training.
    """
    callbacks = [
        tf.keras.callbacks.EarlyStopping(
            monitor='val_loss', 
            patience=5, 
            restore_best_weights=True
        ),
        tf.keras.callbacks.ModelCheckpoint(
            filepath=model_path,
            monitor='val_loss',
            save_best_only=True
        )
    ]
    return callbacks
