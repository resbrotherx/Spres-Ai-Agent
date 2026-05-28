# Brainbox Platform - Backend Implementation

Guide for implementing database API endpoints in your backend.

---

## Overview

Customers use the Database SDK to query their databases safely through your backend API. You need to add 4 endpoints to enable this.

```
Customer SDK → Your Backend API → Customer's Database
                (validation)       (read-only)
```

---

## Required Endpoints

### 1. Test Connection

**POST** `/api/db/test-connection`

Test if database connection works.

```python
@router.post("/db/test-connection")
async def test_connection(request: dict, current_user = Depends(get_current_user)):
    """Test database connection"""
    try:
        tenant_id = request["tenant_id"]
        
        # Verify authorization
        if current_user.tenant_id != tenant_id:
            raise HTTPException(status_code=403, detail="Unauthorized")
        
        connection_string = request["connection_string"]
        engine = create_engine(connection_string, poolclass=NullPool)
        
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        
        return {"status": "success", "message": "Connected"}
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
```

---

### 2. Get Schema

**POST** `/api/db/schema`

Get database tables, columns, and row counts.

```python
@router.post("/db/schema")
async def get_schema(request: dict, current_user = Depends(get_current_user)):
    """Get database schema"""
    try:
        tenant_id = request["tenant_id"]
        
        # Verify authorization
        if current_user.tenant_id != tenant_id:
            raise HTTPException(status_code=403, detail="Unauthorized")
        
        connection_string = request["connection_string"]
        engine = create_engine(connection_string, poolclass=NullPool)
        inspector = inspect(engine)
        
        schema = {}
        
        for table_name in inspector.get_table_names():
            columns = inspector.get_columns(table_name)
            pk = inspector.get_pk_constraint(table_name)
            
            # Get row count
            with engine.connect() as conn:
                result = conn.execute(text(f"SELECT COUNT(*) FROM {table_name}"))
                row_count = result.scalar()
            
            schema[table_name] = {
                "columns": [
                    {
                        "name": col["name"],
                        "type": str(col["type"]),
                        "nullable": col["nullable"]
                    }
                    for col in columns
                ],
                "primary_key": pk["constrained_columns"][0] if pk else None,
                "row_count": row_count
            }
        
        # Log access
        log_db_access(tenant_id, "schema_request", "success")
        
        return schema
        
    except Exception as e:
        log_db_access(tenant_id, "schema_request", "error", error=str(e))
        raise HTTPException(status_code=400, detail=str(e))
```

---

### 3. Execute Query

**POST** `/api/db/query`

Execute read-only queries safely.

```python
@router.post("/db/query")
async def execute_query(request: dict, current_user = Depends(get_current_user)):
    """Execute read-only query"""
    try:
        tenant_id = request["tenant_id"]
        query = request["query"].strip().upper()
        limit = request.get("limit", 1000)
        
        # Verify authorization
        if current_user.tenant_id != tenant_id:
            raise HTTPException(status_code=403, detail="Unauthorized")
        
        # Block dangerous operations
        dangerous_ops = ["DROP", "DELETE", "ALTER", "TRUNCATE", "UPDATE", "INSERT"]
        for op in dangerous_ops:
            if query.startswith(op):
                log_db_access(tenant_id, "query_blocked", "dangerous_op", op=op)
                raise HTTPException(
                    status_code=400, 
                    detail=f"{op} operations not allowed (read-only)"
                )
        
        # Only SELECT and WITH allowed
        if not (query.startswith("SELECT") or query.startswith("WITH")):
            raise HTTPException(status_code=400, detail="Only SELECT/WITH allowed")
        
        # Check rate limit
        if not check_rate_limit(tenant_id):
            raise HTTPException(status_code=429, detail="Rate limit exceeded")
        
        # Execute
        connection_string = request["connection_string"]
        engine = create_engine(connection_string, poolclass=NullPool)
        
        with engine.connect() as connection:
            query_text = request["query"]
            if "LIMIT" not in query_text.upper():
                query_text += f" LIMIT {limit}"
            
            result = connection.execute(
                text(query_text),
                request.get("parameters", [])
            )
            rows = [dict(row) for row in result.fetchall()]
        
        # Log query
        log_query(
            tenant_id=tenant_id,
            query=request["query"],
            status="success",
            row_count=len(rows)
        )
        
        return {
            "status": "success",
            "results": rows,
            "row_count": len(rows)
        }
        
    except Exception as e:
        log_query(
            tenant_id=tenant_id,
            query=request["query"],
            status="error",
            error=str(e)
        )
        raise HTTPException(status_code=400, detail=str(e))
```

---

### 4. Get Audit Log

**GET** `/api/db/audit-log`

View query history for compliance/debugging.

```python
@router.get("/db/audit-log")
async def get_audit_log(
    tenant_id: str, 
    limit: int = 100,
    current_user = Depends(get_current_user)
):
    """Get audit log of database queries"""
    if current_user.tenant_id != tenant_id:
        raise HTTPException(status_code=403, detail="Unauthorized")
    
    from app.db.models import QueryAuditLog
    
    logs = db.query(QueryAuditLog)\
        .filter(QueryAuditLog.tenant_id == tenant_id)\
        .order_by(QueryAuditLog.created_at.desc())\
        .limit(limit)\
        .all()
    
    return {
        "audit_log": [
            {
                "timestamp": log.created_at.isoformat(),
                "query": log.query,
                "status": log.status,
                "row_count": log.row_count,
                "error": log.error
            }
            for log in logs
        ]
    }
```

---

## Database Models

### QueryAuditLog Table

Add to `app/db/models.py`:

```python
from sqlalchemy import Column, String, Integer, Text, DateTime
from datetime import datetime

class QueryAuditLog(Base):
    __tablename__ = "query_audit_logs"
    
    id = Column(Integer, primary_key=True)
    tenant_id = Column(String, ForeignKey("users.tenant_id"), index=True)
    query = Column(Text)
    status = Column(String)  # "success" or "error"
    row_count = Column(Integer, nullable=True)
    error = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
```

### Migration

```bash
# Create migration
alembic revision --autogenerate -m "Add query audit log"

# Apply migration
alembic upgrade head
```

---

## Helper Functions

### Rate Limiting

```python
from datetime import datetime, timedelta

# In memory or Redis
query_counts = {}

def check_rate_limit(tenant_id: str, limit: int = 100) -> bool:
    """Check if tenant exceeded query limit"""
    key = f"db_queries:{tenant_id}"
    
    # Reset if older than 1 hour
    if key in query_counts:
        count, timestamp = query_counts[key]
        if datetime.now() - timestamp > timedelta(hours=1):
            query_counts[key] = (0, datetime.now())
            return True
    
    query_counts[key] = (query_counts.get(key, (0, datetime.now()))[0] + 1, datetime.now())
    return query_counts[key][0] <= limit
```

### Query Logging

```python
def log_query(tenant_id: str, query: str, status: str, 
              row_count: int = None, error: str = None):
    """Log all database queries for audit"""
    from app.db.models import QueryAuditLog
    
    audit_log = QueryAuditLog(
        tenant_id=tenant_id,
        query=query,
        status=status,
        row_count=row_count,
        error=error
    )
    db.add(audit_log)
    db.commit()

def log_db_access(tenant_id: str, action: str, result: str, **kwargs):
    """Log database access attempts"""
    logger.info(f"DB Access - Tenant: {tenant_id}, Action: {action}, Result: {result}, {kwargs}")
```

---

## Security Checklist

- [ ] Verify API key is valid
- [ ] Check tenant authorization
- [ ] Enforce read-only (block DELETE, DROP, ALTER)
- [ ] Implement rate limiting
- [ ] Log all queries
- [ ] Sanitize results (remove passwords, tokens)
- [ ] Use parameterized queries
- [ ] Set row limits
- [ ] Handle SQL errors safely
- [ ] Use connection pooling
- [ ] Close connections properly

---

## Integration Steps

### 1. Add Imports

```python
# app/api/database.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.pool import NullPool
```

### 2. Create Router

```python
# app/api/database.py
router = APIRouter(prefix="/api/db", tags=["database"])

@router.post("/test-connection")
async def test_connection(...): ...

@router.post("/schema")
async def get_schema(...): ...

@router.post("/query")
async def execute_query(...): ...

@router.get("/audit-log")
async def get_audit_log(...): ...
```

### 3. Include Router in Main App

```python
# app/main.py
from app.api import database

app.include_router(database.router)
```

### 4. Test Locally

```bash
# Start backend
uvicorn app.main:app --reload

# Test endpoint
curl -X POST http://localhost:8000/api/db/test-connection \
  -H "Authorization: Bearer sk_test" \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "test",
    "connection_string": "postgresql://user:pass@localhost/db"
  }'
```

---

## Deployment Checklist

- [ ] Add 4 database endpoints
- [ ] Create QueryAuditLog table
- [ ] Setup rate limiting
- [ ] Implement query logging
- [ ] Add authentication checks
- [ ] Test with multiple database types
- [ ] Setup error handling
- [ ] Add monitoring/alerts
- [ ] Document API endpoints
- [ ] Test with customer data
- [ ] Setup backups
- [ ] Enable SSL/TLS

---

## Monitoring

### Check Query Logs
```bash
# View recent queries
SELECT * FROM query_audit_logs 
WHERE created_at > now() - interval '1 day'
ORDER BY created_at DESC
LIMIT 100;

# Count by status
SELECT status, COUNT(*) 
FROM query_audit_logs 
GROUP BY status;
```

### Monitor Performance
```bash
# Slow queries
SELECT * FROM query_audit_logs 
WHERE status = 'error'
LIMIT 10;

# Top tenants
SELECT tenant_id, COUNT(*) 
FROM query_audit_logs 
GROUP BY tenant_id 
ORDER BY count DESC;
```

---

## Troubleshooting

### Connection Issues
```
Error: "Connection refused"
→ Check database is running
→ Verify credentials
→ Check firewall/security groups
```

### Query Errors
```
Error: "Syntax error in SQL"
→ Log shows query is malformed
→ Test query in database directly
→ Check for SQL injection attempts
```

### Performance Issues
```
Error: "Query timeout"
→ Add LIMIT to large queries
→ Check database indexes
→ Implement query caching
```

---

## Support

Questions about implementation?
- **Email:** devops@brainbox.ai
- **Docs:** https://docs.brainbox.ai/backend
- **Status:** https://status.brainbox.ai
