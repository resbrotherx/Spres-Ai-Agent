# Brainbox Database Reader SDK

Safely read and query customer database data through an API gateway. Access database schemas, inspect tables, execute read-only queries, and export data without direct database access.

## Installation

### From PyPI
```bash
pip install brainbox-db
```

### From Source
```bash
git clone https://github.com/brainbox-ai/brainbox-sdk-database.git
cd brainbox-sdk-database
pip install -e .
```

## Quick Start

### Initialize Connection

```python
from brainbox_db import DatabaseReader

# Create database reader
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
    print("✓ Connected to database")
```

### Get Database Schema

```python
# Get all tables and columns
schema = db.get_schema()

for table_name, table_info in schema.items():
    print(f"Table: {table_name}")
    print(f"  Rows: {table_info.row_count}")
    for col in table_info.columns:
        print(f"    - {col['name']}: {col['type']}")
```

### Query Data

```python
# Simple SELECT query
results = db.query("SELECT id, email FROM users LIMIT 10")

for row in results:
    print(f"User {row['id']}: {row['email']}")
```

### Inspect Tables

```python
# Get table information
users_table = db.inspect_table("users")

print(f"Table: {users_table.name}")
print(f"Columns: {users_table.total_columns}")
print(f"Rows: {users_table.row_count}")

# Get columns
columns = db.get_columns("users")
for col in columns:
    print(f"  {col['name']}: {col['type']}")
```

## Features

### Read Database Schema

```python
# Get all tables
tables = db.list_tables()
print(f"Tables: {tables}")

# Inspect specific table
table = db.inspect_table("users")
print(f"Row count: {table.row_count}")
print(f"Columns: {len(table.columns)}")

# Get column details
columns = db.get_columns("users")
for col in columns:
    print(f"  {col['name']}: {col['type']}, Nullable: {col.get('nullable', True)}")
```

### Execute Queries

```python
# Simple SELECT
users = db.query("SELECT * FROM users LIMIT 5")

# With WHERE clause
active_users = db.query(
    "SELECT id, name FROM users WHERE status = %s",
    ["active"]
)

# Aggregation
counts = db.query("SELECT COUNT(*) as count FROM users")
total = counts[0]['count']

# JOIN queries
results = db.query("""
    SELECT u.name, COUNT(o.id) as order_count
    FROM users u
    LEFT JOIN orders o ON u.id = o.user_id
    GROUP BY u.id
    LIMIT 20
""")
```

### Sample Data

```python
# Get sample rows from table
sample = db.sample_data("users", limit=5)

for row in sample:
    print(row)
```

### Search Data

```python
# Search for specific values
results = db.search_table(
    table_name="users",
    column_name="email",
    search_value="example.com",
    limit=20
)

for row in results:
    print(f"Found: {row['email']}")
```

### Count Rows

```python
# Quick row count
user_count = db.count_rows("users")
print(f"Total users: {user_count}")

# For each table
for table in db.list_tables():
    count = db.count_rows(table)
    print(f"{table}: {count} rows")
```

### Export Data

```python
# Export as JSON
json_data = db.export_table("users", output_format="json", limit=100)
with open("users.json", "w") as f:
    f.write(json_data)

# Export as CSV
csv_data = db.export_table("users", output_format="csv", limit=100)
with open("users.csv", "w") as f:
    f.write(csv_data)

# Export all data (no limit)
all_users = db.export_table("users", output_format="json")
```

### Get Statistics

```python
# Table statistics
stats = db.get_statistics("users")

print(f"Total rows: {stats['total_rows']}")
print(f"Total columns: {stats['total_columns']}")
print(f"Columns: {stats['columns']}")
print(f"Created: {stats['created_at']}")
```

### Audit Logs

```python
# View query audit log
audit_log = db.get_audit_log(limit=20)

for entry in audit_log:
    print(f"Query at {entry['timestamp']}: {entry['query'][:100]}")
    print(f"  Status: {entry['status']}")
    print(f"  Rows returned: {entry['row_count']}")
```

## Supported Databases

### PostgreSQL
```python
db = DatabaseReader(
    api_url="http://localhost:8000",
    api_key="key",
    tenant_id="tenant-1",
    db_type="postgres",
    host="db.example.com",
    port=5432,
    database="mydb",
    username="postgres"
)
```

### MySQL
```python
db = DatabaseReader(
    api_url="http://localhost:8000",
    api_key="key",
    tenant_id="tenant-1",
    db_type="mysql",
    host="mysql.example.com",
    port=3306,
    database="mydb",
    username="root"
)
```

### SQLite
```python
db = DatabaseReader(
    api_url="http://localhost:8000",
    api_key="key",
    tenant_id="tenant-1",
    db_type="sqlite",
    database="/path/to/db.sqlite3"
)
```

### Custom Connection String

```python
db = DatabaseReader(
    api_url="http://localhost:8000",
    api_key="key",
    tenant_id="tenant-1"
)

# Set connection string directly
db.set_connection_string("postgresql://user:pass@localhost:5432/mydb")
```

## Security Features

### Read-Only Queries
- Only SELECT and WITH queries allowed
- DELETE, DROP, ALTER, TRUNCATE blocked
- Parameterized queries prevent SQL injection

```python
# Safe - uses parameterized query
results = db.query(
    "SELECT * FROM users WHERE email = %s",
    ["user@example.com"]  # Parameter is safely escaped
)

# Blocked - dangerous operations prevented
db.query("DROP TABLE users")  # Raises ValueError
```

### API Gateway
- All queries go through API gateway
- Server-side authentication and validation
- Rate limiting and monitoring
- Audit logging of all queries

### Tenant Isolation
- Data isolated by tenant_id
- Cannot access other tenant's data
- Row-level security (if configured)

### Row Limits
- Default limit: 1000 rows
- Configurable per query
- Prevents accidental large data exports

```python
# Limit results
results = db.query("SELECT * FROM large_table", limit=100)
```

## Use Cases

### 1. Debug Customer Issues

```python
# Find user causing issue
problem_users = db.query(
    "SELECT id, email, status FROM users WHERE status = %s",
    ["error"]
)

for user in problem_users:
    print(f"User {user['id']}: {user['email']}")
```

### 2. Analyze Customer Data

```python
# Customer metrics
stats = db.get_statistics("orders")
print(f"Total orders: {stats['total_rows']}")

# Recent orders
recent = db.query(
    "SELECT * FROM orders WHERE created_at > %s ORDER BY created_at DESC",
    ["2024-01-01"]
)
```

### 3. Audit Database

```python
# Check table structures
for table in db.list_tables():
    table_info = db.inspect_table(table)
    print(f"{table}: {table_info.row_count} rows, {len(table_info.columns)} columns")
```

### 4. Export Customer Data

```python
# GDPR data export
user_data = db.export_table("users", output_format="json")
# Send to customer securely
```

### 5. Integration with Brainbox

```python
# Find database issues
from brainbox_db import DatabaseReader
from brainbox_sdk import BrainboxPythonSDK

db = DatabaseReader(...)
sdk = BrainboxPythonSDK(...)

# Get database info
schema = db.get_schema()
schema_summary = str(schema)

# Ask Brainbox about issues
response = sdk.chat(
    f"What could be wrong with this schema? {schema_summary}"
)
```

## Error Handling

```python
try:
    # Test connection first
    if not db.test_connection():
        print("Cannot connect to database")
        exit(1)

    # Query with error handling
    results = db.query("SELECT * FROM users")
    
except ValueError as e:
    print(f"Query validation error: {e}")
except Exception as e:
    print(f"Error: {e}")
```

## Configuration

### Environment Variables
```bash
export BRAINBOX_API_URL=http://localhost:8000
export BRAINBOX_API_KEY=your-api-key
export BRAINBOX_DB_TYPE=postgres
export BRAINBOX_DB_HOST=localhost
export BRAINBOX_DB_PORT=5432
export BRAINBOX_DB_NAME=mydb
export BRAINBOX_DB_USER=postgres
```

### From Config File
```python
import json

with open("db_config.json") as f:
    config = json.load(f)

db = DatabaseReader(
    api_url=config["api_url"],
    api_key=config["api_key"],
    **config["database"]
)
```

## Caching

```python
# Schema is cached after first request
schema = db.get_schema()  # API call

# Uses cache
tables = db.list_tables()  # No API call

# Force refresh
schema = db.get_schema(refresh=True)  # API call
```

## Performance Tips

1. **Use LIMIT**: Always limit query results
   ```python
   results = db.query("SELECT * FROM large_table LIMIT 100")
   ```

2. **Use WHERE**: Filter data at source
   ```python
   recent = db.query("SELECT * FROM users WHERE created_at > %s", ["2024-01-01"])
   ```

3. **Select columns**: Don't SELECT *
   ```python
   data = db.query("SELECT id, email FROM users")
   ```

4. **Cache schema**: Reuse schema data
   ```python
   schema = db.get_schema()  # Cached for reuse
   ```

## Troubleshooting

### Connection Failed
```bash
# Check API server
curl http://localhost:8000/api/health

# Check database credentials
psql -U postgres -h localhost -d mydb
```

### Query Returns No Results
```python
# Check table exists
tables = db.list_tables()

# Check data
sample = db.sample_data("users", limit=5)

# Debug query
results = db.query("SELECT COUNT(*) as count FROM users")
```

### Permission Denied
```bash
# Ensure database user has SELECT permission
# GRANT SELECT ON ALL TABLES IN SCHEMA public TO postgres;
```

## Requirements

- Python 3.8+
- `requests` library (auto-installed)
- Network access to Brainbox API
- Database credentials (read-only recommended)

## Best Practices

1. **Use read-only database users**
2. **Implement rate limiting** on API
3. **Audit all queries** via API
4. **Sanitize results** before displaying
5. **Cache schema** to reduce queries
6. **Use parameterized queries** (always done by SDK)
7. **Set appropriate row limits**

## Support

- Documentation: https://docs.brainbox.ai/database
- Issues: https://github.com/brainbox-ai/brainbox-sdk-database/issues
- Email: support@brainbox.ai

## License

MIT License
