from fastapi import FastAPI, File, UploadFile, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
import io
import os
from groq import Groq
from dotenv import load_dotenv

# Existing ML imports
from models.predictive_maintenance import predict_health, FEATURES
from models.demand_forecasting import generate_forecast

# Load environment variables for the API Key
load_dotenv()

app = FastAPI(title="Iconic Transformers ML API")

# Initialize Groq Client
# Ensure GROQ_API_KEY is in your .env file
client = Groq(api_key=os.getenv("GROQ_API_KEY"))

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"status": "ML Services Active", "modules": ["Predictive Maintenance", "Demand Forecasting", "Chatbot Support"]}

PRODUCT_ID_ALIASES = ["product_id", "productid", "sku", "item_id"]
PRODUCT_NAME_ALIASES = ["product_name", "productname", "name", "item_name"]

def _normalize_columns(df: pd.DataFrame) -> pd.DataFrame:
    normalized = df.copy()
    normalized.columns = [str(col).strip().lower() for col in normalized.columns]
    return normalized

def _resolve_first_column(columns, aliases):
    for alias in aliases:
        if alias in columns:
            return alias
    return None

# --- ALL ML LOGIC REMAINS UNTOUCHED ---

@app.post("/predict-maintenance")
async def predict_maintenance(file: UploadFile = File(...)):
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Only CSV files allowed")
    
    contents = await file.read()

    try:
        df = pd.read_csv(io.BytesIO(contents))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not read CSV: {str(e)}")

    missing_cols = [col for col in FEATURES if col not in df.columns]
    if missing_cols:
        raise HTTPException(
            status_code=400,
            detail=f"Missing required columns: {', '.join(missing_cols)}. "
                   f"Expected columns are: {', '.join(FEATURES)}",
        )
    
    try:
        results = predict_health(df)
        risk_level = "Low"
        if any("Critical" in r for r in results):
            risk_level = "High"
        elif any("Maintenance" in r for r in results):
            risk_level = "Medium"
        
        return {
            "status": "success",
            "prediction": {
                "health": results[0] if len(results) > 0 else "Unknown",
                "risk_level": risk_level,
                "time_window": "15 days",
                "details": f"Analyzed {len(df)} records.",
                "all_results": results,
            },
            "file_name": file.filename,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/forecast-demand")
async def forecast_demand(file: UploadFile = File(...), product_id: str = Form(None)):
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Only CSV files allowed")
    
    contents = await file.read()

    try:
        df = pd.read_csv(io.BytesIO(contents))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not read CSV: {str(e)}")

    try:
        normalized_df = _normalize_columns(df)
        selected_product = None

        product_id_col = _resolve_first_column(normalized_df.columns, PRODUCT_ID_ALIASES)
        product_name_col = _resolve_first_column(normalized_df.columns, PRODUCT_NAME_ALIASES)

        filtered_df = normalized_df
        if product_id:
            if not product_id_col:
                raise ValueError("This CSV does not contain a product_id column.")
            filtered_df = normalized_df[normalized_df[product_id_col].astype(str) == str(product_id)]
            if filtered_df.empty:
                raise ValueError(f"No rows found for selected product_id: {product_id}")

        if product_id_col:
            available_products = filtered_df[product_id_col].dropna().astype(str).unique().tolist()
            if len(available_products) > 1 and not product_id:
                raise ValueError("Multiple products detected. Please select a product_id before running analysis.")

        if product_id and product_id_col:
            selected_product = {"product_id": product_id}
            if product_name_col and not filtered_df.empty:
                selected_product["product_name"] = str(filtered_df[product_name_col].iloc[0])

        result_df = generate_forecast(history_df=filtered_df, periods=12)
        result_df['ds'] = result_df['ds'].dt.strftime('%Y-%m-%d')

        first_val = float(result_df["yhat"].iloc[0])
        last_val = float(result_df["yhat"].iloc[-1])
        delta = last_val - first_val
        direction = "rise" if delta > 0 else ("fall" if delta < 0 else "stable")
        pct_change = (delta / first_val * 100) if first_val else 0.0
        
        return {
            "status": "success",
            "message": "12-week forecast generated successfully.",
            "forecast": result_df.to_dict(orient="records"),
            "file_name": file.filename,
            "input_rows": len(filtered_df),
            "selected_product": selected_product,
            "trend": {
                "direction": direction,
                "change": round(delta, 2),
                "change_percent": round(pct_change, 2),
            },
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/forecast-demand/products")
async def forecast_demand_products(file: UploadFile = File(...)):
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Only CSV files allowed")

    contents = await file.read()
    try:
        df = pd.read_csv(io.BytesIO(contents))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not read CSV: {str(e)}")

    normalized_df = _normalize_columns(df)
    product_id_col = _resolve_first_column(normalized_df.columns, PRODUCT_ID_ALIASES)
    product_name_col = _resolve_first_column(normalized_df.columns, PRODUCT_NAME_ALIASES)

    if not product_id_col:
        return {
            "status": "success",
            "products": [],
            "message": "No product_id column found. Forecast will run on the full dataset.",
        }

    unique_df = normalized_df[[product_id_col] + ([product_name_col] if product_name_col else [])].dropna(subset=[product_id_col]).drop_duplicates()
    products = []
    for _, row in unique_df.iterrows():
        pid = str(row[product_id_col])
        pname = str(row[product_name_col]) if product_name_col and pd.notna(row[product_name_col]) else ""
        products.append({
            "product_id": pid,
            "product_name": pname,
            "label": f"{pid} - {pname}" if pname else pid,
        })

    return {
        "status": "success",
        "products": products,
    }

# --- UPDATED CHATBOT ENDPOINT ---
@app.post("/chatbot")
async def chat(request: dict):
    query = request.get("query", "")
    if not query:
        raise HTTPException(status_code=400, detail="Query is required")
    
    try:
        # Call the Groq AI model (Llama 3.3)
        chat_completion = client.chat.completions.create(
            messages=[
                {
                    "role": "system",
                    "content": "You are an expert electrical assistant for Iconic Transformers. Provide professional and helpful advice on industrial transformers and maintenance."
                },
                {
                    "role": "user",
                    "content": query,
                }
            ],
            model="llama-3.3-70b-versatile",
        )
        return {
            "status": "success", 
            "response": chat_completion.choices[0].message.content
        }
    except Exception as e:
        # Handle API errors gracefully
        return {
            "status": "error",
            "response": f"AI service error: {str(e)}"
        }