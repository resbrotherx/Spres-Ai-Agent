# Complete Guide: Publishing SDKs to PyPI, NPM, and Yarn

## Table of Contents
1. [PyPI (Python)](#pypi-python)
2. [NPM (Node.js)](#npm-nodejs)
3. [Yarn Registry](#yarn-registry)
4. [Version Management](#version-management)
5. [Automated Publishing](#automated-publishing)

---

## PyPI (Python)

### Step 1: Create PyPI Account

1. Go to https://pypi.org/account/register/
2. Create account with username and password
3. Verify email
4. Go to Account Settings → API tokens
5. Create token with "Entire account" scope
6. Copy and save securely

### Step 2: Create `setup.py` File

```python
# sdk-python/setup.py
from setuptools import setup, find_packages

setup(
    name="brainbox-sdk",
    version="1.0.0",
    author="Your Name",
    author_email="your.email@example.com",
    description="Official Brainbox AI SDK for Python",
    long_description=open("README.md").read(),
    long_description_content_type="text/markdown",
    url="https://github.com/yourusername/brainbox-sdk-python",
    project_urls={
        "Bug Tracker": "https://github.com/yourusername/brainbox-sdk-python/issues",
        "Documentation": "https://docs.brainbox.ai/python",
    },
    classifiers=[
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.8",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
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
```

### Step 3: Create `pyproject.toml`

```toml
# sdk-python/pyproject.toml
[build-system]
requires = ["setuptools>=61.0", "wheel"]
build-backend = "setuptools.build_meta"

[project]
name = "brainbox-sdk"
version = "1.0.0"
description = "Official Brainbox AI SDK for Python"
readme = "README.md"
requires-python = ">=3.8"
license = {text = "MIT"}
authors = [
    {name = "Your Name", email = "your.email@example.com"}
]
keywords = ["brainbox", "ai", "logs", "search", "sdk"]
classifiers = [
    "Programming Language :: Python :: 3",
    "Programming Language :: Python :: 3.8",
]

dependencies = [
    "requests>=2.28.0",
]

[project.optional-dependencies]
dev = ["pytest", "black", "flake8"]

[project.urls]
Homepage = "https://github.com/yourusername/brainbox-sdk-python"
Documentation = "https://docs.brainbox.ai/python"
Repository = "https://github.com/yourusername/brainbox-sdk-python.git"
```

### Step 4: Create `~/.pypirc` Configuration

```ini
# ~/.pypirc (or %APPDATA%\.pypirc on Windows)
[distutils]
index-servers =
    pypi
    testpypi

[pypi]
repository = https://upload.pypi.org/legacy/
username = __token__
password = pypi-AgEIcHlwaS5vcmc...  # Your PyPI token

[testpypi]
repository = https://test.pypi.org/legacy/
username = __token__
password = pypi-AgEIcHlwaS5vcmc...  # Your TestPyPI token
```

### Step 5: Build and Upload

```bash
cd sdk-python

# Install build tools
pip install build twine

# Build distribution
python -m build

# This creates dist/ folder with:
# - brainbox_sdk-1.0.0.tar.gz (source distribution)
# - brainbox_sdk-1.0.0-py3-none-any.whl (wheel)

# Test on TestPyPI first
twine upload --repository testpypi dist/*

# Then upload to PyPI
twine upload dist/*
```

### Step 6: Verify Installation

```bash
# Test installation from PyPI
pip install brainbox-sdk

# Import and test
python -c "from brainbox_sdk import BrainboxPythonSDK; print('Success!')"
```

### Step 7: Update Version for Future Releases

```python
# sdk-python/setup.py
version="1.0.1",  # Bump version
```

```bash
# Rebuild and upload
python -m build
twine upload dist/*
```

---

## NPM (Node.js)

### Step 1: Create NPM Account

1. Go to https://www.npmjs.com/signup
2. Create account (username, email, password)
3. Verify email
4. Go to Account Settings → Auth Tokens
5. Create token (classic or granular)
6. Copy token

### Step 2: Create/Update `package.json`

```json
{
  "name": "brainbox-sdk",
  "version": "1.0.0",
  "description": "Official Brainbox AI SDK for Node.js",
  "main": "index.js",
  "types": "index.d.ts",
  "scripts": {
    "test": "jest",
    "build": "tsc",
    "prepublishOnly": "npm test && npm run build"
  },
  "keywords": [
    "brainbox",
    "ai",
    "logs",
    "search",
    "sdk"
  ],
  "author": {
    "name": "Your Name",
    "email": "your.email@example.com",
    "url": "https://github.com/yourusername"
  },
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/yourusername/brainbox-sdk-node.git"
  },
  "bugs": {
    "url": "https://github.com/yourusername/brainbox-sdk-node/issues"
  },
  "homepage": "https://github.com/yourusername/brainbox-sdk-node",
  "dependencies": {
    "axios": "^1.4.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "jest": "^29.0.0",
    "@types/node": "^20.0.0"
  },
  "engines": {
    "node": ">=14.0.0"
  },
  "publishConfig": {
    "access": "public"
  }
}
```

### Step 3: Create `.npmrc` Authentication

```bash
# Option 1: Create ~/.npmrc file
echo "//registry.npmjs.org/:_authToken=YOUR_NPM_TOKEN" > ~/.npmrc

# Option 2: Log in via CLI
npm login

# Option 3: Use environment variable (CI/CD)
export NPM_TOKEN=YOUR_NPM_TOKEN
```

### Step 4: Prepare Files

```bash
cd sdk-node

# Make sure you have:
# - package.json (configured above)
# - index.js (main SDK file)
# - README.md (documentation)
# - LICENSE (MIT or your choice)
# - .npmignore (optional, ignore test files)
```

### Step 5: Create `.npmignore`

```
# .npmignore
node_modules/
.git
.github
tests/
examples/
*.test.js
.env
.env.example
.eslintrc
.prettierrc
tsconfig.json
jest.config.js
```

### Step 6: Publish to NPM

```bash
cd sdk-node

# Verify you're logged in
npm whoami  # Should show your username

# Publish
npm publish

# If you have 2FA enabled, you'll need to provide OTP:
npm publish --otp YOUR_OTP_CODE

# Or interactively:
npm publish
# (enter OTP when prompted)
```

### Step 7: Verify Installation

```bash
# Test installation from NPM
npm install brainbox-sdk

# Test import
node -e "const SDK = require('brainbox-sdk'); console.log('Success!');"

# Or for TypeScript
import { BrainboxNodeSDK } from 'brainbox-sdk';
```

### Step 8: Update Version for Future Releases

```bash
# Bump version automatically
npm version patch   # 1.0.0 → 1.0.1
npm version minor   # 1.0.0 → 1.1.0
npm version major   # 1.0.0 → 2.0.0

# This updates package.json and creates git tag

# Then publish
npm publish
```

---

## Yarn Registry

### Option 1: Publish to NPM (Yarn installs from NPM)

Yarn uses NPM registry by default. Once published to NPM, users can install via:

```bash
yarn add brainbox-sdk
```

### Option 2: Private Yarn Registry

If you want a private registry:

1. Set up npm registry or use Verdaccio (private npm server)
2. Configure `.yarnrc.yml`:

```yaml
# .yarnrc.yml
nodeLinker: node-modules
registries:
  npm: https://registry.npmjs.org
  yourregistry: https://your-private-registry.com
```

3. Publish:

```bash
yarn npm publish --registry https://your-registry.com
```

---

## Version Management (Semantic Versioning)

### Version Format: `MAJOR.MINOR.PATCH`

- **MAJOR**: Incompatible API changes (e.g., 1.0.0 → 2.0.0)
- **MINOR**: New features, backwards compatible (e.g., 1.0.0 → 1.1.0)
- **PATCH**: Bug fixes (e.g., 1.0.0 → 1.0.1)

### Git Tagging

```bash
# Tag your release in git
git tag -a v1.0.0 -m "Release version 1.0.0"
git push origin v1.0.0

# For Python, create GitHub release too
```

### Release Timeline

1. **v1.0.0** (Initial Release)
   - Core functionality
   - Basic documentation
   - First version on registries

2. **v1.0.1** (Patch)
   - Bug fixes
   - Minor improvements

3. **v1.1.0** (Minor)
   - New features
   - Enhanced functionality

4. **v2.0.0** (Major)
   - Breaking changes
   - Complete redesign

---

## Automated Publishing (CI/CD)

### GitHub Actions Example

```yaml
# .github/workflows/publish.yml
name: Publish to PyPI and NPM

on:
  push:
    tags:
      - 'v*'

jobs:
  publish-pypi:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-python@v4
        with:
          python-version: '3.10'
      - run: |
          pip install build twine
          cd sdk-python
          python -m build
      - uses: pypa/gh-action-pypi-publish@release/v1
        with:
          packages-dir: sdk-python/dist/

  publish-npm:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          registry-url: 'https://registry.npmjs.org'
      - run: |
          cd sdk-node
          npm install
          npm publish
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

---

## Complete Publishing Checklist

### Before First Release

- [ ] Create PyPI account
- [ ] Create NPM account
- [ ] Create GitHub repository
- [ ] Add LICENSE file (MIT recommended)
- [ ] Write comprehensive README.md
- [ ] Create setup.py (Python)
- [ ] Create/update package.json (Node.js)
- [ ] Add documentation
- [ ] Test locally with `pip install -e .` and `npm install --save-dev ./sdk-node`
- [ ] Test on TestPyPI first

### For Each Release

- [ ] Update version in setup.py/package.json
- [ ] Update CHANGELOG.md
- [ ] Commit changes
- [ ] Create git tag (v1.0.0)
- [ ] Push commits and tags
- [ ] Build packages
- [ ] Upload to PyPI
- [ ] Upload to NPM
- [ ] Create GitHub release
- [ ] Announce release

---

## Useful Commands Reference

### Python (PyPI)

```bash
# Build
python -m build

# Test upload
twine upload --repository testpypi dist/*

# Upload to PyPI
twine upload dist/*

# Check version on PyPI
pip index versions brainbox-sdk
```

### Node.js (NPM)

```bash
# Check login
npm whoami

# Publish
npm publish

# Update version
npm version patch
npm version minor
npm version major

# Check package on NPM
npm view brainbox-sdk

# Test install
npm install brainbox-sdk
```

### General

```bash
# List all versions
npm view brainbox-sdk versions

# Search package
npm search brainbox

# Get package info
npm info brainbox-sdk
```

---

## Troubleshooting

### PyPI Issues

**Error: "403 Forbidden"**
- Check token is correct
- Verify ~/.pypirc is formatted correctly
- Re-create token if needed

**Error: "Package already exists"**
- Increment version in setup.py
- Rebuild and re-upload

### NPM Issues

**Error: "403 Forbidden - User: xyz"**
- Check NPM token in ~/.npmrc
- Verify token hasn't expired
- Try `npm login` again

**Error: "Package name already in use"**
- Use scoped name: `@yourname/brainbox-sdk`
- Or rename package

**OTP Error**
- Use `npm publish --otp YOUR_CODE`
- Or use UI at npmjs.com

---

## Support Resources

- PyPI: https://pypi.org
- NPM: https://npmjs.com
- Twine docs: https://twine.readthedocs.io
- Setuptools: https://setuptools.pypa.io
- NPM Docs: https://docs.npmjs.com
