"""
IrisNet AI — Flask Web Application
====================================
A premium web interface for the Iris flower species classifier.
Loads the trained Keras model and serves real-time predictions via REST API.

Usage:
    python app.py

Then open http://localhost:5000 in your browser.
"""

import os
import json
import numpy as np
import pandas as pd
from flask import Flask, render_template, request, jsonify
from sklearn.preprocessing import StandardScaler, LabelEncoder

# Suppress TF warnings for cleaner output
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '2'

import tensorflow as tf

# ─── Configuration ───────────────────────────────────────────────────────────
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, 'iris_model.h5')
DATASET_PATH = os.path.join(BASE_DIR, 'Iris.csv')
HOST = '0.0.0.0'
PORT = 5000

FEATURE_COLS = ['SepalLengthCm', 'SepalWidthCm', 'PetalLengthCm', 'PetalWidthCm']
SPECIES_NAMES = ['Iris-setosa', 'Iris-versicolor', 'Iris-virginica']

# ─── Application Setup ──────────────────────────────────────────────────────
app = Flask(__name__)


def load_resources():
    """Load the trained model, dataset, and fit the scaler."""
    print("=" * 50)
    print("  IrisNet AI — Loading Resources")
    print("=" * 50)

    # Load dataset
    print(f"\n[1/3] Loading dataset from {DATASET_PATH}...")
    df = pd.read_csv(DATASET_PATH)
    print(f"      Loaded {len(df)} samples")

    # Encode labels and fit scaler (matching notebook preprocessing)
    print("[2/3] Fitting StandardScaler on dataset features...")
    le = LabelEncoder()
    le.fit(df['Species'])

    scaler = StandardScaler()
    X = df[FEATURE_COLS].values
    scaler.fit(X)
    print("      Scaler fitted successfully")

    # Load Keras model
    print(f"[3/3] Loading Keras model from {MODEL_PATH}...")
    model = tf.keras.models.load_model(MODEL_PATH)
    model.summary()
    print("\n✅ All resources loaded successfully!")
    print(f"   Server starting at http://localhost:{PORT}\n")

    return model, scaler, le, df


# Load everything on startup
model, scaler, label_encoder, dataset = load_resources()


# ─── Routes ──────────────────────────────────────────────────────────────────

@app.route('/')
def index():
    """Serve the main frontend page."""
    return render_template('index.html')


@app.route('/predict', methods=['POST'])
def predict():
    """
    Predict Iris species from 4 features.

    Expects JSON: {sepal_length, sepal_width, petal_length, petal_width}
    Returns JSON: {species, confidence, probabilities}
    """
    try:
        data = request.get_json()

        # Extract features in the correct order
        features = np.array([[
            float(data.get('sepal_length', 0)),
            float(data.get('sepal_width', 0)),
            float(data.get('petal_length', 0)),
            float(data.get('petal_width', 0)),
        ]])

        # Scale features (same as training)
        features_scaled = scaler.transform(features)

        # Predict probabilities
        probabilities = model.predict(features_scaled, verbose=0)[0]

        # Get predicted class
        predicted_idx = int(np.argmax(probabilities))
        predicted_species = SPECIES_NAMES[predicted_idx]
        confidence = float(probabilities[predicted_idx])

        # Build probability map
        prob_map = {}
        for i, name in enumerate(SPECIES_NAMES):
            prob_map[name] = float(probabilities[i])

        return jsonify({
            'species': predicted_species,
            'confidence': confidence,
            'probabilities': prob_map,
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 400


@app.route('/api/dataset-stats', methods=['GET'])
def dataset_stats():
    """Return dataset statistics for the frontend dashboard."""
    try:
        stats = {
            'total_samples': len(dataset),
            'species_counts': {},
            'feature_stats': {},
        }

        # Species counts
        for species in SPECIES_NAMES:
            count = int(len(dataset[dataset['Species'] == species]))
            stats['species_counts'][species] = count

        # Feature statistics
        for col in FEATURE_COLS:
            # Clean name for display
            display_name = col.replace('Cm', ' (cm)')
            stats['feature_stats'][display_name] = {
                'min': float(dataset[col].min()),
                'max': float(dataset[col].max()),
                'mean': float(dataset[col].mean()),
                'std': float(dataset[col].std()),
            }

        return jsonify(stats)

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/model-info', methods=['GET'])
def model_info():
    """Return model architecture and training information."""
    try:
        layers_info = []
        for layer in model.layers:
            layer_config = layer.get_config()
            info = {
                'name': layer.name,
                'type': layer.__class__.__name__,
                'units': layer_config.get('units', None),
                'activation': layer_config.get('activation', None),
                'params': layer.count_params(),
            }
            layers_info.append(info)

        return jsonify({
            'architecture': layers_info,
            'total_params': model.count_params(),
            'optimizer': 'Adam',
            'loss': 'Categorical Crossentropy',
            'dataset_size': len(dataset),
            'num_features': len(FEATURE_COLS),
            'num_classes': len(SPECIES_NAMES),
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ─── Entry Point ─────────────────────────────────────────────────────────────

if __name__ == '__main__':
    app.run(host=HOST, port=PORT, debug=False)
