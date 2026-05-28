import axios, { AxiosInstance } from 'axios';

interface IngestPayload {
  tenant_id: string;
  source_type: string;
  content: string;
  file_path?: string;
  metadata?: Record<string, any>;
}

interface ChatPayload {
  tenant_id: string;
  question: string;
  session_id?: string;
}

interface ChatSessionPayload {
  tenant_id: string;
  title?: string;
}

export interface FunctionInfo {
  name: string;
  file_path: string;
  line_number: number;
  language: string;
  signature: string;
  parameters: string[];
  is_async: boolean;
  class_name?: string | null;

  toObject(): Record<string, any>;
}

class FunctionInfoImpl implements FunctionInfo {
  name: string;
  file_path: string;
  line_number: number;
  language: string;
  signature: string;
  parameters: string[];
  is_async: boolean;
  class_name?: string | null;

  constructor(
    name: string,
    filePath: string,
    lineNumber: number,
    language: string,
    signature: string,
    parameters: string[],
    isAsync: boolean = false,
    className: string | null = null
  ) {
    this.name = name;
    this.file_path = filePath;
    this.line_number = lineNumber;
    this.language = language;
    this.signature = signature;
    this.parameters = parameters;
    this.is_async = isAsync;
    this.class_name = className;
  }

  toObject(): Record<string, any> {
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

export class BrainboxReactSDK {
  private apiUrl: string;
  private apiKey: string;
  private tenantId: string;
  private client: AxiosInstance;

  constructor(apiUrl: string, apiKey: string, tenantId: string) {
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

  async ingest(
    sourceType: string,
    content: string,
    filePath?: string,
    metadata?: Record<string, any>
  ): Promise<any> {
    try {
      const payload: IngestPayload = {
        tenant_id: this.tenantId,
        source_type: sourceType,
        content: content,
        file_path: filePath,
        metadata: metadata || {}
      };

      const response = await this.client.post('/api/ingest', payload);
      return response.data;
    } catch (error: any) {
      throw new Error(`Ingestion failed: ${error.message}`);
    }
  }

  async getIngestStatus(taskId: string): Promise<any> {
    try {
      const response = await this.client.get(`/api/ingest/status/${taskId}`);
      return response.data;
    } catch (error: any) {
      throw new Error(`Failed to get ingestion status: ${error.message}`);
    }
  }

  async chat(question: string, sessionId?: string): Promise<any> {
    try {
      const payload: ChatPayload = {
        tenant_id: this.tenantId,
        question: question,
        session_id: sessionId
      };

      const response = await this.client.post('/api/chat', payload);
      return response.data;
    } catch (error: any) {
      throw new Error(`Chat failed: ${error.message}`);
    }
  }

  async createChatSession(title?: string): Promise<any> {
    try {
      const payload: ChatSessionPayload = {
        tenant_id: this.tenantId,
        title: title || 'New Session'
      };

      const response = await this.client.post('/api/chat/session', payload);
      return response.data;
    } catch (error: any) {
      throw new Error(`Failed to create chat session: ${error.message}`);
    }
  }

  async healthCheck(): Promise<any> {
    try {
      const response = await this.client.get('/api/health');
      return response.data;
    } catch (error: any) {
      throw new Error(`Health check failed: ${error.message}`);
    }
  }

  // ==================== FUNCTION LOCATOR ====================

  findFunction(functionName: string, codeContent: string): FunctionInfo[] {
    return this._parseJSCode(codeContent, functionName);
  }

  findAllFunctions(codeContent: string): FunctionInfo[] {
    return this._parseJSCode(codeContent);
  }

  findAsyncFunctions(codeContent: string): FunctionInfo[] {
    const allFuncs = this._parseJSCode(codeContent);
    return allFuncs.filter(f => f.is_async);
  }

  private _parseJSCode(content: string, searchName?: string): FunctionInfo[] {
    const functions: FunctionInfo[] = [];

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

      functions.push(
        new FunctionInfoImpl(
          name,
          'current-file',
          lineNumber,
          'javascript',
          `${isAsync ? 'async ' : ''}function ${name}(${paramsStr})`,
          params,
          isAsync
        )
      );
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

      functions.push(
        new FunctionInfoImpl(
          name,
          'current-file',
          lineNumber,
          'javascript',
          `${isAsync ? 'async ' : ''}const ${name} = (${paramsStr}) =>`,
          params,
          isAsync
        )
      );
    }

    // React components (functions starting with capital letter)
    const componentRegex = /(?:const|function)\s+([A-Z]\w+)\s*[=:\(]/g;

    while ((match = componentRegex.exec(content)) !== null) {
      const name = match[1];
      if (searchName && name.toLowerCase() !== searchName.toLowerCase()) continue;

      const lineNumber = content.substring(0, match.index).split('\n').length;

      functions.push(
        new FunctionInfoImpl(
          name,
          'current-file',
          lineNumber,
          'typescript',
          `${name} (Component)`,
          [],
          false
        )
      );
    }

    return functions;
  }
}

// React Hook for using Brainbox SDK
import { useState, useCallback } from 'react';

export const useBrainbox = (apiUrl: string, apiKey: string, tenantId: string) => {
  const [sdk] = useState(() => new BrainboxReactSDK(apiUrl, apiKey, tenantId));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ingest = useCallback(
    async (sourceType: string, content: string, filePath?: string, metadata?: Record<string, any>) => {
      setLoading(true);
      setError(null);
      try {
        const result = await sdk.ingest(sourceType, content, filePath, metadata);
        return result;
      } catch (err: any) {
        setError(err.message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [sdk]
  );

  const chat = useCallback(
    async (question: string, sessionId?: string) => {
      setLoading(true);
      setError(null);
      try {
        const result = await sdk.chat(question, sessionId);
        return result;
      } catch (err: any) {
        setError(err.message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [sdk]
  );

  const createChatSession = useCallback(
    async (title?: string) => {
      setLoading(true);
      setError(null);
      try {
        const result = await sdk.createChatSession(title);
        return result;
      } catch (err: any) {
        setError(err.message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [sdk]
  );

  // Function locator methods
  const findFunction = useCallback(
    (functionName: string, codeContent: string): FunctionInfo[] => {
      return sdk.findFunction(functionName, codeContent);
    },
    [sdk]
  );

  const findAllFunctions = useCallback(
    (codeContent: string): FunctionInfo[] => {
      return sdk.findAllFunctions(codeContent);
    },
    [sdk]
  );

  const findAsyncFunctions = useCallback(
    (codeContent: string): FunctionInfo[] => {
      return sdk.findAsyncFunctions(codeContent);
    },
    [sdk]
  );

  return {
    ingest,
    chat,
    createChatSession,
    findFunction,
    findAllFunctions,
    findAsyncFunctions,
    loading,
    error
  };
};
