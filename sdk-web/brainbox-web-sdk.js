(function (global) {
  function buildHeaders(apiKey) {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    };
  }

  class BrainboxWebSDK {
    constructor(apiUrl, apiKey, tenantId) {
      this.apiUrl = apiUrl.replace(/\/$/, '');
      this.apiKey = apiKey;
      this.tenantId = tenantId;
    }

    async ingest(sourceType, content, filePath, metadata) {
      const payload = {
        tenant_id: this.tenantId,
        source_type: sourceType,
        content,
        file_path: filePath,
        metadata: metadata || {}
      };

      const response = await fetch(`${this.apiUrl}/api/ingest`, {
        method: 'POST',
        headers: buildHeaders(this.apiKey),
        body: JSON.stringify(payload)
      });

      return response.json();
    }

    async chat(question, sessionId) {
      const payload = {
        tenant_id: this.tenantId,
        question,
        session_id: sessionId
      };

      const response = await fetch(`${this.apiUrl}/api/chat`, {
        method: 'POST',
        headers: buildHeaders(this.apiKey),
        body: JSON.stringify(payload)
      });

      return response.json();
    }

    async createChatSession(title) {
      const payload = {
        tenant_id: this.tenantId,
        title: title || 'New Session'
      };

      const response = await fetch(`${this.apiUrl}/api/chat/session`, {
        method: 'POST',
        headers: buildHeaders(this.apiKey),
        body: JSON.stringify(payload)
      });

      return response.json();
    }

    async healthCheck() {
      const response = await fetch(`${this.apiUrl}/api/health`, {
        method: 'GET',
        headers: buildHeaders(this.apiKey)
      });
      return response.json();
    }

    async streamChat(question, sessionId, onChunk, onComplete, onError) {
      try {
        const payload = {
          tenant_id: this.tenantId,
          question,
          session_id: sessionId
        };

        const response = await fetch(`${this.apiUrl}/api/chat/stream`, {
          method: 'POST',
          headers: buildHeaders(this.apiKey),
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(errorText || `Stream request failed: ${response.status}`);
        }

        if (!response.body) {
          const json = await response.json();
          onChunk(json.response || '');
          onComplete?.(json);
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          onChunk(chunk);
        }

        onComplete?.();
      } catch (err) {
        onError?.(err instanceof Error ? err : new Error(String(err)));
      }
    }
  }

  class BrainboxWebWidget {
    constructor(options) {
      const {
        sdk,
        containerId,
        position = 'bottom-right',
        primaryColor = '#2563EB',
        accentColor = '#111827',
        buttonText = 'Support',
        placeholder = 'Ask a question...',
        width = '360px',
        height = '520px'
      } = options;

      this.sdk = sdk;
      this.position = position;
      this.primaryColor = primaryColor;
      this.accentColor = accentColor;
      this.buttonText = buttonText;
      this.placeholder = placeholder;
      this.width = width;
      this.height = height;
      this.containerId = containerId || 'brainbox-web-widget';
      this.sessionId = null;
      this.open = false;
      this.createWidget();
    }

    createWidget() {
      const root = document.createElement('div');
      root.id = this.containerId;
      root.style.position = 'fixed';
      root.style.zIndex = '9999';
      root.style.width = this.width;
      root.style.fontFamily = 'system-ui, sans-serif';
      root.style.boxSizing = 'border-box';

      if (this.position.includes('right')) {
        root.style.right = '20px';
      } else {
        root.style.left = '20px';
      }

      if (this.position.includes('top')) {
        root.style.top = '20px';
      } else {
        root.style.bottom = '20px';
      }

      this.widgetRoot = root;
      this.buildButton();
      document.body.appendChild(root);
    }

    buildButton() {
      this.root = document.createElement('div');
      this.root.style.position = 'relative';
      this.root.style.width = '100%';
      this.root.style.height = 'auto';

      this.button = document.createElement('button');
      this.button.innerText = this.buttonText;
      this.button.style.width = '100%';
      this.button.style.border = 'none';
      this.button.style.borderRadius = '999px';
      this.button.style.padding = '14px 18px';
      this.button.style.cursor = 'pointer';
      this.button.style.background = this.primaryColor;
      this.button.style.color = '#fff';
      this.button.addEventListener('click', () => this.toggleWidget());

      this.root.appendChild(this.button);
      this.widgetRoot.appendChild(this.root);
    }

    toggleWidget() {
      this.open = !this.open;
      if (this.open) {
        this.showPanel();
      } else {
        this.closePanel();
      }
    }

    showPanel() {
      if (this.panel) return;

      this.panel = document.createElement('div');
      this.panel.style.width = this.width;
      this.panel.style.height = this.height;
      this.panel.style.background = '#fff';
      this.panel.style.borderRadius = '24px';
      this.panel.style.boxShadow = '0 24px 80px rgba(15, 23, 42, 0.12)';
      this.panel.style.display = 'flex';
      this.panel.style.flexDirection = 'column';
      this.panel.style.overflow = 'hidden';
      this.panel.style.marginBottom = '12px';

      const header = document.createElement('div');
      header.style.background = this.primaryColor;
      header.style.color = '#fff';
      header.style.padding = '16px';
      header.style.display = 'flex';
      header.style.justifyContent = 'space-between';
      header.style.alignItems = 'center';

      const title = document.createElement('div');
      title.innerText = 'Support Chat';
      title.style.fontWeight = '700';
      title.style.fontSize = '16px';
      header.appendChild(title);

      const close = document.createElement('button');
      close.innerText = '×';
      close.style.border = 'none';
      close.style.background = 'transparent';
      close.style.color = '#fff';
      close.style.fontSize = '20px';
      close.style.cursor = 'pointer';
      close.addEventListener('click', () => this.toggleWidget());
      header.appendChild(close);

      const messages = document.createElement('div');
      messages.style.flex = '1';
      messages.style.padding = '16px';
      messages.style.overflowY = 'auto';
      messages.style.background = '#F8FAFC';
      this.messagesContainer = messages;

      const footer = document.createElement('div');
      footer.style.padding = '12px';
      footer.style.background = '#fff';
      footer.style.borderTop = '1px solid #E2E8F0';

      const input = document.createElement('input');
      input.type = 'text';
      input.placeholder = this.placeholder;
      input.style.width = '100%';
      input.style.padding = '12px 14px';
      input.style.border = '1px solid #CBD5E1';
      input.style.borderRadius = '999px';
      input.style.boxSizing = 'border-box';
      input.addEventListener('keydown', async (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          await this.sendMessage(input.value);
          input.value = '';
        }
      });
      this.inputElement = input;

      const sendButton = document.createElement('button');
      sendButton.innerText = 'Send';
      sendButton.style.marginTop = '8px';
      sendButton.style.width = '100%';
      sendButton.style.border = 'none';
      sendButton.style.borderRadius = '14px';
      sendButton.style.padding = '12px';
      sendButton.style.background = this.accentColor;
      sendButton.style.color = '#fff';
      sendButton.style.cursor = 'pointer';
      sendButton.addEventListener('click', async () => {
        await this.sendMessage(input.value);
        input.value = '';
      });

      footer.appendChild(input);
      footer.appendChild(sendButton);

      this.panel.appendChild(header);
      this.panel.appendChild(messages);
      this.panel.appendChild(footer);
      this.root.insertBefore(this.panel, this.button);
    }

    closePanel() {
      if (this.panel) {
        this.panel.remove();
        this.panel = null;
      }
    }

    addMessage(role, text) {
      if (!this.messagesContainer) return;

      const messageEl = document.createElement('div');
      messageEl.style.marginBottom = '12px';
      messageEl.style.display = 'flex';
      messageEl.style.justifyContent = role === 'user' ? 'flex-end' : 'flex-start';

      const bubble = document.createElement('div');
      bubble.innerText = text;
      bubble.style.padding = '12px 14px';
      bubble.style.borderRadius = '18px';
      bubble.style.maxWidth = '80%';
      bubble.style.background = role === 'user' ? this.primaryColor : this.accentColor;
      bubble.style.color = '#fff';

      messageEl.appendChild(bubble);
      this.messagesContainer.appendChild(messageEl);
      this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    }

    async sendMessage(text) {
      if (!text.trim()) return;
      this.addMessage('user', text);
      this.addMessage('assistant', 'Typing...');
      const assistantBubble = this.messagesContainer.lastChild?.querySelector('div');

      await this.sdk.streamChat(
        text,
        this.sessionId,
        chunk => {
          if (assistantBubble) {
            assistantBubble.innerText = chunk;
          }
        },
        result => {
          if (result?.session_id) {
            this.sessionId = result.session_id;
          }
        },
        error => {
          if (assistantBubble) {
            assistantBubble.innerText = `Error: ${error.message}`;
          }
        }
      );
    }
  }

  global.BrainboxWebSDK = BrainboxWebSDK;
  global.BrainboxWebWidget = BrainboxWebWidget;
})(window);
