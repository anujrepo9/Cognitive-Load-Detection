import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL               = os.getenv("DATABASE_URL", "sqlite:///./cogniload.db")
SECRET_KEY                 = os.getenv("SECRET_KEY", "dev-secret-change-me")
ALGORITHM                  = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 1440))
MODEL_PATH                 = os.getenv("MODEL_PATH", "ml/saved_models/model.joblib")
CORS_ORIGINS               = os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
