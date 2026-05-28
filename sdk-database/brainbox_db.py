"""
Brainbox Database Reader SDK
Safely read and query customer database data through API gateway
"""
import requests
import json
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass
from datetime import datetime
import hashlib


@dataclass
class DatabaseConnection:
    """Database connection configuration"""
    db_type: str  # postgres, mysql, sqlite
    host: str
    port: int
    database: str
    username: str
    password: str = None

    def to_dict(self) -> Dict[str, str]:
        return {
            "db_type": self.db_type,
            "host": self.host,
            "port": str(self.port),
            "database": self.database,
            "username": self.username,
            "password": self.password or ""
        }


@dataclass
class TableInfo:
    """Information about a database table"""
    name: str
    columns: List[Dict[str, str]]  # [{"name": "id", "type": "INTEGER", "nullable": True}, ...]
    primary_key: str
    row_count: int = 0
    created_at: Optional[str] = None


class DatabaseReader:
    """Main SDK for reading database information safely"""

    def __init__(self,
                 api_url: str,
                 api_key: str,
                 tenant_id: str,
                 db_type: str = "postgres",
                 host: str = "localhost",
                 port: int = 5432,
                 database: str = "",
                 username: str = ""):
        """
        Initialize DatabaseReader

        Args:
            api_url: Backend API URL
            api_key: API authentication key
            tenant_id: Tenant ID
            db_type: Database type (postgres, mysql, sqlite)
            host: Database host
            port: Database port
            database: Database name
            username: Database username
        """
        self.api_url = api_url.rstrip('/')
        self.api_key = api_key
        self.tenant_id = tenant_id
        self.db_type = db_type
        self.host = host
        self.port = port
        self.database = database
        self.username = username
        self.headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
        self.connection_string = None
        self.schema_cache: Dict[str, TableInfo] = {}

    def set_connection_string(self, connection_string: str):
        """
        Set connection string directly
        Example: postgresql://user:password@localhost:5432/dbname
        """
        self.connection_string = connection_string

    def test_connection(self) -> bool:
        """Test database connection through API"""
        try:
            response = requests.post(
                f"{self.api_url}/api/db/test-connection",
                json={
                    "tenant_id": self.tenant_id,
                    "connection_string": self.connection_string or self._build_connection_string()
                },
                headers=self.headers,
                timeout=10
            )

            if response.status_code == 200:
                print("✓ Database connection successful")
                return True
            else:
                print(f"✗ Connection failed: {response.text}")
                return False

        except Exception as e:
            print(f"✗ Error testing connection: {e}")
            return False

    def get_schema(self, refresh: bool = False) -> Dict[str, TableInfo]:
        """Get database schema information"""
        if self.schema_cache and not refresh:
            return self.schema_cache

        try:
            response = requests.post(
                f"{self.api_url}/api/db/schema",
                json={
                    "tenant_id": self.tenant_id,
                    "connection_string": self.connection_string or self._build_connection_string()
                },
                headers=self.headers,
                timeout=30
            )

            if response.status_code == 200:
                schema_data = response.json()

                for table_name, table_data in schema_data.items():
                    self.schema_cache[table_name] = TableInfo(
                        name=table_name,
                        columns=table_data.get("columns", []),
                        primary_key=table_data.get("primary_key"),
                        row_count=table_data.get("row_count", 0)
                    )

                print(f"✓ Loaded schema with {len(self.schema_cache)} tables")
                return self.schema_cache

            else:
                print(f"✗ Failed to get schema: {response.text}")
                return {}

        except Exception as e:
            print(f"✗ Error getting schema: {e}")
            return {}

    def inspect_table(self, table_name: str) -> Optional[TableInfo]:
        """Get detailed information about a specific table"""
        schema = self.get_schema()
        return schema.get(table_name)

    def list_tables(self) -> List[str]:
        """List all tables in database"""
        schema = self.get_schema()
        return list(schema.keys())

    def query(self,
              sql: str,
              parameters: Optional[List[Any]] = None,
              limit: int = 1000) -> List[Dict[str, Any]]:
        """
        Execute a SQL query safely through API gateway

        Args:
            sql: SQL query
            parameters: Query parameters for parameterized queries
            limit: Maximum rows to return

        Returns:
            List of result rows
        """
        # Validate query - basic checks
        sql_upper = sql.upper().strip()
        if sql_upper.startswith(('DROP', 'DELETE', 'ALTER', 'TRUNCATE')):
            raise ValueError(f"⚠️  Query not allowed: {sql_upper.split()[0]} operations are read-only")

        if not sql_upper.startswith(('SELECT', 'WITH')):
            raise ValueError("Only SELECT and WITH queries are allowed")

        try:
            payload = {
                "tenant_id": self.tenant_id,
                "connection_string": self.connection_string or self._build_connection_string(),
                "query": sql,
                "parameters": parameters or [],
                "limit": limit
            }

            response = requests.post(
                f"{self.api_url}/api/db/query",
                json=payload,
                headers=self.headers,
                timeout=30
            )

            if response.status_code == 200:
                results = response.json().get("results", [])
                print(f"✓ Query returned {len(results)} rows")
                return results

            elif response.status_code == 400:
                print(f"✗ Query error: {response.json().get('error')}")
                return []

            else:
                print(f"✗ Query failed: {response.text}")
                return []

        except Exception as e:
            print(f"✗ Error executing query: {e}")
            return []

    def count_rows(self, table_name: str) -> int:
        """Get row count for a table"""
        try:
            result = self.query(f"SELECT COUNT(*) as count FROM {table_name}")
            if result:
                return result[0].get("count", 0)
            return 0

        except Exception as e:
            print(f"✗ Error counting rows: {e}")
            return 0

    def get_columns(self, table_name: str) -> List[Dict[str, str]]:
        """Get column information for a table"""
        table_info = self.inspect_table(table_name)
        if table_info:
            return table_info.columns
        return []

    def sample_data(self, table_name: str, limit: int = 10) -> List[Dict[str, Any]]:
        """Get sample data from a table"""
        try:
            return self.query(f"SELECT * FROM {table_name} LIMIT {limit}")
        except Exception as e:
            print(f"✗ Error sampling data: {e}")
            return []

    def search_table(self,
                     table_name: str,
                     column_name: str,
                     search_value: str,
                     limit: int = 100) -> List[Dict[str, Any]]:
        """Search for data in a table"""
        try:
            query = f"SELECT * FROM {table_name} WHERE {column_name} LIKE %s LIMIT {limit}"
            return self.query(query, [f"%{search_value}%"])

        except Exception as e:
            print(f"✗ Error searching: {e}")
            return []

    def export_table(self,
                     table_name: str,
                     output_format: str = "json",
                     limit: int = None) -> str:
        """
        Export table data

        Args:
            table_name: Table to export
            output_format: json, csv
            limit: Max rows

        Returns:
            Exported data as string
        """
        try:
            if limit:
                data = self.query(f"SELECT * FROM {table_name} LIMIT {limit}")
            else:
                data = self.query(f"SELECT * FROM {table_name}")

            if output_format == "json":
                return json.dumps(data, indent=2, default=str)

            elif output_format == "csv":
                import csv
                import io

                if not data:
                    return ""

                output = io.StringIO()
                writer = csv.DictWriter(output, fieldnames=data[0].keys())
                writer.writeheader()
                writer.writerows(data)
                return output.getvalue()

            else:
                raise ValueError(f"Unsupported format: {output_format}")

        except Exception as e:
            print(f"✗ Error exporting: {e}")
            return ""

    def get_statistics(self, table_name: str) -> Dict[str, Any]:
        """Get table statistics"""
        try:
            stats = {}

            # Row count
            result = self.query(f"SELECT COUNT(*) as count FROM {table_name}")
            if result:
                stats["total_rows"] = result[0].get("count", 0)

            # Column count
            table_info = self.inspect_table(table_name)
            if table_info:
                stats["total_columns"] = len(table_info.columns)
                stats["columns"] = [col["name"] for col in table_info.columns]

            # Index info (if available)
            stats["created_at"] = table_info.created_at if table_info else None

            return stats

        except Exception as e:
            print(f"✗ Error getting statistics: {e}")
            return {}

    def get_audit_log(self, limit: int = 100) -> List[Dict[str, Any]]:
        """Get audit log of database queries"""
        try:
            response = requests.get(
                f"{self.api_url}/api/db/audit-log",
                headers=self.headers,
                params={
                    "tenant_id": self.tenant_id,
                    "limit": limit
                },
                timeout=10
            )

            if response.status_code == 200:
                return response.json().get("audit_log", [])

            return []

        except Exception as e:
            print(f"✗ Error getting audit log: {e}")
            return []

    def _build_connection_string(self) -> str:
        """Build connection string from components"""
        if self.db_type == "postgres":
            return f"postgresql://{self.username}@{self.host}:{self.port}/{self.database}"

        elif self.db_type == "mysql":
            return f"mysql+pymysql://{self.username}@{self.host}:{self.port}/{self.database}"

        elif self.db_type == "sqlite":
            return f"sqlite:///{self.database}"

        else:
            raise ValueError(f"Unsupported database type: {self.db_type}")

    def __str__(self) -> str:
        return f"DatabaseReader({self.db_type}://{self.host}:{self.port}/{self.database})"


# Example Usage
if __name__ == "__main__":
    # Initialize
    db = DatabaseReader(
        api_url="http://localhost:8000",
        api_key="your-api-key",
        tenant_id="tenant-1",
        db_type="postgres",
        host="localhost",
        port=5432,
        database="mydb",
        username="postgres"
    )

    # Test connection
    if db.test_connection():
        # Get schema
        schema = db.get_schema()
        print(f"Tables: {list(schema.keys())}")

        # Inspect a table
        if "users" in schema:
            table_info = db.inspect_table("users")
            print(f"Users table: {table_info.row_count} rows, {len(table_info.columns)} columns")

            # Query
            results = db.query("SELECT id, email FROM users LIMIT 5")
            print(f"First 5 users: {results}")

            # Sample data
            sample = db.sample_data("users", limit=3)
            print(f"Sample: {sample}")

            # Statistics
            stats = db.get_statistics("users")
            print(f"Stats: {stats}")

            # Export
            json_data = db.export_table("users", output_format="json", limit=10)
            print(f"Exported {len(json_data)} bytes")
