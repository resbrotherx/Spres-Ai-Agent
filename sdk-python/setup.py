from setuptools import setup, find_packages

setup(
    name="spres-ai",
    version="1.0.0",
    author="Resbrotherx",
    author_email="spres-ai@resbrotherx.com",
    description="Official Spres-Ai-Agent SDK for Python",
    long_description=open("README.md").read(),
    long_description_content_type="text/markdown",
    url="https://github.com/resbrotherx/Spres-Ai-Agent/tree/main/sdk-python",
    project_urls={
        "Bug Tracker": "https://github.com/resbrotherx/Spres-Ai-Agent/tree/main/sdk-python/issues",
        "Documentation": "https://docs.brainbox.ai/python",
    },
    classifiers=[
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.8",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "Programming Language :: Python :: 3.12",
				"Programming Language :: Python :: 3.14",
        "License :: OSI Approved :: MIT License",
        "Operating System :: OS Independent",
    ],
    python_requires=">=3.8",
    install_requires=[
        "requests>=2.28.0",
    ],
    extras_require={
        "dev": ["pytest", "black", "flake8"],
    },
)