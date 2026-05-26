from setuptools import setup, find_packages

setup(
    name="brainbox",
    version="1.0.0",
    description="Production AI Backend for REST AI Infrastructure",
    author="REST AI Team",
    author_email="team@restai.com",
    packages=find_packages(),
    python_requires=">=3.11",
    install_requires=[
        "fastapi>=0.104.0",
        "uvicorn>=0.24.0",
        "sqlalchemy>=2.0.0",
        "psycopg2-binary>=2.9.0",
        "pgvector>=0.2.0",
        "redis>=5.0.0",
        "celery>=5.3.0",
        "sentence-transformers>=2.2.0",
        "langchain>=0.1.0",
        "langgraph>=0.0.29",
        "pydantic>=2.5.0",
        "python-dotenv>=1.0.0",
    ],
    entry_points={
        "console_scripts": [
            "brainbox-api=app.main:app",
        ],
    },
)
