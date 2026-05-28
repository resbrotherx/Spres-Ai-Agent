from setuptools import setup, find_packages

setup(
    name="brainbox-db",
    version="1.0.0",
    author="Brainbox Team",
    author_email="support@brainbox.ai",
    description="Database reader SDK for safely querying and reading customer database data",
    long_description=open("README.md").read() if __name__ != "__main__" else "",
    long_description_content_type="text/markdown",
    url="https://github.com/brainbox-ai/brainbox-sdk-database",
    project_urls={
        "Bug Tracker": "https://github.com/brainbox-ai/brainbox-sdk-database/issues",
        "Documentation": "https://docs.brainbox.ai/database",
    },
    classifiers=[
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.8",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "License :: OSI Approved :: MIT License",
        "Operating System :: OS Independent",
        "Topic :: Database",
    ],
    python_requires=">=3.8",
    install_requires=[
        "requests>=2.28.0",
    ],
    extras_require={
        "dev": ["pytest", "black", "flake8"],
    },
)
