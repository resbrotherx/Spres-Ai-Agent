import requests
import json
from typing import Optional, Dict, Any

class BrainboxPythonSDK:
    def __init__(self, api_url: str, api_key: str, tenant_id: str):
        self.api_url = api_url.rstrip('/')
        self.api_key = api_key
        self.tenant_id = tenant_id
        self.headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}"
        }

    def ingest(
        self,
        source_type: str,
        content: str,
        file_path: Optional[str] = None,
        metadata: Optional[Dict] = None
    ) -> Dict[str, Any]:
        payload = {
            "tenant_id": self.tenant_id,
            "source_type": source_type,
            "content": content,
            "file_path": file_path,
            "metadata": metadata or {}
        }

        response = requests.post(
            f"{self.api_url}/api/ingest",
            json=payload,
            headers=self.headers
        )
        response.raise_for_status()
        return response.json()

    def get_ingest_status(self, task_id: str) -> Dict[str, Any]:
        response = requests.get(
            f"{self.api_url}/api/ingest/status/{task_id}",
            headers=self.headers
        )
        response.raise_for_status()
        return response.json()

    def chat(self, question: str, session_id: Optional[str] = None) -> Dict[str, Any]:
        payload = {
            "tenant_id": self.tenant_id,
            "question": question,
            "session_id": session_id
        }

        response = requests.post(
            f"{self.api_url}/api/chat",
            json=payload,
            headers=self.headers
        )
        response.raise_for_status()
        return response.json()

    def create_chat_session(self, title: Optional[str] = None) -> Dict[str, Any]:
        payload = {
            "tenant_id": self.tenant_id,
            "title": title or "New Session"
        }

        response = requests.post(
            f"{self.api_url}/api/chat/session",
            json=payload,
            headers=self.headers
        )
        response.raise_for_status()
        return response.json()

    def health_check(self) -> Dict[str, Any]:
        response = requests.get(f"{self.api_url}/api/health")
        response.raise_for_status()
        return response.json()


# Example usage
if __name__ == "__main__":
    sdk = BrainboxPythonSDK(
        api_url="http://localhost:8000",
        api_key="your-api-key",
        tenant_id="company-1"
    )

    # Ingest logs
    ingest_result = sdk.ingest(
        source_type="logs",
        content="2024-01-15 ERROR: Database connection failed",
        file_path="/var/log/app.log"
    )
    print(f"Ingestion queued: {ingest_result['task_id']}")

    # Chat
    chat_result = sdk.chat("What error occurred in the logs?")
    print(f"Response: {chat_result['response']}")
