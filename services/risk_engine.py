from config import Config

class RiskEngine:
    """
    Explainable Risk Calculation & Claim Readiness Scoring Engine.
    Transparently evaluates claim risk points and overall claim readiness score.
    """
    
    @staticmethod
    def evaluate_risk(claim_amount, claim_type, missing_documents):
        """
        Calculates risk score, risk level, claim readiness score, and detailed contributing factors.
        """
        risk_score = 0
        findings = []
        contributing_factors = []
        
        # 1. Claim Amount Analysis
        try:
            amount = float(claim_amount)
        except (ValueError, TypeError):
            amount = 0

        if amount > Config.HIGH_AMOUNT_THRESHOLD:
            points = Config.HIGH_AMOUNT_POINTS
            risk_score += points
            findings.append("High claim amount requires verification.")
            contributing_factors.append({
                "factor": f"Claim amount above ₹{Config.HIGH_AMOUNT_THRESHOLD:,}",
                "impact": f"+{points} pts",
                "type": "warning"
            })
        elif amount > Config.MEDIUM_AMOUNT_THRESHOLD:
            points = Config.MEDIUM_AMOUNT_POINTS
            risk_score += points
            findings.append("Claim amount requires additional verification.")
            contributing_factors.append({
                "factor": f"Claim amount above ₹{Config.MEDIUM_AMOUNT_THRESHOLD:,}",
                "impact": f"+{points} pts",
                "type": "info"
            })
        else:
            contributing_factors.append({
                "factor": f"Standard claim amount (₹{amount:,.2f})",
                "impact": "0 pts",
                "type": "neutral"
            })

        # 2. Claim Type Risk Evaluation
        type_points = Config.CLAIM_TYPE_POINTS.get(claim_type, 5)
        risk_score += type_points
        
        if claim_type == "Vehicle Insurance":
            findings.append("Vehicle claim requires supporting incident documents.")
        elif claim_type == "Health Insurance":
            findings.append("Medical supporting documents should be verified.")
        elif claim_type == "Property Insurance":
            findings.append("Property ownership & damage assessment required.")
        elif claim_type == "Travel Insurance":
            findings.append("Travel proof & itinerary verification required.")

        contributing_factors.append({
            "factor": f"{claim_type} risk weight",
            "impact": f"+{type_points} pts",
            "type": "info"
        })

        # 3. Missing Documents Penalty
        if missing_documents:
            missing_count = len(missing_documents)
            penalty = missing_count * Config.MISSING_DOC_PENALTY_POINTS
            risk_score += penalty
            findings.append(f"Missing {missing_count} mandatory document(s): {', '.join(missing_documents)}.")
            contributing_factors.append({
                "factor": f"Missing {missing_count} required document(s)",
                "impact": f"+{penalty} pts",
                "type": "warning"
            })
        else:
            contributing_factors.append({
                "factor": "All mandatory documents present",
                "impact": "0 penalty",
                "type": "success"
            })

        # Determine Risk Level Category
        if risk_score >= 30:
            risk_level = "HIGH"
        elif risk_score >= 15:
            risk_level = "MEDIUM"
        else:
            risk_level = "LOW"

        # Calculate Claim Readiness Score (0-100%)
        # Base readiness starts at 100%, penalized by missing documents and elevated risk
        missing_penalty = len(missing_documents) * 20
        risk_penalty = int(risk_score * 0.5)
        readiness_score = max(0, min(100, 100 - missing_penalty - risk_penalty))
        
        if readiness_score >= 85:
            readiness_status = "READY"
        elif readiness_score >= 60:
            readiness_status = "ACTION REQUIRED"
        else:
            readiness_status = "INCOMPLETE"

        return {
            "risk_score": risk_score,
            "risk_level": risk_level,
            "claim_readiness": readiness_score,
            "readiness_status": readiness_status,
            "findings": findings,
            "contributing_factors": contributing_factors
        }
