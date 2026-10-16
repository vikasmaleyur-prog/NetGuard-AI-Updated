import os

from dotenv import load_dotenv
from pymongo import MongoClient
import certifi

load_dotenv()

MONGODB_URI = os.getenv("MONGODB_URI")

if not MONGODB_URI:
    raise RuntimeError("MONGODB_URI is not set in .env")

client = MongoClient(
    MONGODB_URI,
    tlsCAFile=certifi.where()
)

database = client["netguard"]

monitoring_collection = database["monitoring"]


def test_connection():
    client.admin.command("ping")
    return True


def save_metrics(metrics):
    document = {
        "metrics": metrics
    }

    result = monitoring_collection.insert_one(document)

    return str(result.inserted_id)