import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://localhost/backtest_copilot")

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    """FastAPI dependency — provides a DB session per request, closes it after."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()