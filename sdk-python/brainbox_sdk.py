import requests
import json
import ast
import re
from typing import Optional, Dict, Any, List
from pathlib import Path
from dataclasses import dataclass

@dataclass
class FunctionInfo:
    """Function location and metadata"""
    name: str
    file_path: str
    line_number: int
    language: str
    signature: str
    parameters: List[str]
    is_async: bool = False
    class_name: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "file_path": self.file_path,
            "line_number": self.line_number,
            "language": self.language,
            "signature": self.signature,
            "parameters": self.parameters,
            "is_async": self.is_async,
            "class_name": self.class_name
        }

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

    # ==================== FUNCTION LOCATOR ====================

    def find_function(self, function_name: str, directory: str = ".") -> List[FunctionInfo]:
        """Find functions by name in codebase"""
        results = []
        directory = Path(directory)

        for py_file in directory.rglob("*.py"):
            if '.venv' in str(py_file) or 'venv' in str(py_file):
                continue
            results.extend(self._parse_python_file(str(py_file), function_name))

        for js_file in directory.rglob("*.js"):
            if 'node_modules' in str(js_file):
                continue
            results.extend(self._find_js_function(str(js_file), function_name))

        return results

    def find_all_functions(self, directory: str = ".") -> List[FunctionInfo]:
        """Find all functions in codebase"""
        results = []
        directory = Path(directory)

        for py_file in directory.rglob("*.py"):
            if '.venv' in str(py_file) or 'venv' in str(py_file):
                continue
            results.extend(self._parse_python_file(str(py_file)))

        for js_file in directory.rglob("*.js"):
            if 'node_modules' in str(js_file):
                continue
            results.extend(self._parse_js_file(str(js_file)))

        return results

    def find_function_by_file(self, file_path: str) -> List[FunctionInfo]:
        """Find all functions in a specific file"""
        if file_path.endswith('.py'):
            return self._parse_python_file(file_path)
        elif file_path.endswith('.js'):
            return self._parse_js_file(file_path)
        return []

    def find_async_functions(self, directory: str = ".") -> List[FunctionInfo]:
        """Find all async functions"""
        all_funcs = self.find_all_functions(directory)
        return [f for f in all_funcs if f.is_async]

    def _parse_python_file(self, file_path: str, search_name: Optional[str] = None) -> List[FunctionInfo]:
        """Parse Python file and extract functions"""
        functions = []
        try:
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
            tree = ast.parse(content)

            for node in ast.walk(tree):
                if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                    if search_name and node.name.lower() != search_name.lower():
                        continue

                    params = [arg.arg for arg in node.args.args]
                    signature = f"{'async ' if isinstance(node, ast.AsyncFunctionDef) else ''}def {node.name}({', '.join(params)})"

                    functions.append(FunctionInfo(
                        name=node.name,
                        file_path=file_path,
                        line_number=node.lineno,
                        language="python",
                        signature=signature,
                        parameters=params,
                        is_async=isinstance(node, ast.AsyncFunctionDef)
                    ))

                elif isinstance(node, ast.ClassDef):
                    for item in node.body:
                        if isinstance(item, (ast.FunctionDef, ast.AsyncFunctionDef)):
                            if search_name and item.name.lower() != search_name.lower():
                                continue

                            params = [arg.arg for arg in item.args.args if arg.arg != 'self']
                            signature = f"{'async ' if isinstance(item, ast.AsyncFunctionDef) else ''}def {item.name}({', '.join(params)})"

                            functions.append(FunctionInfo(
                                name=item.name,
                                file_path=file_path,
                                line_number=item.lineno,
                                language="python",
                                signature=signature,
                                parameters=params,
                                is_async=isinstance(item, ast.AsyncFunctionDef),
                                class_name=node.name
                            ))
        except Exception as e:
            pass

        return functions

    def _parse_js_file(self, file_path: str, search_name: Optional[str] = None) -> List[FunctionInfo]:
        """Parse JavaScript file and extract functions"""
        functions = []
        try:
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()

            # Regular function declarations
            func_decl = r'(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)'
            for match in re.finditer(func_decl, content):
                name = match.group(1)
                if search_name and name.lower() != search_name.lower():
                    continue

                params_str = match.group(2)
                params = [p.strip().split(':')[0].strip() for p in params_str.split(',') if p.strip()]
                is_async = 'async' in match.group(0)
                line_number = content[:match.start()].count('\n') + 1

                functions.append(FunctionInfo(
                    name=name,
                    file_path=file_path,
                    line_number=line_number,
                    language="javascript",
                    signature=f"{'async ' if is_async else ''}function {name}({params_str})",
                    parameters=params,
                    is_async=is_async
                ))

            # Arrow functions
            arrow_func = r'(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\(([^)]*)\)\s*=>'
            for match in re.finditer(arrow_func, content):
                name = match.group(1)
                if search_name and name.lower() != search_name.lower():
                    continue

                params_str = match.group(2)
                params = [p.strip().split(':')[0].strip() for p in params_str.split(',') if p.strip()]
                is_async = 'async' in match.group(0)
                line_number = content[:match.start()].count('\n') + 1

                functions.append(FunctionInfo(
                    name=name,
                    file_path=file_path,
                    line_number=line_number,
                    language="javascript",
                    signature=f"{'async ' if is_async else ''}const {name} = ({params_str}) =>",
                    parameters=params,
                    is_async=is_async
                ))

        except Exception as e:
            pass

        return functions

    def _find_js_function(self, file_path: str, search_name: str) -> List[FunctionInfo]:
        """Helper to find specific JS function"""
        return [f for f in self._parse_js_file(file_path) if f.name.lower() == search_name.lower()]


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

    # Find functions
    login_funcs = sdk.find_function("login", directory="./src")
    for func in login_funcs:
        print(f"Found: {func.name} at {func.file_path}:{func.line_number}")
        print(f"  Signature: {func.signature}")

    # Find all async functions
    async_funcs = sdk.find_async_functions(directory="./src")
    print(f"Found {len(async_funcs)} async functions")
