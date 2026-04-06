import React, { useState, useRef } from 'react';
import { Upload, Activity, TrendingUp, AlertTriangle, CheckCircle } from 'lucide-react';

const AITools = () => {
  const [maintenanceResult, setMaintenanceResult] = useState(null);
  const [forecastResult, setForecastResult] = useState(null);
  const [forecastMeta, setForecastMeta] = useState(null);
  const [availableProducts, setAvailableProducts] = useState([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [loadingProducts, setLoadingProducts] = useState(false);

  const [maintenanceFileName, setMaintenanceFileName] = useState('');
  const [forecastFileName, setForecastFileName] = useState('');

  const maintenanceFileInputRef = useRef(null);
  const forecastFileInputRef = useRef(null);

  const handleMaintenanceUpload = async (e) => {
    e.preventDefault();
    const file = maintenanceFileInputRef.current?.files[0];
    if (!file) {
      alert('Please select a file first.');
      return;
    }

    setMaintenanceFileName(file.name);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('http://localhost:8000/predict-maintenance', {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      if (data.status === 'success') {
        setMaintenanceResult({
          status: data.prediction.health,
          risk: data.prediction.risk_level,
          timeline: data.prediction.time_window,
        });
      } else {
        alert('Error from server: ' + (data.detail || JSON.stringify(data)));
      }
    } catch (err) {
      alert('Failed to connect to ML service: ' + err);
    }
  };

  const handleForecastUpload = async (e) => {
    e.preventDefault();
    const file = forecastFileInputRef.current?.files[0];
    if (!file) {
      alert('Please select a file first.');
      return;
    }
    if (availableProducts.length > 1 && !selectedProductId) {
      alert('Please select a product from the dropdown before running analysis.');
      return;
    }

    setForecastFileName(file.name);

    const formData = new FormData();
    formData.append('file', file);
    if (selectedProductId) {
      formData.append('product_id', selectedProductId);
    }

    try {
      const response = await fetch('http://localhost:8000/forecast-demand', {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      if (data.status === 'success') {
        setForecastResult(data.forecast || []);
        setForecastMeta({
          trend: data.trend,
          selectedProduct: data.selected_product,
        });
      } else {
        alert('Error from server: ' + (data.detail || JSON.stringify(data)));
      }
    } catch (err) {
      alert('Failed to connect to ML service: ' + err);
    }
  };

  const handleDemandFileSelected = async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setForecastFileName(file.name);
    setForecastResult(null);
    setForecastMeta(null);
    setAvailableProducts([]);
    setSelectedProductId('');
    setLoadingProducts(true);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('http://localhost:8000/forecast-demand/products', {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      if (data.status === 'success') {
        const products = data.products || [];
        setAvailableProducts(products);
        if (products.length === 1) {
          setSelectedProductId(products[0].product_id);
        }
      } else {
        alert('Error from server: ' + (data.detail || JSON.stringify(data)));
      }
    } catch (err) {
      alert('Failed to analyze products from CSV: ' + err);
    } finally {
      setLoadingProducts(false);
    }
  };

  const downloadDemandTemplate = () => {
    const templateContent = ['ds,y', '2023-01-01,100', '2023-01-08,110', '2023-01-15,125'].join('\n');
    const blob = new Blob([templateContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'demand_forecast_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-brand-light min-h-screen py-24">
      <div className="container mx-auto px-6 max-w-7xl">
        <h1 className="text-5xl font-bold mb-12 text-brand-dark text-center">AI Intelligence Suite</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          {/* Predictive Maintenance Model */}
          <div className="bg-white rounded-3xl p-10 shadow-xl border border-gray-100 flex flex-col">
            <div className="flex items-center mb-8">
              <div className="p-4 bg-blue-50 text-brand-accent rounded-2xl mr-4">
                <Activity className="w-8 h-8" />
              </div>
              <h2 className="text-3xl font-bold text-brand-dark">Predictive Maintenance</h2>
            </div>
            <p className="text-brand-grey mb-8">
              Upload transformer telemetry data (vibration, temperature, load levels, etc.) to get an AI-powered health
              prediction for the next 30 days. Uses a Random Forest Classifier trained on years of operational history.
            </p>

            <form
              onSubmit={handleMaintenanceUpload}
              className="mb-8 p-6 border-2 border-dashed border-gray-300 rounded-2xl bg-gray-50 flex flex-col items-center justify-center text-center"
            >
              <Upload className="w-10 h-10 text-brand-grey mb-4" />
              <p className="font-bold text-brand-dark mb-2">Upload Telemetry CSV File</p>
              <p className="text-sm text-brand-grey mb-2">Max file size 10MB</p>
              {maintenanceFileName && (
                <p className="text-xs text-brand-dark mb-4">
                  Selected file: <span className="font-semibold">{maintenanceFileName}</span>
                </p>
              )}
              <input ref={maintenanceFileInputRef} type="file" accept=".csv" className="hidden" />
              <button
                type="button"
                onClick={() => maintenanceFileInputRef.current?.click()}
                className="bg-white border border-gray-300 text-brand-dark px-6 py-2 rounded-lg font-bold hover:bg-gray-50 transition-colors"
              >
                Select File
              </button>
              <button
                type="submit"
                className="mt-6 w-full bg-brand-accent text-white py-3 rounded-xl font-bold hover:bg-blue-600 transition-colors"
              >
                Run AI Analysis
              </button>
            </form>

            {maintenanceResult && (
              <div className="mt-auto bg-red-50 border border-red-200 p-6 rounded-2xl">
                <div className="flex items-start">
                  <AlertTriangle className="w-6 h-6 text-red-500 mr-3 mt-1" />
                  <div>
                    <h3 className="font-bold text-red-700 text-lg mb-2">Prediction: {maintenanceResult.status}</h3>
                    <p className="text-red-600 text-sm mb-1">
                      Risk Level: <span className="font-bold">{maintenanceResult.risk}</span>
                    </p>
                    <p className="text-red-600 text-sm">
                      Estimated Timeline: <span className="font-bold">{maintenanceResult.timeline}</span>
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Demand Forecasting */}
          <div className="bg-white rounded-3xl p-10 shadow-xl border border-gray-100 flex flex-col">
            <div className="flex items-center mb-8">
              <div className="p-4 bg-green-50 text-green-600 rounded-2xl mr-4">
                <TrendingUp className="w-8 h-8" />
              </div>
              <h2 className="text-3xl font-bold text-brand-dark">Demand Forecasting</h2>
            </div>
            <p className="text-brand-grey mb-8">
              Utilize our Prophet Time Series model to predict transformer and service demand over the next 12 weeks.
              Better inventory planning, optimized production, based on historical and seasonal trends.
            </p>
            <div className="mb-6 p-4 bg-green-50 border border-green-100 rounded-xl">
              <p className="text-sm text-brand-dark mb-2">
                CSV format: <span className="font-semibold">ds,y</span> (or aliases like <span className="font-semibold">date,units</span>)
              </p>
              <button
                type="button"
                onClick={downloadDemandTemplate}
                className="text-sm font-semibold text-green-700 hover:text-green-800 hover:underline"
              >
                Download sample CSV template
              </button>
            </div>

            <form
              onSubmit={handleForecastUpload}
              className="mb-8 p-6 border-2 border-dashed border-gray-300 rounded-2xl bg-gray-50 flex flex-col items-center justify-center text-center"
            >
              <Upload className="w-10 h-10 text-brand-grey mb-4" />
              <p className="font-bold text-brand-dark mb-2">Upload Historical Demand Data</p>
              <p className="text-sm text-brand-grey mb-2">Requires CSV with Date & Units format</p>
              {forecastFileName && (
                <p className="text-xs text-brand-dark mb-4">
                  Selected file: <span className="font-semibold">{forecastFileName}</span>
                </p>
              )}
              <input
                ref={forecastFileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleDemandFileSelected}
              />
              <button
                type="button"
                onClick={() => forecastFileInputRef.current?.click()}
                className="bg-white border border-gray-300 text-brand-dark px-6 py-2 rounded-lg font-bold hover:bg-gray-50 transition-colors"
              >
                Select File
              </button>
              {loadingProducts && <p className="text-xs text-brand-grey mt-3">Analyzing products from CSV...</p>}
              {!loadingProducts && availableProducts.length > 0 && (
                <div className="w-full mt-4 text-left">
                  <label htmlFor="productSelect" className="block text-sm font-semibold text-brand-dark mb-2">
                    Select Product for Analysis
                  </label>
                  <select
                    id="productSelect"
                    value={selectedProductId}
                    onChange={(event) => setSelectedProductId(event.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="">Choose a product</option>
                    {availableProducts.map((product) => (
                      <option key={product.product_id} value={product.product_id}>
                        {product.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <button
                type="submit"
                className="mt-6 w-full bg-brand-dark text-white py-3 rounded-xl font-bold hover:bg-gray-800 transition-colors"
              >
                Generate 12-Week Forecast
              </button>
            </form>

            {forecastResult && Array.isArray(forecastResult) && forecastResult.length > 0 && (
              <div className="mt-auto bg-green-50 border border-green-200 p-6 rounded-2xl">
                <div className="text-center mb-4">
                  <CheckCircle className="w-10 h-10 text-green-500 mx-auto mb-2" />
                  <p className="font-bold text-green-700 text-lg">12-Week Forecast Generated</p>
                  <p className="text-sm text-green-600 mt-1">Showing upcoming demand trend.</p>
                </div>
                {forecastMeta?.selectedProduct && (
                  <p className="text-sm text-green-700 text-center mb-2">
                    Product analyzed: <span className="font-semibold">
                      {forecastMeta.selectedProduct.product_name
                        ? `${forecastMeta.selectedProduct.product_id} - ${forecastMeta.selectedProduct.product_name}`
                        : forecastMeta.selectedProduct.product_id}
                    </span>
                  </p>
                )}
                {forecastMeta?.trend && (
                  <p className="text-sm text-green-700 text-center mb-4">
                    Demand is expected to <span className="font-semibold">{forecastMeta.trend.direction}</span> by{' '}
                    <span className="font-semibold">{forecastMeta.trend.change}</span> units (
                    <span className="font-semibold">{forecastMeta.trend.change_percent}%</span>) over the forecast window.
                  </p>
                )}
                <div className="max-h-64 overflow-y-auto">
                  <table className="w-full text-sm text-left">
                    <thead>
                      <tr className="text-brand-dark border-b border-green-200">
                        <th className="py-2 pr-4">Week</th>
                        <th className="py-2 pr-4 text-right">Forecast</th>
                        <th className="py-2 pr-4 text-right">Low</th>
                        <th className="py-2 text-right">High</th>
                      </tr>
                    </thead>
                    <tbody>
                      {forecastResult.map((row, index) => (
                        <tr key={index} className="border-b border-green-100 last:border-0">
                          <td className="py-2 pr-4 text-brand-dark">{row.ds}</td>
                          <td className="py-2 pr-4 text-right text-green-700 font-medium">
                            {row.yhat?.toFixed ? row.yhat.toFixed(2) : row.yhat}
                          </td>
                          <td className="py-2 pr-4 text-right text-green-600">
                            {row.yhat_lower?.toFixed ? row.yhat_lower.toFixed(2) : row.yhat_lower}
                          </td>
                          <td className="py-2 text-right text-green-600">
                            {row.yhat_upper?.toFixed ? row.yhat_upper.toFixed(2) : row.yhat_upper}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AITools;

