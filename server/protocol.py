"""Request isolation for DSH, which sends complete conversation history per call."""
import uuid
from codebuddy_proxy import ProxyState


class IsolatedProxyState(ProxyState):
    """Prevent the upstream proxy's prompt fingerprint from merging unrelated chats."""

    def get_conversation_id(self, body: dict) -> str:
        """Return a distinct upstream request conversation; history is already explicit."""
        return uuid.uuid4().hex

    def record_response_id(self, conv_id: str, response_id: str) -> None:
        """Do not retain implicit upstream continuations across complete-history calls."""
        return None

    def peek_previous_response_id(self, conv_id: str) -> None:
        """No independent DSH request may inherit an upstream response identifier."""
        return None
