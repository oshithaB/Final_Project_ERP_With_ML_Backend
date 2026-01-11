import os

def check_env():
    print("Starting ML Retraining Process...")

def run_pl_training():
    print("\n--- Training P&L Model ---")
    os.system("python train_pl.py")

def run_insights_training():
    print("\n--- Training Insights Models (Products, Customers, Employees) ---")
    os.system("python train_insights.py")

if __name__ == "__main__":
    check_env()
    # Ensure directories exist
    os.makedirs(os.path.join(os.path.dirname(os.path.dirname(__file__)), 'models'), exist_ok=True)
    os.makedirs(os.path.join(os.path.dirname(os.path.dirname(__file__)), 'outputs'), exist_ok=True)
    
    run_pl_training()
    run_insights_training()
    
    print("\nRetraining Process Complete.")
    print("New models saved to 'models/' directory.")
    print("New predictions saved to 'outputs/' directory.")

