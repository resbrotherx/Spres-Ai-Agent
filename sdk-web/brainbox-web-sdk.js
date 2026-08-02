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
      const payload = { tenant_id: this.tenantId, source_type: sourceType, content, file_path: filePath, metadata: metadata || {} };
      const response = await fetch(`${this.apiUrl}/api/ingest`, { method: 'POST', headers: buildHeaders(this.apiKey), body: JSON.stringify(payload) });
      return response.json();
    }

    async chat(question, sessionId) {
      const payload = { tenant_id: this.tenantId, question, session_id: sessionId };
      const response = await fetch(`${this.apiUrl}/api/chat`, { method: 'POST', headers: buildHeaders(this.apiKey), body: JSON.stringify(payload) });
      return response.json();
    }

    async createChatSession(title) {
      const payload = { tenant_id: this.tenantId, title: title || 'New Session' };
      const response = await fetch(`${this.apiUrl}/api/chat/session`, { method: 'POST', headers: buildHeaders(this.apiKey), body: JSON.stringify(payload) });
      return response.json();
    }

    async listSessions() {
      const response = await fetch(`${this.apiUrl}/api/chat/sessions`, { method: 'POST', headers: buildHeaders(this.apiKey), body: JSON.stringify({ tenant_id: this.tenantId }) });
      return response.json();
    }

    async healthCheck() {
      const response = await fetch(`${this.apiUrl}/api/health`, { method: 'GET', headers: buildHeaders(this.apiKey) });
      return response.json();
    }

    // Fake progressive reveal (works today, no backend changes needed)
    async streamChat(question, sessionId, onChunk, onComplete, onError) {
      try {
        const result = await this.chat(question, sessionId);
        const fullText = result.response || JSON.stringify(result);
        const words = fullText.split(' ');
        for (let i = 0; i < words.length; i++) {
          onChunk((i === 0 ? '' : ' ') + words[i]);
          await new Promise(r => setTimeout(r, 18));
        }
        onComplete?.(result);
      } catch (err) {
        onError?.(err instanceof Error ? err : new Error(String(err)));
      }
    }
  }

  const WIDGET_CSS = `
  .bb-web-root { position: fixed; z-index: 9999; font-family: Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; }
  .bb-web-launcher { display: inline-flex; align-items: center; gap: 8px; border: 0; border-radius: 999px; padding: 0 18px; height: 46px; cursor: pointer; color: #fff; font-weight: 700; font-size: 14px; transition: transform .15s ease, filter .15s ease; }
  .bb-web-launcher:hover { filter: brightness(0.96); }
  .bb-web-launcher:active { transform: scale(0.96); }
  .bb-web-panel { width: 100%; display: flex; flex-direction: column; overflow: hidden; border-radius: 20px; box-shadow: 0 24px 70px rgba(20,10,40,.18); border: 1px solid rgba(255,255,255,.6); margin-bottom: 14px; opacity: 0; transform: translateY(12px) scale(.98); transition: opacity .18s ease, transform .18s ease; }
  .bb-web-panel.bb-open { opacity: 1; transform: translateY(0) scale(1); }
  .bb-web-header { display: flex; align-items: center; gap: 10px; padding: 14px; }
  .bb-web-avatar { width: 34px; height: 34px; border-radius: 999px; display: grid; place-items: center; color: #fff; font-weight: 800; font-size: 13px; flex: 0 0 auto; overflow: hidden; }
  .bb-web-avatar img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .bb-web-header-copy { flex: 1; min-width: 0; }
  .bb-web-title { font-weight: 800; font-size: 15px; margin: 0; }
  .bb-web-subtitle { font-size: 11px; opacity: .65; margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .bb-web-close { border: 0; background: transparent; font-size: 20px; cursor: pointer; width: 30px; height: 30px; border-radius: 999px; display: grid; place-items: center; opacity: .7; }
  .bb-web-close:hover { opacity: 1; background: rgba(0,0,0,.06); }
  .bb-web-messages { flex: 1; min-height: 0; overflow-y: auto; padding: 14px; display: flex; flex-direction: column; gap: 10px; }
  .bb-web-row { display: flex; gap: 8px; align-items: flex-end; }
  .bb-web-row.bb-user { justify-content: flex-end; }
  .bb-web-bubble { max-width: 78%; padding: 10px 13px; border-radius: 16px 16px 16px 4px; font-size: 13px; line-height: 1.45; }
  .bb-web-row.bb-user .bb-web-bubble { border-radius: 16px 16px 4px 16px; color: #fff; }
  .bb-web-typing { display: inline-flex; gap: 4px; padding: 10px 13px; }
  .bb-web-typing span { width: 6px; height: 6px; border-radius: 999px; opacity: .35; animation: bbWebPulse 1.1s ease-in-out infinite; }
  .bb-web-typing span:nth-child(2) { animation-delay: .15s; }
  .bb-web-typing span:nth-child(3) { animation-delay: .3s; }
  @keyframes bbWebPulse { 0%,80%,100% { opacity: .25; transform: scale(.85); } 40% { opacity: 1; transform: scale(1); } }
  .bb-web-footer { padding: 10px; border-top: 1px solid rgba(0,0,0,.06); }
  .bb-web-inputrow { display: flex; align-items: center; gap: 8px; border-radius: 999px; padding: 4px 4px 4px 14px; border: 1px solid rgba(0,0,0,.1); }
  .bb-web-input { flex: 1; border: 0; outline: 0; background: transparent; font: inherit; font-size: 13px; padding: 8px 0; }
  .bb-web-send { border: 0; width: 36px; height: 36px; border-radius: 999px; display: grid; place-items: center; color: #fff; cursor: pointer; flex: 0 0 auto; }
  .bb-web-send:hover { filter: brightness(0.95); }
  `;

  function injectStylesOnce() {
    if (document.getElementById('bb-web-widget-styles')) return;
    const style = document.createElement('style');
    style.id = 'bb-web-widget-styles';
    style.textContent = WIDGET_CSS;
    document.head.appendChild(style);
  }

  class BrainboxWebWidget {
    constructor(options) {
      const {
        sdk,
        containerId,
        position = 'bottom-right',
        primaryColor = '#7c3aed',
        accentColor = '#111827',
        backgroundColor = '#ffffff',
        buttonText = 'Chat',
        title = 'Support',
        subtitle = "We're here to help",
        placeholder = 'Ask a question...',
        width = '360px',
        height = '520px',
        logoUrl = '',
        launcherType = 'button' // 'button' | 'icon'
      } = options;

      injectStylesOnce();

      Object.assign(this, {
        sdk, position, primaryColor, accentColor, backgroundColor,
        buttonText, title, subtitle, placeholder, width, height, logoUrl, launcherType
      });
      this.containerId = containerId || 'brainbox-web-widget';
      this.sessionId = null;
      this.open = false;
      this.createWidget();
    }

    createWidget() {
      const root = document.createElement('div');
      root.id = this.containerId;
      root.className = 'bb-web-root';
      root.style.width = this.width;
      root.style.maxWidth = `min(${this.width}, calc(100vw - 24px))`;
      if (this.position.includes('right')) root.style.right = '20px'; else root.style.left = '20px';
      if (this.position.includes('top')) root.style.top = '20px'; else root.style.bottom = '20px';

      this.widgetRoot = root;
      this.buildButton();
      document.body.appendChild(root);
    }

    buildButton() {
      this.root = document.createElement('div');
      this.root.style.display = 'flex';
      this.root.style.flexDirection = 'column';
      this.root.style.alignItems = this.position.includes('right') ? 'flex-end' : 'flex-start';

      this.button = document.createElement('button');
      this.button.className = 'bb-web-launcher';
      this.button.style.background = this.primaryColor;
      if (this.launcherType === 'icon') {
        this.button.style.width = '52px';
        this.button.style.height = '52px';
        this.button.style.padding = '0';
        this.button.innerHTML = this.chatIconSvg();
      } else {
        this.button.innerHTML = `${this.chatIconSvg(16)}<span>${this.buttonText}</span>`;
      }
      this.button.addEventListener('click', () => this.toggleWidget());

      this.root.appendChild(this.button);
      this.widgetRoot.appendChild(this.root);
    }

    chatIconSvg(size = 20) {
      return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a8 8 0 0 1-8 8H7l-4 3 1.3-5.1A8 8 0 1 1 21 12Z"/></svg>`;
    }

    toggleWidget() {
      this.open = !this.open;
      this.open ? this.showPanel() : this.closePanel();
    }

    showPanel() {
      if (this.panel) {
        requestAnimationFrame(() => this.panel.classList.add('bb-open'));
        return;
      }

      this.panel = document.createElement('div');
      this.panel.className = 'bb-web-panel';
      this.panel.style.height = this.height;
      this.panel.style.background = this.backgroundColor;

      const header = document.createElement('div');
      header.className = 'bb-web-header';
      header.style.background = this.hexToRgba(this.primaryColor, 0.08);

      const avatar = document.createElement('div');
      avatar.className = 'bb-web-avatar';
      avatar.style.background = this.primaryColor;
      avatar.innerHTML = this.logoUrl ? `<img src="${this.logoUrl}" alt=""/>` : (this.title || 'AI').slice(0, 2).toUpperCase();
      header.appendChild(avatar);

      const headerCopy = document.createElement('div');
      headerCopy.className = 'bb-web-header-copy';
      headerCopy.innerHTML = `<div class="bb-web-title">${this.title}</div><div class="bb-web-subtitle">${this.subtitle}</div>`;
      header.appendChild(headerCopy);

      const close = document.createElement('button');
      close.className = 'bb-web-close';
      close.innerHTML = '&times;';
      close.addEventListener('click', () => this.toggleWidget());
      header.appendChild(close);

      const messages = document.createElement('div');
      messages.className = 'bb-web-messages';
      this.messagesContainer = messages;

      const footer = document.createElement('div');
      footer.className = 'bb-web-footer';

      const inputRow = document.createElement('div');
      inputRow.className = 'bb-web-inputrow';

      const input = document.createElement('input');
      input.className = 'bb-web-input';
      input.type = 'text';
      input.placeholder = this.placeholder;
      input.addEventListener('keydown', async (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          const val = input.value;
          input.value = '';
          await this.sendMessage(val);
        }
      });
      this.inputElement = input;

      const sendButton = document.createElement('button');
      sendButton.className = 'bb-web-send';
      sendButton.style.background = this.primaryColor;
      sendButton.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>`;
      sendButton.addEventListener('click', async () => {
        const val = input.value;
        input.value = '';
        await this.sendMessage(val);
      });

      inputRow.appendChild(input);
      inputRow.appendChild(sendButton);
      footer.appendChild(inputRow);

      this.panel.appendChild(header);
      this.panel.appendChild(messages);
      this.panel.appendChild(footer);
      this.root.insertBefore(this.panel, this.button);

      requestAnimationFrame(() => this.panel.classList.add('bb-open'));
    }

    closePanel() {
      if (!this.panel) return;
      this.panel.classList.remove('bb-open');
      setTimeout(() => {
        if (this.panel && !this.open) {
          this.panel.remove();
          this.panel = null;
        }
      }, 180);
    }

    hexToRgba(hex, alpha) {
      const clean = hex.replace('#', '');
      const bigint = parseInt(clean.length === 3 ? clean.split('').map(c => c + c).join('') : clean, 16);
      const r = (bigint >> 16) & 255, g = (bigint >> 8) & 255, b = bigint & 255;
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    addMessage(role, text) {
      const row = document.createElement('div');
      row.className = `bb-web-row ${role === 'user' ? 'bb-user' : ''}`;

      const bubble = document.createElement('div');
      bubble.className = 'bb-web-bubble';
      bubble.style.background = role === 'user' ? this.primaryColor : this.hexToRgba(this.accentColor, 0.06);
      bubble.style.color = role === 'user' ? '#fff' : this.accentColor;
      bubble.innerText = text;

      row.appendChild(bubble);
      this.messagesContainer.appendChild(row);
      this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
      return bubble;
    }

    addTyping() {
      const row = document.createElement('div');
      row.className = 'bb-web-row';
      row.innerHTML = `<div class="bb-web-typing" style="background:${this.hexToRgba(this.accentColor, 0.06)};border-radius:16px 16px 16px 4px;"><span style="background:${this.accentColor}"></span><span style="background:${this.accentColor}"></span><span style="background:${this.accentColor}"></span></div>`;
      this.messagesContainer.appendChild(row);
      this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
      return row;
    }

    async sendMessage(text) {
      if (!text || !text.trim()) return;
      this.addMessage('user', text);
      const typingRow = this.addTyping();
      let assistantBubble = null;

      await this.sdk.streamChat(
        text,
        this.sessionId,
        chunk => {
          if (!assistantBubble) {
            typingRow.remove();
            assistantBubble = this.addMessage('assistant', '');
          }
          assistantBubble.innerText += chunk;
          this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
        },
        result => {
          if (result?.session_id) this.sessionId = result.session_id;
        },
        error => {
          typingRow.remove();
          this.addMessage('assistant', `Error: ${error.message}`);
        }
      );
    }
  }

  global.BrainboxWebSDK = BrainboxWebSDK;
  global.BrainboxWebWidget = BrainboxWebWidget;
})(window);