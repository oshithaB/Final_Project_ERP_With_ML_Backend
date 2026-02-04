import os
import json
import warnings
import pandas as pd
import numpy as np
import joblib
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error

# Ignore warnings
warnings.filterwarnings('ignore')

from db_extractor import get_db_connection, fetch_invoices, fetch_expenses, fetch_bills, fetch_invoice_items

def prep_daily_pl_data():
    conn = get_db_connection()
    try:
        invoices = fetch_invoices(conn)
        expenses = fetch_expenses(conn)
        bills = fetch_bills(conn)
        invoice_items = fetch_invoice_items(conn)
    finally:
        conn.close()

    if invoices.empty:
        print("No invoices found. Cannot train P&L model.")
        return pd.DataFrame()

    # Convert dates and normalize to daily
    invoices['invoice_date'] = pd.to_datetime(invoices['invoice_date']).dt.normalize()
    revenue_df = invoices.groupby('invoice_date')['total_amount'].sum().reset_index()
    revenue_df.rename(columns={'invoice_date': 'date', 'total_amount': 'revenue'}, inplace=True)

    costs_list = []
    
    if not expenses.empty:
        expenses['payment_date'] = pd.to_datetime(expenses['payment_date']).dt.normalize()
        exp_df = expenses.groupby('payment_date')['amount'].sum().reset_index()
        exp_df.rename(columns={'payment_date': 'date', 'amount': 'costs'}, inplace=True)
        costs_list.append(exp_df)
        
    if not bills.empty:
        bills['bill_date'] = pd.to_datetime(bills['bill_date']).dt.normalize()
        bill_df = bills.groupby('bill_date')['total_amount'].sum().reset_index()
        bill_df.rename(columns={'bill_date': 'date', 'total_amount': 'costs'}, inplace=True)
        costs_list.append(bill_df)

    if costs_list:
        costs_df = pd.concat(costs_list).groupby('date')['costs'].sum().reset_index()
    else:
        costs_df = pd.DataFrame(columns=['date', 'costs'])

    # COGS from invoice_items
    if not invoice_items.empty and not invoices.empty:
        invoices_dates = invoices[['id', 'invoice_date']].rename(columns={'invoice_date': 'date'})
        inv_items_merged = pd.merge(invoice_items, invoices_dates, left_on='invoice_id', right_on='id')
        inv_items_merged['cogs'] = inv_items_merged['quantity'] * inv_items_merged['cost_price']
        cogs_df = inv_items_merged.groupby('date')['cogs'].sum().reset_index()
        
        costs_df = pd.merge(costs_df, cogs_df, on='date', how='outer').fillna(0)
        costs_df['costs'] = costs_df['costs'] + costs_df['cogs']
        costs_df.drop(columns=['cogs'], inplace=True)

    # Merge Revenue and Costs
    daily_df = pd.merge(revenue_df, costs_df, on='date', how='outer').fillna(0)
    
    # Fill missing dates to make it a continuous daily time series
    if not daily_df.empty:
        min_date = daily_df['date'].min()
        max_date = daily_df['date'].max()
        all_dates = pd.date_range(start=min_date, end=max_date, freq='D')
        daily_df = daily_df.set_index('date').reindex(all_dates).fillna(0).reset_index()
        daily_df.rename(columns={'index': 'date'}, inplace=True)

    daily_df['net_profit'] = daily_df['revenue'] - daily_df['costs']
    daily_df = daily_df.sort_values('date').reset_index(drop=True)

    if len(daily_df) < 30: 
        print(f"Not enough data to train Daily P&L model. Found {len(daily_df)} days.")
        return daily_df

    # Feature Engineering
    daily_df['day_of_week'] = daily_df['date'].dt.dayofweek
    daily_df['day_of_month'] = daily_df['date'].dt.day
    daily_df['month'] = daily_df['date'].dt.month
    
    # Lag features
    daily_df['revenue_lag1'] = daily_df['revenue'].shift(1).fillna(0)
    daily_df['revenue_lag7'] = daily_df['revenue'].shift(7).fillna(0)
    daily_df['costs_lag1'] = daily_df['costs'].shift(1).fillna(0)
    daily_df['costs_lag7'] = daily_df['costs'].shift(7).fillna(0)

    daily_df = daily_df.dropna().reset_index(drop=True)

    return daily_df

def train_and_predict(df):
    if df.empty or len(df) < 30:
        return

    features = ['day_of_week', 'day_of_month', 'month', 'revenue_lag1', 'revenue_lag7', 'costs_lag1', 'costs_lag7']
    
    X = df[features]
    y_rev = df['revenue']
    y_cost = df['costs']

    split_idx = int(len(df) * 0.8)
    if split_idx == 0:
        split_idx = 1
    
    X_train, X_test = X.iloc[:split_idx], X.iloc[split_idx:]
    y_rev_train, y_rev_test = y_rev.iloc[:split_idx], y_rev.iloc[split_idx:]
    y_cost_train, y_cost_test = y_cost.iloc[:split_idx], y_cost.iloc[split_idx:]

    model_rev = RandomForestRegressor(n_estimators=100, random_state=42)
    model_cost = RandomForestRegressor(n_estimators=100, random_state=42)

    model_rev.fit(X_train, y_rev_train)
    model_cost.fit(X_train, y_cost_train)

    rev_mae = mean_absolute_error(y_rev_test, model_rev.predict(X_test))
    cost_mae = mean_absolute_error(y_cost_test, model_cost.predict(X_test))

    print(f"Revenue MAE: {rev_mae:.2f}")
    print(f"Costs MAE: {cost_mae:.2f}")

    # Generate 365 days of future data
    future_dates = pd.date_range(start=df['date'].max() + pd.DateOffset(days=1), periods=365, freq='D')
    
    # We need to iteratively predict day by day so we can use the prediction as the next day's lag
    # We'll use a rolling window of history
    history = df.tail(14).copy()
    
    predictions = []

    for date in future_dates:
        # Construct current features
        last_row = history.iloc[-1]
        lag7_row = history.iloc[-7]
        
        current_features = pd.DataFrame([{
            'day_of_week': date.dayofweek,
            'day_of_month': date.day,
            'month': date.month,
            'revenue_lag1': last_row['revenue'],
            'revenue_lag7': lag7_row['revenue'],
            'costs_lag1': last_row['costs'],
            'costs_lag7': lag7_row['costs']
        }])
        
        pred_rev = max(0, float(model_rev.predict(current_features)[0]))
        pred_cost = max(0, float(model_cost.predict(current_features)[0]))
        
        # Calculate daily net profit exactly matching standard formula
        pred_profit = pred_rev - pred_cost
        
        predictions.append({
            'date': date.strftime('%Y-%m-%d'),
            'predicted_revenue': pred_rev,
            'predicted_costs': pred_cost,
            'predicted_profit': pred_profit
        })
        
        # Append to history, pop oldest to save memory
        new_row = pd.DataFrame([{
            'date': date,
            'revenue': pred_rev,
            'costs': pred_cost,
            'net_profit': pred_profit,
            'day_of_week': date.dayofweek,
            'day_of_month': date.day,
            'month': date.month,
            'revenue_lag1': last_row['revenue'],
            'revenue_lag7': lag7_row['revenue'],
            'costs_lag1': last_row['costs'],
            'costs_lag7': lag7_row['costs']
        }])
        
        history = pd.concat([history, new_row], ignore_index=True)
        history = history.iloc[1:]

    # Save out the massive Daily JSON array
    out_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'outputs')
    os.makedirs(out_dir, exist_ok=True)
    
    # Save the models
    models_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'models')
    os.makedirs(models_dir, exist_ok=True)
    
    joblib.dump(model_rev, os.path.join(models_dir, 'sales_model.joblib'))
    joblib.dump(model_cost, os.path.join(models_dir, 'costs_model.joblib'))
    
    pl_data = {
        'metadata': {
            'revenue_mae': rev_mae,
            'costs_mae': cost_mae,
            'last_trained': pd.Timestamp.now().isoformat()
        },
        'daily_forecasts': predictions
    }
    
    with open(os.path.join(out_dir, 'pl_predictions.json'), 'w') as f:
        json.dump(pl_data, f, indent=4)
        
    print("365-Day Daily Forecast successfully saved to pl_predictions.json.")
    print("Models successfully saved to models/.joblib files.")

if __name__ == "__main__":
    print("Prepping daily P&L ML Data...")
    df = prep_daily_pl_data()
    print("Training models and predicting 365 future days...")
    train_and_predict(df)


