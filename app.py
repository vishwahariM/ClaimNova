import os
from datetime import datetime, timezone
from flask import Flask, render_template, request, jsonify
from flask_cors import CORS
from pymongo import MongoClient, errors, ASCENDING, DESCENDING

from config import Config
from services.ai_engine import AIEngine
from services.notification_service import NotificationService

app = Flask(__name__, template_folder='templates', static_folder='static')
CORS(app)

# Safe MongoDB Connection initialization
db = None
claims_collection = None
mongo_available = False

try:
    mongo_client = MongoClient(Config.MONGO_URI, serverSelectionTimeoutMS=2000)
    mongo_client.admin.command('ping')
    db = mongo_client['claimpulse']
    claims_collection = db['claims']
    mongo_available = True
    
    # Create indexes for optimal query performance
    claims_collection.create_index([("claim_id", ASCENDING)], unique=True)
    claims_collection.create_index([("created_at", DESCENDING)])
    claims_collection.create_index([("status", ASCENDING)])
    claims_collection.create_index([("risk", ASCENDING)])
    claims_collection.create_index([("priority", ASCENDING)])
    print("Successfully connected to MongoDB and verified indexes.")
except Exception as e:
    print(f"Warning: MongoDB connection failed ({e}). Operating in memory-fallback mode.")
    mongo_available = False
    in_memory_claims = []


def generate_claim_id():
    """Generates a sequential human-readable Claim ID like CP-00001."""
    if mongo_available:
        try:
            count = claims_collection.count_documents({}) + 1
            return f"CP-{count:05d}"
        except Exception:
            pass
    
    count = len(in_memory_claims) + 1 if 'in_memory_claims' in globals() else 1
    return f"CP-{count:05d}"


# ==========================================
# ROUTES
# ==========================================

@app.route('/')
def index():
    """Serves the main ClaimPulse application interface."""
    return render_template('index.html')


@app.route('/health', methods=['GET'])
def health_check():
    """Returns application health status and MongoDB connection status."""
    return jsonify({
        "status": "healthy",
        "mongodb_connected": mongo_available,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }), 200


@app.route('/ai-precheck', methods=['POST'])
def ai_precheck():
    """
    Executes instant AI Pre-Check analysis without saving to database.
    Used for pre-submission wizard inspection.
    """
    try:
        data = request.get_json() or {}
        claim_amount = data.get('claim_amount', 0)
        claim_type = data.get('claim_type', 'Health Insurance')
        documents = data.get('documents', [])

        analysis = AIEngine.analyze_claim(claim_amount, claim_type, documents)
        
        return jsonify({
            "success": True,
            "precheck": analysis
        }), 200
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 400


@app.route('/submit-claim', methods=['POST'])
def submit_claim():
    """
    Submits a new claim, performs complete AI analysis and document verification,
    stores record in MongoDB, and initializes activity timeline.
    """
    try:
        data = request.get_json() or {}
        
        customer_name = data.get('customer_name', '').strip()
        policy_number = data.get('policy_number', '').strip()
        claim_type = data.get('claim_type', '').strip()
        raw_claim_amount = data.get('claim_amount')
        incident_date = data.get('incident_date', '').strip()
        contact_number = data.get('contact_number', '').strip()
        documents = data.get('documents', [])
        
        if not (customer_name and policy_number and claim_type and raw_claim_amount and incident_date and contact_number):
            return jsonify({
                "success": False,
                "error": "Missing required fields. Please complete all fields before submitting."
            }), 400
            
        try:
            claim_amount = float(raw_claim_amount)
            if claim_amount <= 0:
                raise ValueError("Amount must be positive.")
        except (ValueError, TypeError):
            return jsonify({
                "success": False,
                "error": "Invalid claim amount. Please provide a valid numeric value."
            }), 400

        # Execute Modular Explainable AI Engine
        ai_result = AIEngine.analyze_claim(claim_amount, claim_type, documents)
        
        claim_id = generate_claim_id()
        created_at = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
        
        # Build initial activity timeline
        timeline = NotificationService.initial_timeline(
            claim_id, 
            ai_result["risk"], 
            ai_result["ai_recommendation"]
        )
        
        claim_record = {
            "claim_id": claim_id,
            "customer_name": customer_name,
            "policy_number": policy_number,
            "claim_type": claim_type,
            "claim_amount": claim_amount,
            "incident_date": incident_date,
            "contact_number": contact_number,
            "documents": documents,
            "required_documents": ai_result["required_documents"],
            "missing_documents": ai_result["missing_documents"],
            "risk": ai_result["risk"],
            "risk_score": ai_result["risk_score"],
            "claim_readiness": ai_result["claim_readiness"],
            "readiness_status": ai_result["readiness_status"],
            "exceptions": ai_result["exceptions"],
            "findings": ai_result["findings"],
            "contributing_factors": ai_result["contributing_factors"],
            "ai_recommendation": ai_result["ai_recommendation"],
            "next_best_action": ai_result["next_best_action"],
            "action_reason": ai_result["action_reason"],
            "priority": ai_result["priority"],
            "status": "Submitted",
            "current_stage": "AI Analysis Complete",
            "activity_timeline": timeline,
            "created_at": created_at,
            "updated_at": created_at
        }
        
        # Save to MongoDB or Fallback
        if mongo_available:
            try:
                claims_collection.insert_one(claim_record.copy())
            except Exception as mongo_err:
                print(f"MongoDB Insert Error: {mongo_err}")
                in_memory_claims.append(claim_record)
        else:
            in_memory_claims.append(claim_record)

        # Prepare JSON response
        response_payload = {
            "success": True,
            "message": "Claim submitted and analyzed successfully.",
            "claim_id": claim_id,
            "customer_name": customer_name,
            "policy_number": policy_number,
            "claim_type": claim_type,
            "claim_amount": claim_amount,
            "incident_date": incident_date,
            "contact_number": contact_number,
            "risk": ai_result["risk"],
            "risk_score": ai_result["risk_score"],
            "claim_readiness": ai_result["claim_readiness"],
            "readiness_status": ai_result["readiness_status"],
            "recommendation": ai_result["ai_recommendation"],
            "next_best_action": ai_result["next_best_action"],
            "exceptions": ai_result["exceptions"],
            "findings": ai_result["findings"],
            "contributing_factors": ai_result["contributing_factors"],
            "required_documents": ai_result["required_documents"],
            "missing_documents": ai_result["missing_documents"],
            "priority": ai_result["priority"],
            "status": "Submitted",
            "current_stage": "AI Analysis Complete",
            "created_at": created_at
        }
        
        return jsonify(response_payload), 201

    except Exception as e:
        return jsonify({
            "success": False,
            "error": f"An internal error occurred while processing claim: {str(e)}"
        }), 500


@app.route('/claims', methods=['GET'])
def get_all_claims():
    """
    Returns list of claims with support for search (`q`), filter (`risk`, `status`, `type`, `priority`),
    and sorting (`newest`, `highest_risk`, `highest_amount`, `priority`).
    """
    q = request.args.get('q', '').strip().lower()
    risk_filter = request.args.get('risk', '').strip().upper()
    status_filter = request.args.get('status', '').strip()
    type_filter = request.args.get('type', '').strip()
    priority_filter = request.args.get('priority', '').strip().upper()
    sort_by = request.args.get('sort', 'newest').strip().lower()

    claims_list = []
    
    if mongo_available:
        try:
            query = {}
            if risk_filter and risk_filter != 'ALL':
                query['risk'] = risk_filter
            if status_filter and status_filter != 'ALL':
                query['status'] = status_filter
            if type_filter and type_filter != 'ALL':
                query['claim_type'] = type_filter
            if priority_filter and priority_filter != 'ALL':
                query['priority'] = priority_filter
                
            cursor = claims_collection.find(query, {'_id': 0})
            claims_list = list(cursor)
        except Exception as e:
            print(f"MongoDB Find Error: {e}")
            claims_list = list(in_memory_claims)
    else:
        claims_list = list(in_memory_claims)

    if q:
        claims_list = [
            c for c in claims_list
            if q in c.get('claim_id', '').lower()
            or q in c.get('customer_name', '').lower()
            or q in c.get('policy_number', '').lower()
        ]

    if sort_by == 'highest_risk':
        claims_list.sort(key=lambda x: x.get('risk_score', 0), reverse=True)
    elif sort_by == 'highest_amount':
        claims_list.sort(key=lambda x: x.get('claim_amount', 0), reverse=True)
    elif sort_by == 'priority':
        prio_map = {'CRITICAL': 4, 'HIGH': 3, 'MEDIUM': 2, 'LOW': 1}
        claims_list.sort(key=lambda x: prio_map.get(x.get('priority', 'LOW'), 0), reverse=True)
    else:
        claims_list.sort(key=lambda x: x.get('created_at', ''), reverse=True)
        
    return jsonify({
        "success": True,
        "count": len(claims_list),
        "claims": claims_list
    }), 200


@app.route('/claim/<claim_id>', methods=['GET'])
def get_claim_by_id(claim_id):
    """Retrieves single claim details by Claim ID (e.g., CP-00001)."""
    target_id = claim_id.strip().upper()
    claim = None
    
    if mongo_available:
        try:
            claim = claims_collection.find_one({"claim_id": target_id}, {'_id': 0})
        except Exception as e:
            print(f"MongoDB Find One Error: {e}")
            
    if not claim and 'in_memory_claims' in globals():
        for c in in_memory_claims:
            if c.get("claim_id") == target_id:
                claim = c.copy()
                if '_id' in claim:
                    del claim['_id']
                break
                
    if not claim:
        return jsonify({
            "success": False,
            "error": f"Claim with ID '{target_id}' was not found in the system."
        }), 404
        
    return jsonify({
        "success": True,
        "claim": claim
    }), 200


@app.route('/officer-dashboard', methods=['GET'])
def officer_dashboard_data():
    """
    Computes Command Center analytics:
    - total_claims, pending_claims, high_risk_claims, approved_claims, rejected_claims, claims_requiring_docs, avg_readiness
    - Priority Review Queue (top 5 critical/high cases)
    - Full list of claims
    """
    claims_list = []
    
    if mongo_available:
        try:
            cursor = claims_collection.find({}, {'_id': 0}).sort('created_at', -1)
            claims_list = list(cursor)
        except Exception as e:
            print(f"MongoDB Dashboard Fetch Error: {e}")
            claims_list = list(in_memory_claims)
    else:
        claims_list = list(in_memory_claims)

    total_claims = len(claims_list)
    pending_claims = sum(1 for c in claims_list if c.get("status") in ["Submitted", "Under Review"])
    high_risk_claims = sum(1 for c in claims_list if c.get("risk") == "HIGH")
    approved_claims = sum(1 for c in claims_list if c.get("status") == "Approved")
    rejected_claims = sum(1 for c in claims_list if c.get("status") == "Rejected")
    claims_requiring_docs = sum(1 for c in claims_list if len(c.get("missing_documents", [])) > 0)

    readiness_sum = sum(c.get("claim_readiness", 80) for c in claims_list)
    avg_readiness = round(readiness_sum / total_claims, 1) if total_claims > 0 else 100.0

    priority_queue = [
        c for c in claims_list 
        if c.get("status") in ["Submitted", "Under Review"] and c.get("priority") in ["CRITICAL", "HIGH"]
    ]
    prio_order = {'CRITICAL': 2, 'HIGH': 1}
    priority_queue.sort(key=lambda x: prio_order.get(x.get('priority', ''), 0), reverse=True)

    return jsonify({
        "success": True,
        "stats": {
            "total_claims": total_claims,
            "pending_claims": pending_claims,
            "high_risk_claims": high_risk_claims,
            "approved_claims": approved_claims,
            "rejected_claims": rejected_claims,
            "claims_requiring_docs": claims_requiring_docs,
            "avg_readiness": avg_readiness
        },
        "priority_queue": priority_queue[:5],
        "claims": claims_list
    }), 200


@app.route('/claim/<claim_id>/decision', methods=['POST'])
def officer_decision(claim_id):
    """
    Executes officer decision on a claim ('Approved', 'Rejected', 'Under Review', 'Request Documents')
    Appends event to activity timeline and updates MongoDB.
    """
    target_id = claim_id.strip().upper()
    data = request.get_json() or {}
    decision = data.get('decision', '').strip()
    notes = data.get('notes', '').strip()
    
    if decision not in Config.ALLOWED_DECISIONS:
        return jsonify({
            "success": False,
            "error": f"Invalid decision value. Allowed: {', '.join(Config.ALLOWED_DECISIONS)}."
        }), 400

    now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    desc = f"Officer marked status as '{decision}'."
    if notes:
        desc += f" Notes: {notes}"
        
    timeline_event = NotificationService.create_event("OFFICER_DECISION", desc, actor="Claim Officer")

    new_status = decision
    if decision == "Request Documents":
        new_status = "Under Review"
        new_stage = "Document Verification"
    elif decision == "Approved":
        new_stage = "Resolution (Approved)"
    elif decision == "Rejected":
        new_stage = "Resolution (Rejected)"
    else: # Under Review
        new_stage = "Officer Review"

    updated = False
    if mongo_available:
        try:
            result = claims_collection.update_one(
                {"claim_id": target_id},
                {
                    "$set": {
                        "status": new_status, 
                        "current_stage": new_stage,
                        "updated_at": now_str
                    },
                    "$push": {
                        "activity_timeline": timeline_event
                    }
                }
            )
            if result.matched_count > 0:
                updated = True
        except Exception as e:
            print(f"MongoDB Update Error: {e}")

    if not updated and 'in_memory_claims' in globals():
        for c in in_memory_claims:
            if c.get("claim_id") == target_id:
                c["status"] = new_status
                c["current_stage"] = new_stage
                c["updated_at"] = now_str
                if "activity_timeline" not in c:
                    c["activity_timeline"] = []
                c["activity_timeline"].append(timeline_event)
                updated = True
                break

    if not updated:
        return jsonify({
            "success": False,
            "error": f"Claim with ID '{target_id}' not found."
        }), 404

    return jsonify({
        "success": True,
        "message": f"Claim {target_id} updated to '{new_status}'.",
        "claim_id": target_id,
        "new_status": new_status,
        "current_stage": new_stage
    }), 200


@app.route('/analytics', methods=['GET'])
def get_analytics():
    """
    Returns complete operational analytics and category breakdowns calculated dynamically from MongoDB.
    """
    claims_list = []
    if mongo_available:
        try:
            cursor = claims_collection.find({}, {'_id': 0})
            claims_list = list(cursor)
        except Exception as e:
            print(f"MongoDB Analytics Error: {e}")
            claims_list = list(in_memory_claims)
    else:
        claims_list = list(in_memory_claims)

    total = len(claims_list)
    
    # Categorical breakdown counts
    by_status = {"Submitted": 0, "Under Review": 0, "Approved": 0, "Rejected": 0}
    by_risk = {"LOW": 0, "MEDIUM": 0, "HIGH": 0}
    by_type = {"Health Insurance": 0, "Vehicle Insurance": 0, "Travel Insurance": 0, "Property Insurance": 0}
    
    total_claim_amount = 0.0
    missing_doc_cnt = 0
    readiness_sum = 0.0

    for c in claims_list:
        st = c.get("status", "Submitted")
        if st in by_status:
            by_status[st] += 1
        else:
            by_status[st] = 1

        rk = c.get("risk", "MEDIUM")
        if rk in by_risk:
            by_risk[rk] += 1
        else:
            by_risk[rk] = 1

        tp = c.get("claim_type", "Health Insurance")
        if tp in by_type:
            by_type[tp] += 1
        else:
            by_type[tp] = 1

        try:
            total_claim_amount += float(c.get("claim_amount", 0))
        except (ValueError, TypeError):
            pass

        if len(c.get("missing_documents", [])) > 0:
            missing_doc_cnt += 1

        readiness_sum += float(c.get("claim_readiness", 80))

    avg_readiness = round(readiness_sum / total, 1) if total > 0 else 100.0
    high_risk_cnt = by_risk.get("HIGH", 0)
    approved_cnt = by_status.get("Approved", 0)

    return jsonify({
        "success": True,
        "analytics": {
            "total_processed": total,
            "total_claim_amount": total_claim_amount,
            "high_risk_pct": round((high_risk_cnt / total * 100), 1) if total > 0 else 0,
            "avg_readiness_pct": avg_readiness,
            "missing_doc_rate_pct": round((missing_doc_cnt / total * 100), 1) if total > 0 else 0,
            "approval_rate_pct": round((approved_cnt / total * 100), 1) if total > 0 else 0,
            "by_status": by_status,
            "by_risk": by_risk,
            "by_type": by_type
        }
    }), 200


if __name__ == '__main__':
    print(f"Starting ClaimPulse Modular Flask Server on http://127.0.0.1:{Config.PORT}")
    app.run(host='0.0.0.0', port=Config.PORT, debug=Config.DEBUG)
