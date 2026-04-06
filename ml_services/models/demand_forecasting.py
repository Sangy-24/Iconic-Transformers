from prophet import Prophet
from prophet.serialize import model_to_json, model_from_json
import pandas as pd
import json
import os

MODEL_PATH = os.path.join(os.path.dirname(__file__), 'demand_forecasting_prophet.json')
REQUIRED_FORECAST_COLUMNS = ["ds", "y"]

def generate_historical_demand():
    """Generates mock historical demand data."""
    dates = pd.date_range(start='2020-01-01', periods=104, freq='W') # 2 years weekly
    data = pd.DataFrame({
        'ds': dates,
        'y': [100 + (x % 50) + (x * 0.5) for x in range(104)] # Trend + seasonal pattern
    })
    return data

def train_prophet_model():
    """Trains a Prophet time series model for demand forecasting."""
    df = generate_historical_demand()
    
    try:
        # 12-week prediction model architecture
        model = Prophet(yearly_seasonality=True, weekly_seasonality=False, daily_seasonality=False)
        model.fit(df)
        
        # Save the model
        with open(MODEL_PATH, 'w') as f:
            f.write(model_to_json(model))
        print("Forecasting model trained and saved.")
    except Exception as e:
        print(f"Prophet C++ backend not available on this system, using simulated model. Error: {str(e)}")
        # If writing fails or model fails to train due to missing Stan compiler
        pass

def _normalize_forecast_dataframe(df):
    """Normalize user-uploaded forecast data into Prophet-ready ds/y columns."""
    if df is None or df.empty:
        raise ValueError("Uploaded file is empty.")

    normalized = df.copy()
    normalized.columns = [str(col).strip().lower() for col in normalized.columns]

    if "ds" not in normalized.columns:
        if "date" in normalized.columns:
            normalized = normalized.rename(columns={"date": "ds"})
        elif "timestamp" in normalized.columns:
            normalized = normalized.rename(columns={"timestamp": "ds"})

    if "y" not in normalized.columns:
        if "units" in normalized.columns:
            normalized = normalized.rename(columns={"units": "y"})
        elif "demand" in normalized.columns:
            normalized = normalized.rename(columns={"demand": "y"})
        elif "value" in normalized.columns:
            normalized = normalized.rename(columns={"value": "y"})

    missing_cols = [col for col in REQUIRED_FORECAST_COLUMNS if col not in normalized.columns]
    if missing_cols:
        raise ValueError(
            f"Missing required columns: {', '.join(missing_cols)}. "
            "Expected columns are ds/y (or aliases like date/units)."
        )

    normalized["ds"] = pd.to_datetime(normalized["ds"], errors="coerce")
    normalized["y"] = pd.to_numeric(normalized["y"], errors="coerce")
    normalized = normalized.dropna(subset=["ds", "y"]).sort_values("ds")

    if len(normalized) < 2:
        raise ValueError("At least 2 valid rows are required to generate a forecast.")

    return normalized[["ds", "y"]]

def _fallback_from_history(history_df, periods):
    """Fallback forecast when Prophet cannot execute."""
    if history_df is None or history_df.empty:
        dates = pd.date_range(start='2022-01-01', periods=periods, freq='W')
        baseline = [120 + (x * 2) for x in range(periods)]
    else:
        clean = history_df.sort_values("ds")
        last_value = float(clean["y"].iloc[-1])
        growth = 0.0
        if len(clean) > 1:
            growth = float(clean["y"].iloc[-1] - clean["y"].iloc[0]) / max(len(clean) - 1, 1)
        dates = pd.date_range(start=clean["ds"].max(), periods=periods + 1, freq='W')[1:]
        baseline = [last_value + growth * (i + 1) for i in range(periods)]

    return pd.DataFrame({
        "ds": dates,
        "yhat": baseline,
        "yhat_lower": [v * 0.92 for v in baseline],
        "yhat_upper": [v * 1.08 for v in baseline],
    })

def generate_forecast(history_df=None, periods=12):
    """Generates a forecast for the given number of periods (weeks)."""
    clean_history = _normalize_forecast_dataframe(history_df) if history_df is not None else None

    # Prefer uploaded data when available
    if clean_history is not None:
        try:
            model = Prophet(yearly_seasonality=True, weekly_seasonality=False, daily_seasonality=False)
            model.fit(clean_history)
            future = model.make_future_dataframe(periods=periods, freq='W')
            forecast = model.predict(future)
            return forecast[['ds', 'yhat', 'yhat_lower', 'yhat_upper']].tail(periods)
        except Exception:
            print("Using fallback forecast generator from uploaded data...")
            return _fallback_from_history(clean_history, periods)

    # Backward-compatible path if no uploaded data is provided
    try:
        with open(MODEL_PATH, 'r') as f:
            model = model_from_json(f.read())
            
        future = model.make_future_dataframe(periods=periods, freq='W')
        forecast = model.predict(future)
        return forecast[['ds', 'yhat', 'yhat_lower', 'yhat_upper']].tail(periods)
    except Exception:
        # Graceful fallback if Prophet JSON isn't available or fails to run due to Windows limitations
        print("Using fallback forecast generator...")
        return _fallback_from_history(None, periods)

if __name__ == "__main__":
    train_prophet_model()
