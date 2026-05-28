from setuptools import setup, find_packages

setup(
    name="brainbox-cli",
    version="1.0.0",
    author="Brainbox Team",
    author_email="support@brainbox.ai",
    description="Terminal SDK for collecting server logs and ingesting to Brainbox AI",
    long_description=open("README.md").read(),
    long_description_content_type="text/markdown",
    url="https://github.com/brainbox-ai/brainbox-sdk-cli",
    project_urls={
        "Bug Tracker": "https://github.com/brainbox-ai/brainbox-sdk-cli/issues",
        "Documentation": "https://docs.brainbox.ai/cli",
    },
    classifiers=[
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.8",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "License :: OSI Approved :: MIT License",
        "Operating System :: OS Independent",
        "Topic :: System :: Monitoring",
        "Topic :: System :: Logging",
    ],
    python_requires=">=3.8",
    install_requires=[
        "requests>=2.28.0",
    ],
    extras_require={
        "dev": ["pytest", "black", "flake8"],
    },
    entry_points={
        "console_scripts": [
            "brainbox-cli=brainbox_cli:main",
        ],
    },
)
