from config import Config

class DocumentEngine:
    """
    Service for prototype document verification and completeness analysis.
    Checks submitted document attachments against mandatory policy checklists.
    """
    
    @staticmethod
    def verify_documents(claim_type, submitted_documents):
        """
        Evaluates submitted documents for a given claim type.
        Returns dict with required_documents, missing_documents, completeness_percentage, and document exceptions.
        """
        required = Config.REQUIRED_DOCUMENTS.get(
            claim_type, 
            ["ID Proof", "Claim Form", "Supporting Evidence"]
        )
        
        # Standardize submitted documents list
        submitted_set = set(doc.strip() for doc in submitted_documents if isinstance(doc, str) and doc.strip())
        
        missing = [doc for doc in required if doc not in submitted_set]
        
        total_req = len(required)
        verified_count = total_req - len(missing)
        completeness_pct = int((verified_count / total_req) * 100) if total_req > 0 else 100
        
        doc_exceptions = []
        if missing:
            doc_exceptions.append({
                "type": "MISSING_DOCUMENT",
                "severity": "MEDIUM" if len(missing) == 1 else "HIGH",
                "reason": f"Required evidence missing: {', '.join(missing)}.",
                "recommended_action": "Request Additional Documents"
            })
            
        return {
            "required_documents": required,
            "missing_documents": missing,
            "verified_count": verified_count,
            "total_required": total_req,
            "completeness_pct": completeness_pct,
            "exceptions": doc_exceptions
        }
