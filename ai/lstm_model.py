import numpy as np
import tensorflow as tf
from tensorflow.keras import Sequential
from tensorflow.keras.layers import Input, LSTM, Dense, Dropout
from sklearn.preprocessing import MinMaxScaler

from database.connection import monitoring_collection


FEATURES = [
    "cpu_usage_percent",
    "memory_usage_percent",
    "disk_usage_percent",
    "bytes_sent",
    "bytes_received",
    "packets_sent",
    "packets_received",
    "errors_in",
    "errors_out",
    "drops_in",
    "drops_out",
    "latency_ms",
]

SEQUENCE_LENGTH = 10


def load_timestamped_data():
    """Load timestamped monitoring records chronologically."""

    records = list(
        monitoring_collection.find(
            {"metrics.timestamp": {"$exists": True}}
        ).sort("metrics.timestamp", 1)
    )

    return records


def prepare_data(records):
    """Convert MongoDB metrics into numerical data."""

    data = []

    for record in records:
        metrics = record.get("metrics", {})

        row = [
            float(metrics.get(feature, 0))
            for feature in FEATURES
        ]

        data.append(row)

    return np.array(data, dtype=np.float32)


def create_sequences(data):
    """Create sliding windows for LSTM."""

    sequences = []

    for i in range(len(data) - SEQUENCE_LENGTH + 1):
        sequences.append(
            data[i:i + SEQUENCE_LENGTH]
        )

    return np.array(sequences, dtype=np.float32)


def build_lstm_model(input_shape):
    """Build the LSTM neural network."""

    model = Sequential([
        Input(shape=input_shape),

        LSTM(
            64,
            return_sequences=True
        ),

        Dropout(0.2),

        LSTM(32),

        Dropout(0.2),

        Dense(16, activation="relu"),

        Dense(len(FEATURES))
    ])

    model.compile(
        optimizer="adam",
        loss="mse"
    )

    return model


def main():

    print("NetGuard AI - LSTM Model")
    print("------------------------")

    records = load_timestamped_data()

    print(f"Timestamped records: {len(records)}")

    if len(records) < SEQUENCE_LENGTH + 1:
        print("Not enough data for LSTM training.")
        return

    raw_data = prepare_data(records)

    print(f"Features per timestep: {len(FEATURES)}")

    # Normalize all features to approximately 0-1
    scaler = MinMaxScaler()

    scaled_data = scaler.fit_transform(raw_data)

    sequences = create_sequences(scaled_data)

    print(f"Sequence length: {SEQUENCE_LENGTH}")
    print(f"Sequences created: {len(sequences)}")

    # First 9 timesteps → predict 10th timestep
    X = sequences[:, :-1, :]
    y = sequences[:, -1, :]

    print(f"Training input shape: {X.shape}")
    print(f"Training target shape: {y.shape}")

    model = build_lstm_model(
        input_shape=(X.shape[1], X.shape[2])
    )

    print("\nModel architecture:")
    model.summary()

    print("\nTraining LSTM...")

    history = model.fit(
        X,
        y,
        epochs=30,
        batch_size=8,
        validation_split=0.2,
        shuffle=False,
        verbose=1
    )

    model.save("ai/netguard_lstm.keras")

    print("\n--------------------------------")
    print("LSTM training completed.")
    print("Final training loss:",
          round(float(history.history["loss"][-1]), 6))

    print("Final validation loss:",
          round(float(history.history["val_loss"][-1]), 6))

    print("Model saved to: ai/netguard_lstm.keras")


if __name__ == "__main__":
    main()