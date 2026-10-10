Brainbox SDK downloads (spres-ai 1.1.0)
=======================================

Train your Brainbox from your own servers, scripts and databases. Data goes straight
to your Brainbox and is processed by Brainbox's own AI.

Files
-----
  spres_ai-1.1.0-py3-none-any.whl   Python SDK (wheel)           Python 3.8+
  spres_ai-1.1.0.tar.gz             Python SDK (source dist)
  spres-ai-1.1.0.tgz                Node.js SDK (npm tarball)    Node 14+, 18+ recommended

Install (works before the packages are on PyPI / npm)
-----------------------------------------------------
  pip install https://port.smartpowerbilling.com/sdk/downloads/spres_ai-1.1.0-py3-none-any.whl
  npm install https://port.smartpowerbilling.com/sdk/downloads/spres-ai-1.1.0.tgz

Keys
----
  Tenant ID        which company's knowledge base. Not a password. Optional: the key decides it.
  Publishable key  pk_live_...  websites / apps chat only. Cannot train.
  Secret key       sk_live_...  servers, scripts, training. NEVER put it in a browser or app.

  Create a secret key: Staff dashboard -> Settings -> API keys -> Create -> Secret.
  Keep it in an environment variable, e.g. BRAINBOX_SECRET_KEY.

Python
------
  import os
  from brainbox_sdk import BrainboxPythonSDK
  sdk = BrainboxPythonSDK(api_url="https://port.smartpowerbilling.com",
                          api_key=os.environ["BRAINBOX_SECRET_KEY"])
  job = sdk.train_file("handbook.pdf", audience="internal")
  sdk.wait_for_task(job["task_id"])

Node.js
-------
  const { BrainboxNodeSDK } = require('spres-ai');
  const sdk = new BrainboxNodeSDK({ apiUrl: 'https://port.smartpowerbilling.com',
                                    apiKey: process.env.BRAINBOX_SECRET_KEY });
  const job = await sdk.trainFile('handbook.pdf', { audience: 'internal' });
  await sdk.waitForTask(job.task_id);

Audiences: public, customer, vendor, internal (default), admin.
Full API reference: https://port.smartpowerbilling.com/docs

SHA-256
-------
  4cd8ea027cb21b793de5d97996bfec674edcb43e67f3af5ad3cabc5918dd308b  spres_ai-1.1.0-py3-none-any.whl
  6eee9927739d24bdb51b07e3943aae87898ed1cbdfa61a0417cf913405381bb9  spres_ai-1.1.0.tar.gz
  9e2bc48e84340ced74aa22cb0e7cb92a1eb4a5a4613adcc1ab4566cf2740373e  spres-ai-1.1.0.tgz
