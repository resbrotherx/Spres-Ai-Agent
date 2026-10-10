/**
 * Brainbox Node.js SDK (package `spres-ai`).
 *
 * Train your Brainbox from servers, scripts and databases (files, text, records,
 * third-party APIs), check training progress and chat with it.
 *
 * Authentication uses a SECRET key (sk_live_...). The key decides which tenant
 * (company knowledge base) you act on, so tenantId is optional. Never ship a secret
 * key to a browser or mobile app.
 */
'use strict';

const axios = require('axios');
const fs = require('fs');
const path = require('path');

const VERSION = '1.1.0';
const DEFAULT_API_URL = 'https://port.smartpowerbilling.com';
const AUDIENCES = ['public', 'customer', 'vendor', 'internal', 'admin'];
const TERMINAL_STATUSES = ['completed', 'failed', 'error', 'cancelled'];
const MIME_TYPES = {
    '.pdf': 'application/pdf',
    '.xml': 'application/xml',
    '.txt': 'text/plain',
    '.md': 'text/markdown',
    '.csv': 'text/csv',
    '.json': 'application/json',
    '.html': 'text/html',
    '.htm': 'text/html',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

class BrainboxError extends Error {
    /**
     * @param {string} message
     * @param {{statusCode?: number|null, detail?: any, code?: string}} [info]
     */
    constructor(message, info = {}) {
        super(message);
        this.name = 'BrainboxError';
        this.statusCode = info.statusCode == null ? null : info.statusCode;
        this.detail = info.detail;
        this.code = info.code;
    }
}

class BrainboxAuthError extends BrainboxError {
    constructor(message, info) { super(message, info); this.name = 'BrainboxAuthError'; }
}
class BrainboxNotFoundError extends BrainboxError {
    constructor(message, info) { super(message, info); this.name = 'BrainboxNotFoundError'; }
}
class BrainboxValidationError extends BrainboxError {
    constructor(message, info) { super(message, info); this.name = 'BrainboxValidationError'; }
}
class BrainboxTimeoutError extends BrainboxError {
    constructor(message, info) { super(message, info); this.name = 'BrainboxTimeoutError'; }
}

function formatDetail(detail) {
    if (detail == null) return '';
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail)) {
        return detail.map((item) => {
            if (item && typeof item === 'object') {
                const loc = (item.loc || []).filter((p) => p !== 'body' && p !== 'query').join('.');
                return loc ? `${loc}: ${item.msg || ''}` : (item.msg || '');
            }
            return String(item);
        }).filter(Boolean).join('; ');
    }
    try { return JSON.stringify(detail); } catch (_) { return String(detail); }
}

function checkAudience(audience) {
    if (audience == null) return undefined;
    const value = String(audience).trim().toLowerCase();
    if (!AUDIENCES.includes(value)) {
        throw new TypeError(`audience must be one of: ${AUDIENCES.join(', ')}`);
    }
    return value;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

class FunctionInfo {
    constructor(name, filePath, lineNumber, language, signature, parameters, isAsync = false, className = null) {
        this.name = name;
        this.file_path = filePath;
        this.line_number = lineNumber;
        this.language = language;
        this.signature = signature;
        this.parameters = parameters;
        this.is_async = isAsync;
        this.class_name = className;
    }

    toObject() {
        return {
            name: this.name,
            file_path: this.file_path,
            line_number: this.line_number,
            language: this.language,
            signature: this.signature,
            parameters: this.parameters,
            is_async: this.is_async,
            class_name: this.class_name
        };
    }
}

class BrainboxNodeSDK {
    /**
     * new BrainboxNodeSDK(apiUrl, apiKey, tenantId?)  or  new BrainboxNodeSDK({ apiUrl, apiKey, tenantId, timeout })
     */
    constructor(apiUrl, apiKey, tenantId) {
        let options = {};
        if (apiUrl && typeof apiUrl === 'object') {
            options = apiUrl;
        } else {
            options = { apiUrl, apiKey, tenantId };
        }
        const key = options.apiKey || process.env.BRAINBOX_SECRET_KEY || process.env.BRAINBOX_API_KEY;
        if (!key) {
            throw new TypeError('apiKey is required (a secret key, sk_live_...). You can also set BRAINBOX_SECRET_KEY.');
        }
        this.apiUrl = String(options.apiUrl || DEFAULT_API_URL).replace(/\/+$/, '');
        this.tenantId = options.tenantId || null;
        this.timeout = options.timeout || 60000;
        // Keep the key off enumerable properties so console.log(sdk) never prints it.
        Object.defineProperty(this, 'apiKey', { value: key, enumerable: false, writable: false });
        const client = axios.create({
            baseURL: this.apiUrl,
            timeout: this.timeout,
            maxBodyLength: Infinity,
            maxContentLength: Infinity,
            headers: {
                'X-API-Key': key,
                Accept: 'application/json',
                'User-Agent': `spres-ai-node/${VERSION}`,
            },
        });
        Object.defineProperty(this, 'client', { value: client, enumerable: false, writable: false });
    }

    getApiUrl() {
        return this.apiUrl;
    }

    // ------------------------------------------------------------------ http

    async _request(method, url, { data, params, headers } = {}) {
        try {
            const response = await this.client.request({ method, url, data, params, headers });
            return response.data === '' ? {} : response.data;
        } catch (error) {
            throw this._toError(error, method, url);
        }
    }

    _toError(error, method, url) {
        const where = `${method.toUpperCase()} ${url}`;
        if (!error || !error.response) {
            const reason = (error && (error.code || error.message)) || 'unknown error';
            return new BrainboxError(`Could not reach Brainbox at ${this.apiUrl} (${where}): ${reason}`, { code: error && error.code });
        }
        const { status, statusText, data } = error.response;
        const detail = data && typeof data === 'object' && 'detail' in data ? data.detail : data;
        let text = formatDetail(detail) || statusText || 'Request failed';
        if (typeof text === 'string' && text.length > 500) text = text.slice(0, 500);
        let message = `Brainbox API error ${status} on ${where}: ${text}`;
        const info = { statusCode: status, detail };
        if (status === 401 || status === 403) {
            if (status === 401) message += ' (check your secret key)';
            return new BrainboxAuthError(message, info);
        }
        if (status === 404) return new BrainboxNotFoundError(message, info);
        if ([400, 409, 413, 415, 422].includes(status)) return new BrainboxValidationError(message, info);
        return new BrainboxError(message, info);
    }

    _tenantParams() {
        return this.tenantId ? { tenant_id: this.tenantId } : undefined;
    }

    _withTenant(payload) {
        if (this.tenantId) payload.tenant_id = this.tenantId;
        return payload;
    }

    // ------------------------------------------------------------------ ingest / chat

    async ingest(sourceType, content, filePath = null, metadata = {}, audience = undefined) {
        const payload = {
            source_type: sourceType,
            content,
            file_path: filePath,
            metadata: metadata || {},
        };
        const aud = checkAudience(audience);
        if (aud) payload.audience = aud;
        return this._request('post', '/api/ingest', { data: this._withTenant(payload) });
    }

    async getIngestStatus(taskId) {
        return this._request('get', `/api/ingest/status/${encodeURIComponent(taskId)}`);
    }

    /**
     * Poll a task until it finishes. timeout/poll are in SECONDS (same as the Python SDK).
     */
    async waitForTask(taskId, { timeout = 600, poll = 3, raiseOnFailure = true } = {}) {
        const deadline = Date.now() + timeout * 1000;
        for (;;) {
            const status = await this.getIngestStatus(taskId);
            const state = String(status.status || '').toLowerCase();
            if (TERMINAL_STATUSES.includes(state)) {
                if (raiseOnFailure && state !== 'completed') {
                    throw new BrainboxError(`Training task ${taskId} ${state}: ${status.error_message || 'no details'}`, { detail: status });
                }
                return status;
            }
            const remaining = deadline - Date.now();
            if (remaining <= 0) {
                throw new BrainboxTimeoutError(`Task ${taskId} still '${state || 'unknown'}' after ${timeout}s`, { detail: status });
            }
            await sleep(Math.min(poll * 1000, remaining));
        }
    }

    async chat(question, sessionId = null) {
        return this._request('post', '/api/chat', { data: this._withTenant({ question, session_id: sessionId }) });
    }

    async createChatSession(title = null) {
        return this._request('post', '/api/chat/session', { data: this._withTenant({ title: title || 'New Session' }) });
    }

    async healthCheck() {
        return this._request('get', '/api/health');
    }

    // ------------------------------------------------------------------ training

    /**
     * Upload a document (PDF, XML, DOCX, TXT, CSV, JSON...; max 25 MB).
     * @returns {Promise<{source: object, task_id: string}>}
     */
    async trainFile(filePath, { name, audience } = {}) {
        const stat = await fs.promises.stat(filePath).catch(() => null);
        if (!stat || !stat.isFile()) {
            const err = new Error(`No such file: ${filePath}`);
            err.code = 'ENOENT';
            throw err;
        }
        const filename = path.basename(filePath);
        const mime = MIME_TYPES[path.extname(filename).toLowerCase()] || 'application/octet-stream';
        const fields = {};
        if (name) fields.name = name;
        const aud = checkAudience(audience);
        if (aud) fields.audience = aud;
        if (this.tenantId) fields.tenant_id = this.tenantId;

        let form;
        let headers;
        if (typeof globalThis.FormData === 'function' && typeof globalThis.Blob === 'function') {
            // Node 18+: spec FormData + Blob (fs.openAsBlob streams from disk on Node 19.8+).
            const blob = typeof fs.openAsBlob === 'function'
                ? await fs.openAsBlob(filePath, { type: mime })
                : new Blob([await fs.promises.readFile(filePath)], { type: mime });
            form = new FormData();
            for (const [k, v] of Object.entries(fields)) form.append(k, v);
            form.append('file', blob, filename);
        } else {
            // Older Node: the form-data package, streaming from disk.
            const LegacyFormData = require('form-data');
            form = new LegacyFormData();
            for (const [k, v] of Object.entries(fields)) form.append(k, v);
            form.append('file', fs.createReadStream(filePath), { filename, contentType: mime, knownLength: stat.size });
            headers = form.getHeaders();
        }
        return this._request('post', '/api/train/file', { data: form, headers });
    }

    /** Teach free text: an FAQ, a policy, or one database record rendered as text. */
    async trainText(content, { name, audience } = {}) {
        if (typeof content !== 'string' || !content.trim()) {
            throw new TypeError('content must be a non-empty string');
        }
        const payload = { content };
        if (name) payload.name = name;
        const aud = checkAudience(audience);
        if (aud) payload.audience = aud;
        return this._request('post', '/api/train/text', { data: this._withTenant(payload) });
    }

    _apiConfig(config) {
        if (!config || !config.url) throw new TypeError('url is required');
        const payload = {};
        for (const [k, v] of Object.entries(config)) {
            if (v !== undefined && v !== null) payload[k] = v;
        }
        if (payload.audience !== undefined) payload.audience = checkAudience(payload.audience);
        return this._withTenant(payload);
    }

    /** Dry-run a third-party API and preview what would be learned (nothing is saved). */
    async testApiSource(config) {
        return this._request('post', '/api/train/api-source/test', { data: this._apiConfig(config) });
    }

    /**
     * Connect a third-party API (e.g. your helpdesk) and start the first sync.
     * config: { url, name?, method?, headers?, query?, body?, data_path?, source_type?,
     *           mapping?, pagination?, audience? }
     */
    async addApiSource(config) {
        return this._request('post', '/api/train/api-source', { data: this._apiConfig(config) });
    }

    async listSources() {
        return this._request('get', '/api/train/sources', { params: this._tenantParams() });
    }

    async getSource(sourceId) {
        return this._request('get', `/api/train/sources/${encodeURIComponent(sourceId)}`, { params: this._tenantParams() });
    }

    /** Rename a source and/or change who may see it (applies to all its documents). */
    async updateSource(sourceId, { audience, name } = {}) {
        const payload = {};
        if (audience !== undefined && audience !== null) payload.audience = checkAudience(audience);
        if (name !== undefined && name !== null) payload.name = name;
        if (!Object.keys(payload).length) throw new TypeError('Pass audience and/or name');
        return this._request('patch', `/api/train/sources/${encodeURIComponent(sourceId)}`, { data: payload, params: this._tenantParams() });
    }

    async deleteSource(sourceId) {
        return this._request('delete', `/api/train/sources/${encodeURIComponent(sourceId)}`, { params: this._tenantParams() });
    }

    async syncSource(sourceId) {
        return this._request('post', `/api/train/sources/${encodeURIComponent(sourceId)}/sync`, { params: this._tenantParams() });
    }

    // ==================== FUNCTION LOCATOR ====================

    findFunction(functionName, directory = '.') {
        const results = [];
        this._findInDirectory(directory, /\.(js|jsx|ts|tsx)$/, (filePath, content) => {
            results.push(...this._parseJSFile(filePath, content, functionName));
        });
        return results;
    }

    findAllFunctions(directory = '.') {
        const results = [];
        this._findInDirectory(directory, /\.(js|jsx|ts|tsx)$/, (filePath, content) => {
            results.push(...this._parseJSFile(filePath, content));
        });
        return results;
    }

    findFunctionByFile(filePath) {
        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            return this._parseJSFile(filePath, content);
        } catch (error) {
            console.error(`Error reading file ${filePath}:`, error.message);
            return [];
        }
    }

    findAsyncFunctions(directory = '.') {
        return this.findAllFunctions(directory).filter((f) => f.is_async);
    }

    _findInDirectory(directory, pattern, callback) {
        let items;
        try {
            items = fs.readdirSync(directory);
        } catch (_) {
            return; // Skip directories that can't be read
        }
        items.forEach((item) => {
            if (item === 'node_modules' || item === '.git') return;
            const itemPath = path.join(directory, item);
            let stat;
            try { stat = fs.statSync(itemPath); } catch (_) { return; }
            if (stat.isDirectory()) {
                this._findInDirectory(itemPath, pattern, callback);
            } else if (pattern.test(itemPath)) {
                try {
                    callback(itemPath, fs.readFileSync(itemPath, 'utf-8'));
                } catch (_) {
                    // Skip files that can't be read
                }
            }
        });
    }

    _parseJSFile(filePath, content, searchName = null) {
        const functions = [];
        const wanted = searchName ? searchName.toLowerCase() : null;

        // Regular function declarations: function name() {}
        const funcDeclRegex = /(async\s+)?function\s+(\w+)\s*\(([^)]*)\)/g;
        let match;
        while ((match = funcDeclRegex.exec(content)) !== null) {
            const name = match[2];
            if (wanted && name.toLowerCase() !== wanted) continue;
            const paramsStr = match[3];
            const params = paramsStr.split(',').map((p) => p.trim().split(':')[0].trim()).filter((p) => p);
            const isAsync = Boolean(match[1]);
            const lineNumber = content.substring(0, match.index).split('\n').length;
            functions.push(new FunctionInfo(name, filePath, lineNumber, 'javascript',
                `${isAsync ? 'async ' : ''}function ${name}(${paramsStr})`, params, isAsync));
        }

        // Arrow functions: const name = () => {}
        const arrowRegex = /(?:const|let|var)\s+(\w+)\s*=\s*(async\s*)?\(([^)]*)\)\s*=>/g;
        while ((match = arrowRegex.exec(content)) !== null) {
            const name = match[1];
            if (wanted && name.toLowerCase() !== wanted) continue;
            const paramsStr = match[3];
            const params = paramsStr.split(',').map((p) => p.trim().split(':')[0].trim()).filter((p) => p);
            const isAsync = Boolean(match[2]);
            const lineNumber = content.substring(0, match.index).split('\n').length;
            functions.push(new FunctionInfo(name, filePath, lineNumber, 'javascript',
                `${isAsync ? 'async ' : ''}const ${name} = (${paramsStr}) =>`, params, isAsync));
        }

        return functions;
    }
}

module.exports = BrainboxNodeSDK;
module.exports.default = BrainboxNodeSDK;
module.exports.BrainboxNodeSDK = BrainboxNodeSDK;
module.exports.FunctionInfo = FunctionInfo;
module.exports.BrainboxError = BrainboxError;
module.exports.BrainboxAuthError = BrainboxAuthError;
module.exports.BrainboxNotFoundError = BrainboxNotFoundError;
module.exports.BrainboxValidationError = BrainboxValidationError;
module.exports.BrainboxTimeoutError = BrainboxTimeoutError;
module.exports.AUDIENCES = AUDIENCES;
module.exports.DEFAULT_API_URL = DEFAULT_API_URL;
module.exports.VERSION = VERSION;

// Quick connectivity check: BRAINBOX_SECRET_KEY=sk_live_... node brainbox-sdk.js
if (require.main === module) {
    (async () => {
        const sdk = new BrainboxNodeSDK({ apiUrl: process.env.BRAINBOX_API_URL });
        console.log(await sdk.healthCheck());
        console.log((await sdk.listSources()).totals);
    })().catch((err) => {
        console.error(err.message);
        process.exitCode = 1;
    });
}
