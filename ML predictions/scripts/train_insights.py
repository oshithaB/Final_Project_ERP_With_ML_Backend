import os
import json
import warnings
import pandas as pd
import numpy as np
from datetime import timedelta
import joblib
from sklearn.cluster import KMeans
from db_extractor import get_db_connection, fetch_invoices, fetch_invoice_items, fetch_products, fetch_customers, fetch_employees

warnings.filterwarnings('ignore')

def calc_temporal(df, date_col, id_col, value_col):
    if df.empty: return pd.DataFrame()
    df[date_col] = pd.to_datetime(df[date_col]).dt.tz_localize(None)
    max_date = df[date_col].max()
    
    r90_start = max_date - timedelta(days=90)
    p90_start = r90_start - timedelta(days=90)
    
    recent = df[df[date_col] >= r90_start].groupby(id_col).agg(r_count=(id_col, 'count'), r_val=(value_col, 'sum')).reset_index()
    prev = df[(df[date_col] >= p90_start) & (df[date_col] < r90_start)].groupby(id_col).agg(p_count=(id_col, 'count'), p_val=(value_col, 'sum')).reset_index()
    
    m = pd.merge(prev, recent, on=id_col, how='outer').fillna(0)
    m['change'] = m['r_val'] - m['p_val']
    m['velocity_pct'] = np.where(m['p_val'] > 0, (m['r_val'] - m['p_val']) / m['p_val'] * 100, np.where(m['r_val'] > 0, 100, 0))
    return m

def train_and_generate_insights():
    conn = get_db_connection()
    try:
        invoices = fetch_invoices(conn)
        invoice_items = fetch_invoice_items(conn)
        products = fetch_products(conn)
        customers = fetch_customers(conn)
        employees = fetch_employees(conn)
    finally:
        conn.close()

    out_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'outputs')
    os.makedirs(out_dir, exist_ok=True)

    insights = {
        'products': {},
        'customers': {},
        'employees': {}
    }

    # 1. Product Velocity & Trending
    if not products.empty and not invoice_items.empty and not invoices.empty:
        inv_dates = invoices[['id', 'invoice_date']].rename(columns={'id': 'invoice_id'})
        items_dates = pd.merge(invoice_items, inv_dates, on='invoice_id')
        items_dates['total_sale'] = items_dates['quantity'] * items_dates['actual_unit_price']
        
        prod_trend = calc_temporal(items_dates, 'invoice_date', 'product_id', 'total_sale')
        prod_df = pd.merge(products, prod_trend, left_on='id', right_on='product_id', how='left').fillna(0)
        
        name_col = 'product_name' if 'product_name' in prod_df.columns else 'name'
        
        heroes = prod_df.nlargest(10, 'r_val')
        trending_up = prod_df[(prod_df['velocity_pct'] > 20) & (prod_df['p_val'] > 1000)].nlargest(10, 'velocity_pct')
        trending_down = prod_df[(prod_df['velocity_pct'] < -20) & (prod_df['p_val'] > 1000)].nsmallest(10, 'velocity_pct')

        insights['products'] = {
            'hero_products': heroes[[name_col, 'r_val', 'velocity_pct']].to_dict('records'),
            'trending_up': trending_up[[name_col, 'velocity_pct', 'change']].to_dict('records'),
            'trending_down': trending_down[[name_col, 'velocity_pct', 'change']].to_dict('records')
        }

    # 2. Customer VIP & Churn Detection
    if not customers.empty and not invoices.empty:
        cust_trend = calc_temporal(invoices, 'invoice_date', 'customer_id', 'total_amount')
        cust_df = pd.merge(customers, cust_trend, left_on='id', right_on='customer_id', how='left').fillna(0)
        
        name_col = 'customer_name' if 'customer_name' in cust_df.columns else 'name'
        
        vips = cust_df.nlargest(10, 'r_val')
        # Churn risk: High past spend, huge drop in recent velocity
        churn_risk = cust_df[(cust_df['p_val'] > 5000) & (cust_df['velocity_pct'] < -50)].nsmallest(10, 'velocity_pct')
        
        insights['customers'] = {
            'vip_customers': vips[[name_col, 'r_val', 'velocity_pct']].to_dict('records'),
            'churn_risk': churn_risk[[name_col, 'p_val', 'r_val', 'velocity_pct']].to_dict('records')
        }

    # 3. Employee Performance Anomalies
    if not employees.empty and not invoices.empty:
        emp_trend = calc_temporal(invoices, 'invoice_date', 'employee_id', 'total_amount')
        emp_df = pd.merge(employees, emp_trend, left_on='id', right_on='employee_id', how='left').fillna(0)
        
        name_col = 'employee_name' if 'employee_name' in emp_df.columns else 'name'
        
        top_sellers = emp_df.nlargest(5, 'r_val')
        slowing_down = emp_df[(emp_df['p_val'] > 10000) & (emp_df['velocity_pct'] < -20)].nsmallest(5, 'velocity_pct')
        
        insights['employees'] = {
            'top_sellers': top_sellers[[name_col, 'r_val', 'velocity_pct']].to_dict('records'),
            'slowing_down': slowing_down[[name_col, 'p_val', 'r_val', 'velocity_pct']].to_dict('records')
        }

    with open(os.path.join(out_dir, 'ml_insights.json'), 'w') as f:
        json.dump(insights, f, indent=4)
        
    print("Advanced Churn & Temporal AI Analytics saved to ml_insights.json")

if __name__ == "__main__":
    train_and_generate_insights()



