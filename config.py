import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/")
    PORT = int(os.getenv("PORT", 5000))
    DEBUG = os.getenv("DEBUG", "True").lower() in ["true", "1", "t"]
    
    # Document Requirements by Policy Type
    REQUIRED_DOCUMENTS = {
        "Vehicle Insurance": ["Driving License", "Vehicle RC", "FIR / Incident Report"],
        "Health Insurance": ["Medical Bill", "Discharge Summary", "ID Proof"],
        "Travel Insurance": ["Ticket", "Travel Proof", "Incident Report"],
        "Property Insurance": ["Property Document", "Damage Proof", "Incident Report"]
    }
    
    # Risk Weight Factors
    HIGH_AMOUNT_THRESHOLD = 100000
    MEDIUM_AMOUNT_THRESHOLD = 50000
    
    HIGH_AMOUNT_POINTS = 30
    MEDIUM_AMOUNT_POINTS = 15
    
    CLAIM_TYPE_POINTS = {
        "Vehicle Insurance": 10,
        "Property Insurance": 10,
        "Health Insurance": 5,
        "Travel Insurance": 5
    }
    
    MISSING_DOC_PENALTY_POINTS = 10
    
    # Allowed Decisions
    ALLOWED_DECISIONS = ["Approved", "Rejected", "Under Review", "Request Documents"]
