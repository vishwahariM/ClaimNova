from datetime import datetime, timezone

class NotificationService:
    """
    Activity Timeline & Event Logging Service for ClaimPulse.
    Generates structured history events for claim tracking.
    """
    
    @staticmethod
    def create_event(event_type, description, actor="System"):
        """
        Returns a formatted timeline event dict.
        """
        return {
            "timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S"),
            "event_type": event_type,
            "description": description,
            "actor": actor
        }
    
    @staticmethod
    def initial_timeline(claim_id, risk_level, recommendation):
        """
        Builds initial timeline events for newly submitted claim.
        """
        now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
        return [
            {
                "timestamp": now,
                "event_type": "SUBMISSION",
                "description": f"Claim {claim_id} submitted via fast-track intake.",
                "actor": "Claimant"
            },
            {
                "timestamp": now,
                "event_type": "AI_ANALYSIS",
                "description": f"Rule-based AI pre-check completed. Risk: {risk_level}, Recommendation: {recommendation}.",
                "actor": "Explainable AI Engine"
            }
        ]
