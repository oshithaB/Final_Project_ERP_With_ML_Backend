import os
import mysql.connector
import pandas as pd
from dotenv import load_dotenv

def get_db_connection():
    # Load environment variables from the parent directory's .env file
    env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), '.env')
    if os.path.exists(env_path):
        load_dotenv(dotenv_path=env_path)
    else:
        load_dotenv()
    
    return mysql.connector.connect(
        host=os.getenv('DB_HOST', 'localhost'),
        port=int(os.getenv('DB_PORT', 3306)),
        user=os.getenv('DB_USER', 'root'),
        password=os.getenv('DB_PASSWORD', ''),
        database=os.getenv('DB_NAME', 'powerkey_erp')
    )

def fetch_invoices(conn):
    query = "SELECT * FROM invoices WHERE status != 'proforma'"
    return pd.read_sql(query, conn)

def fetch_invoice_items(conn):
    query = "SELECT * FROM invoice_items"
    return pd.read_sql(query, conn)

def fetch_expenses(conn):
    query = "SELECT * FROM expenses"
    return pd.read_sql(query, conn)

def fetch_bills(conn):
    query = "SELECT * FROM bills WHERE status != 'cancelled'"
    try:
        return pd.read_sql(query, conn)
    except Exception:
        query = "SELECT * FROM bills"
        return pd.read_sql(query, conn)

def fetch_products(conn):
    query = "SELECT * FROM products"
    return pd.read_sql(query, conn)

def fetch_customers(conn):
    query = "SELECT * FROM customer"
    return pd.read_sql(query, conn)

def fetch_employees(conn):
    query = "SELECT * FROM employees"
    try:
        return pd.read_sql(query, conn)
    except Exception as e:
        print(f"Error fetching employees: {e}")
        return pd.DataFrame()

def extract_all_data():
    conn = get_db_connection()
    data = {}
    try:
        data['invoices'] = fetch_invoices(conn)
        data['invoice_items'] = fetch_invoice_items(conn)
        
        # We will try to fetch each table, safely handling missing tables/columns
        try:
            data['expenses'] = fetch_expenses(conn)
        except Exception:
            data['expenses'] = pd.DataFrame()
            
        try:
            data['bills'] = fetch_bills(conn)
        except Exception:
            data['bills'] = pd.DataFrame()
            
        try:
            data['products'] = fetch_products(conn)
        except Exception:
            data['products'] = pd.DataFrame()
            
        try:
            data['customers'] = fetch_customers(conn)
        except Exception:
            data['customers'] = pd.DataFrame()
            
        try:
            data['employees'] = fetch_employees(conn)
        except Exception:
            data['employees'] = pd.DataFrame()
            
    finally:
        conn.close()
    
    return data

if __name__ == "__main__":
    data = extract_all_data()
    print("Database connection successful. Data shape:")
    for k, v in data.items():
        if not v.empty:
            print(f"{k}: {v.shape}")
        else:
            print(f"{k}: Empty / Failed")
