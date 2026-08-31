from services.document_engine import DocumentEngine
from services.risk_engine import RiskEngine
from config import Config

class AIEngine:
    """
    Explainable Rule-Based AI Decision & Orchestration Engine.
    Combines document evaluation, risk scoring, exception detection,
    next-best action recommendation, and queue prioritization.
    """
    
    @staticmethod
    def analyze_claim(claim_amount, claim_type, submitted_documents):
        """
        Runs the end-to-end claim analysis pipeline.
        Returns complete analysis payload.
        """
        # 1. Run Document Engine
        doc_result = DocumentEngine.verify_documents(claim_type, submitted_documents)
        required_docs = doc_result["required_documents"]
        missing_docs = doc_result["missing_documents"]
        
        # 2. Run Risk Engine
        risk_result = RiskEngine.evaluate_risk(claim_amount, claim_type, missing_docs)
        risk_score = risk_result["risk_score"]
        risk_level = risk_result["risk_level"]
        readiness_score = risk_result["claim_readiness"]
        readiness_status = risk_result["readiness_status"]
        findings = risk_result["findings"]
        contributing_factors = risk_result["contributing_factors"]

        # 3. Exception Engine Analysis
        exceptions = list(doc_result["exceptions"])
        
        try:
            amount = float(claim_amount)
        except (ValueError, TypeError):
            amount = 0

        if amount > Config.HIGH_AMOUNT_THRESHOLD:
            exceptions.append({
                "type": "HIGH_VALUE_CLAIM",
                "severity": "HIGH",
                "reason": f"Claim amount ₹{amount:,.2f} exceeds high-value threshold (₹{Config.HIGH_AMOUNT_THRESHOLD:,}).",
                "recommended_action": "Manual Review by Senior Officer"
            })
            
        if readiness_score < 60 and not missing_docs:
            exceptions.append({
                "type": "INCOMPLETE_CLAIM",
                "severity": "MEDIUM",
                "reason": "Claim readiness score is below operational threshold.",
                "recommended_action": "Manual Inspection Required"
            })

        # 4. Next-Best Action Decision Matrix
        if missing_docs and risk_level != "HIGH":
            next_best_action = "REQUEST_DOCUMENTS"
            recommendation_text = "Request Additional Documents"
            action_reason = f"Missing mandatory document(s): {', '.join(missing_docs)}."
        elif risk_level == "HIGH":
            next_best_action = "MANUAL_REVIEW"
            recommendation_text = "Senior Officer Manual Review"
            action_reason = "High risk score / high claim amount requires manual verification."
        elif risk_level == "MEDIUM":
            if missing_docs:
                next_best_action = "REQUEST_DOCUMENTS"
                recommendation_text = "Request Additional Documents"
                action_reason = "Medium risk and missing documents detected."
            else:
                next_best_action = "VERIFY_POLICY"
                recommendation_text = "Verify Policy Terms & Proceed"
                action_reason = "Medium risk claim with all documents verified."
        else:
            next_best_action = "PROCEED_TO_OFFICER"
            recommendation_text = "Proceed for Fast-Track Review"
            action_reason = "Low risk score and all mandatory documents verified."

        # 5. Priority Queue Calculation
        if risk_level == "HIGH" and amount > Config.HIGH_AMOUNT_THRESHOLD:
            priority = "CRITICAL"
        elif risk_level == "HIGH" or missing_docs:
            priority = "HIGH"
        elif risk_level == "MEDIUM":
            priority = "MEDIUM"
        else:
            priority = "LOW"

        return {
            "risk": risk_level,
            "risk_level": risk_level,
            "risk_score": risk_score,
            "claim_readiness": readiness_score,
            "readiness_status": readiness_status,
            "required_documents": required_docs,
            "missing_documents": missing_docs,
            "verified_count": doc_result["verified_count"],
            "total_required": doc_result["total_required"],
            "completeness_pct": doc_result["completeness_pct"],
            "exceptions": exceptions,
            "findings": findings,
            "contributing_factors": contributing_factors,
            "next_best_action": next_best_action,
            "ai_recommendation": recommendation_text,
            "action_reason": action_reason,
            "priority": priority
        }
