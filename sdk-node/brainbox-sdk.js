const axios = require('axios');
const fs = require('fs');
const path = require('path');

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
    constructor(apiUrl, apiKey, tenantId) {
        this.apiUrl = apiUrl.replace(/\/$/, '');
        this.apiKey = apiKey;
        this.tenantId = tenantId;
        this.client = axios.create({
            baseURL: this.apiUrl,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            }
        });
    }

    async ingest(sourceType, content, filePath = null, metadata = {}) {
        try {
            const payload = {
                tenant_id: this.tenantId,
                source_type: sourceType,
                content: content,
                file_path: filePath,
                metadata: metadata
            };

            const response = await this.client.post('/api/ingest', payload);
            return response.data;
        } catch (error) {
            throw new Error(`Ingestion failed: ${error.message}`);
        }
    }

    async getIngestStatus(taskId) {
        try {
            const response = await this.client.get(`/api/ingest/status/${taskId}`);
            return response.data;
        } catch (error) {
            throw new Error(`Failed to get ingestion status: ${error.message}`);
        }
    }

    async chat(question, sessionId = null) {
        try {
            const payload = {
                tenant_id: this.tenantId,
                question: question,
                session_id: sessionId
            };

            const response = await this.client.post('/api/chat', payload);
            return response.data;
        } catch (error) {
            throw new Error(`Chat failed: ${error.message}`);
        }
    }

    async createChatSession(title = null) {
        try {
            const payload = {
                tenant_id: this.tenantId,
                title: title || 'New Session'
            };

            const response = await this.client.post('/api/chat/session', payload);
            return response.data;
        } catch (error) {
            throw new Error(`Failed to create chat session: ${error.message}`);
        }
    }

    async healthCheck() {
        try {
            const response = await this.client.get('/api/health');
            return response.data;
        } catch (error) {
            throw new Error(`Health check failed: ${error.message}`);
        }
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
        const allFuncs = this.findAllFunctions(directory);
        return allFuncs.filter(f => f.is_async);
    }

    _findInDirectory(directory, pattern, callback) {
        try {
            const items = fs.readdirSync(directory);
            items.forEach(item => {
                if (item.includes('node_modules')) return;

                const itemPath = path.join(directory, item);
                const stat = fs.statSync(itemPath);

                if (stat.isDirectory()) {
                    this._findInDirectory(itemPath, pattern, callback);
                } else if (pattern.test(itemPath)) {
                    try {
                        const content = fs.readFileSync(itemPath, 'utf-8');
                        callback(itemPath, content);
                    } catch (error) {
                        // Skip files that can't be read
                    }
                }
            });
        } catch (error) {
            // Skip directories that can't be read
        }
    }

    _parseJSFile(filePath, content, searchName = null) {
        const functions = [];

        // Regular function declarations: function name() {}
        const funcDeclRegex = /(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)/g;
        let match;
        while ((match = funcDeclRegex.exec(content)) !== null) {
            const name = match[1];
            if (searchName && name.toLowerCase() !== searchName.toLowerCase()) continue;

            const paramsStr = match[2];
            const params = paramsStr
                .split(',')
                .map(p => p.trim().split(':')[0].trim())
                .filter(p => p);
            const isAsync = content.substring(match.index, match.index + 10).includes('async');
            const lineNumber = content.substring(0, match.index).split('\n').length;

            functions.push(new FunctionInfo(
                name,
                filePath,
                lineNumber,
                'javascript',
                `${isAsync ? 'async ' : ''}function ${name}(${paramsStr})`,
                params,
                isAsync
            ));
        }

        // Arrow functions: const name = () => {}
        const arrowRegex = /(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\(([^)]*)\)\s*=>/g;
        while ((match = arrowRegex.exec(content)) !== null) {
            const name = match[1];
            if (searchName && name.toLowerCase() !== searchName.toLowerCase()) continue;

            const paramsStr = match[2];
            const params = paramsStr
                .split(',')
                .map(p => p.trim().split(':')[0].trim())
                .filter(p => p);
            const isAsync = content.substring(match.index, match.index + 50).includes('async');
            const lineNumber = content.substring(0, match.index).split('\n').length;

            functions.push(new FunctionInfo(
                name,
                filePath,
                lineNumber,
                'javascript',
                `${isAsync ? 'async ' : ''}const ${name} = (${paramsStr}) =>`,
                params,
                isAsync
            ));
        }

        return functions;
    }
}

module.exports = BrainboxNodeSDK;

// Example usage
if (require.main === module) {
    const sdk = new BrainboxNodeSDK(
        'http://localhost:8000',
        'your-api-key',
        'company-1'
    );

    (async () => {
        // Ingest logs
        const ingestResult = await sdk.ingest(
            'logs',
            '2024-01-15 ERROR: Database connection failed',
            '/var/log/app.log'
        );
        console.log(`Ingestion queued: ${ingestResult.task_id}`);

        // Chat
        const chatResult = await sdk.chat('What error occurred in the logs?');
        console.log(`Response: ${chatResult.response}`);

        // Find functions
        const loginFuncs = sdk.findFunction('login', './src');
        loginFuncs.forEach(func => {
            console.log(`Found: ${func.name} at ${func.file_path}:${func.line_number}`);
            console.log(`  Signature: ${func.signature}`);
        });

        // Find all async functions
        const asyncFuncs = sdk.findAsyncFunctions('./src');
        console.log(`Found ${asyncFuncs.length} async functions`);
    })();
}
