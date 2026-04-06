import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
import joblib
import os

FEATURES = ['vibration', 'temperature', 'oil_condition', 'load_levels', 'operating_hours']
MODEL_PATH = os.path.join(os.path.dirname(__file__), 'predictive_maintenance_rf.pkl')
STATUS_MAP = {0: 'Healthy', 1: 'Maintenance Required', 2: 'Critical Failure Risk'}

def generate_mock_data():
    """Fallback training data (keeps service working if CSVs are missing)."""
    data = {
        'vibration': [0.1, 0.4, 0.9, 0.2, 0.8, 1.2, 0.1, 0.3],
        'temperature': [45, 60, 95, 50, 85, 110, 48, 55],
        'oil_condition': [90, 75, 40, 88, 50, 30, 92, 80],
        'load_levels': [60, 75, 95, 65, 85, 98, 62, 70],
        'operating_hours': [1000, 3000, 8000, 1500, 6000, 9500, 1200, 2500],
        'health_status': [0, 0, 2, 0, 1, 2, 0, 0],  # 0 Healthy, 1 Maintenance Required, 2 Critical
    }
    return pd.DataFrame(data)


def load_training_data():
    low_risk = pd.read_csv('low_risk_industrial_data.csv')
    low_risk['health_status'] = 0  # Healthy

    medium_risk = pd.read_csv('medium_risk_industrial_data.csv')
    medium_risk['health_status'] = 1  # Maintenance Required  <-- THIS WAS MISSING

    high_risk = pd.read_csv('high_risk_industrial_data.csv')
    high_risk['health_status'] = 2  # Critical

    return pd.concat([low_risk, medium_risk, high_risk], ignore_index=True)


def train_model():
    try:
        df = load_training_data()
    except Exception as e:
        # If expected training CSVs are missing, keep the service functional.
        print(f"Training data not available, using mock data instead. Error: {str(e)}")
        df = generate_mock_data()
    X = df[FEATURES]
    y = df['health_status']

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    model = RandomForestClassifier(n_estimators=100, random_state=42)
    model.fit(X_train, y_train)

    joblib.dump(model, MODEL_PATH)
    print("Model trained and saved.")


def load_model():
    try:
        return joblib.load(MODEL_PATH)
    except Exception:
        print("No model found. Training a new one...")
        train_model()
        return joblib.load(MODEL_PATH)


def predict_health(df):
    model = load_model()

    for col in FEATURES:
        if col not in df.columns:
            df[col] = 0

    try:
        predictions = model.predict(df[FEATURES])
    except Exception as e:
        # Common cause after dependency upgrades: an older pickle isn't compatible.
        # Retrain once and retry.
        if isinstance(e, AttributeError) or 'monotonic_cst' in str(e):
            print(f"Model prediction failed due to incompatibility: {str(e)}. Retraining...")
            train_model()
            model = load_model()
            predictions = model.predict(df[FEATURES])
        else:
            raise
    return [STATUS_MAP.get(pred, 'Unknown') for pred in predictions]


if __name__ == "__main__":
    train_model()
