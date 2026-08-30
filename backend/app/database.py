from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base
from sqlalchemy.orm import sessionmaker
import os

# Sicherstellen, dass der Zielordner für die SQLite-Datei existiert,
# bevor die Engine versucht, sie zu öffnen - nötig sowohl für lokale
# Ausführung als auch als Absicherung außerhalb von Docker.
os.makedirs("data", exist_ok=True)

SQLALCHEMY_DATABASE_URL = "sqlite:///./data/lieferantenportal.db"

# engine = eigentliche DB-Verbindung (Treiber) => Übersetzt Python-Aufrufe in SQL für SQLite
engine = create_engine(
    SQLALCHEMY_DATABASE_URL, 
    connect_args={"check_same_thread": False} 
    # nötig da FastAPI multithreaded =>  SQLite erlaubt sonst nur Zugriff aus dem Thread, der verbunden hat
)

# SessionLocal = Fabrik für neue DB-Sessions (nicht die Session selbst)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base = Basisklasse, von der alle Models (Inventory, Order, ...) erben
# SQLAlchemy erkennt daran, welche Python-Klassen zu DB-Tabellen werden
Base = declarative_base()

# Wird in den Routes benutzt um eine DB-Verbindung zu bekommen
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()