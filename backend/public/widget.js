// ============================================================
// GiLo AI – Embeddable Chat Widget
// Usage:
//   <script src="https://your-api.com/widget.js"
//     data-agent-id="xxx"
//     data-api-key="gilo_xxx"
//     data-color="#3b82f6"
//     data-position="right"
//     data-welcome="Hello! How can I help?"
//     data-title="Chat Assistant"
//   ></script>
// ============================================================
(function () {
  'use strict';

  // Find the script tag to read data attributes
  const scriptTag = document.currentScript || (function () {
    const scripts = document.getElementsByTagName('script');
    return scripts[scripts.length - 1];
  })();

  const CONFIG = {
    agentId: scriptTag.getAttribute('data-agent-id') || '',
    apiKey: scriptTag.getAttribute('data-api-key') || '',
    apiUrl: scriptTag.getAttribute('data-api-url') || scriptTag.src.replace(/\/widget\.js.*$/, ''),
    color: scriptTag.getAttribute('data-color') || '#3b82f6',
    position: scriptTag.getAttribute('data-position') || 'right',
    welcome: scriptTag.getAttribute('data-welcome') || 'Hello! How can I help you?',
    title: scriptTag.getAttribute('data-title') || 'Chat',
    width: scriptTag.getAttribute('data-width') || '380',
    height: scriptTag.getAttribute('data-height') || '520',
  };

  if (!CONFIG.agentId || !CONFIG.apiKey) {
    console.error('[GiLo Widget] data-agent-id and data-api-key are required.');
    return;
  }

  // ---- Styles ----
  const STYLES = `
    #gilo-widget-container {
      position: fixed;
      bottom: 20px;
      ${CONFIG.position === 'left' ? 'left: 20px;' : 'right: 20px;'}
      z-index: 999999;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }

    #gilo-widget-btn {
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: ${CONFIG.color};
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      transition: transform 0.2s, box-shadow 0.2s;
    }
    #gilo-widget-btn:hover {
      transform: scale(1.05);
      box-shadow: 0 6px 20px rgba(0,0,0,0.2);
    }
    #gilo-widget-btn svg {
      width: 24px;
      height: 24px;
      fill: white;
    }

    #gilo-widget-panel {
      display: none;
      width: ${CONFIG.width}px;
      height: ${CONFIG.height}px;
      background: #ffffff;
      border-radius: 12px;
      box-shadow: 0 8px 30px rgba(0,0,0,0.12);
      overflow: hidden;
      flex-direction: column;
      margin-bottom: 12px;
    }
    #gilo-widget-panel.open {
      display: flex;
    }

    #gilo-widget-header {
      background: ${CONFIG.color};
      color: white;
      padding: 14px 16px;
      font-size: 15px;
      font-weight: 600;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    #gilo-widget-header button {
      background: none;
      border: none;
      color: white;
      cursor: pointer;
      font-size: 18px;
      padding: 0 4px;
      opacity: 0.8;
    }
    #gilo-widget-header button:hover { opacity: 1; }

    #gilo-widget-messages {
      flex: 1;
      overflow-y: auto;
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .gilo-msg {
      max-width: 80%;
      padding: 10px 14px;
      border-radius: 12px;
      font-size: 14px;
      line-height: 1.5;
      word-wrap: break-word;
    }
    .gilo-msg.user {
      align-self: flex-end;
      background: ${CONFIG.color};
      color: white;
      border-bottom-right-radius: 4px;
    }
    .gilo-msg.assistant {
      align-self: flex-start;
      background: #f3f4f6;
      color: #111827;
      border-bottom-left-radius: 4px;
    }
    .gilo-msg.typing {
      align-self: flex-start;
      background: #f3f4f6;
      color: #6b7280;
      font-style: italic;
    }

    #gilo-widget-input-area {
      display: flex;
      border-top: 1px solid #e5e7eb;
      padding: 8px;
      gap: 8px;
    }
    #gilo-widget-input {
      flex: 1;
      border: 1px solid #d1d5db;
      border-radius: 8px;
      padding: 8px 12px;
      font-size: 14px;
      outline: none;
      font-family: inherit;
    }
    #gilo-widget-input:focus {
      border-color: ${CONFIG.color};
      box-shadow: 0 0 0 2px ${CONFIG.color}33;
    }
    #gilo-widget-send {
      background: ${CONFIG.color};
      color: white;
      border: none;
      border-radius: 8px;
      padding: 8px 14px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
    }
    #gilo-widget-send:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    #gilo-widget-powered {
      text-align: center;
      padding: 4px;
      font-size: 10px;
      color: #9ca3af;
    }
    #gilo-widget-powered a {
      color: #6b7280;
      text-decoration: none;
    }
  `;

  // ---- Create DOM ----
  const style = document.createElement('style');
  style.textContent = STYLES;
  document.head.appendChild(style);

  const container = document.createElement('div');
  container.id = 'gilo-widget-container';
  container.innerHTML = `
    <div id="gilo-widget-panel">
      <div id="gilo-widget-header">
        <span>${escapeHtml(CONFIG.title)}</span>
        <button id="gilo-widget-close" title="Close">&times;</button>
      </div>
      <div id="gilo-widget-messages"></div>
      <div id="gilo-widget-input-area">
        <input id="gilo-widget-input" type="text" placeholder="Type a message…" autocomplete="off" />
        <button id="gilo-widget-send">Send</button>
      </div>
      <div id="gilo-widget-powered">Powered by <a href="https://gilo.ai" target="_blank">GiLo AI</a></div>
    </div>
    <button id="gilo-widget-btn" title="Open chat">
      <svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/></svg>
    </button>
  `;
  document.body.appendChild(container);

  // ---- State ----
  const messages = [];
  let isOpen = false;
  let isStreaming = false;

  const panel = document.getElementById('gilo-widget-panel');
  const messagesEl = document.getElementById('gilo-widget-messages');
  const input = document.getElementById('gilo-widget-input');
  const sendBtn = document.getElementById('gilo-widget-send');
  const openBtn = document.getElementById('gilo-widget-btn');
  const closeBtn = document.getElementById('gilo-widget-close');

  // ---- Event handlers ----
  openBtn.addEventListener('click', toggleChat);
  closeBtn.addEventListener('click', toggleChat);
  sendBtn.addEventListener('click', sendMessage);
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  function toggleChat() {
    isOpen = !isOpen;
    panel.classList.toggle('open', isOpen);
    if (isOpen) {
      // Show welcome message on first open
      if (messages.length === 0 && CONFIG.welcome) {
        addMessage('assistant', CONFIG.welcome);
      }
      input.focus();
    }
  }

  function addMessage(role, content) {
    messages.push({ role, content });
    const div = document.createElement('div');
    div.className = 'gilo-msg ' + role;
    div.textContent = content;
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return div;
  }

  async function sendMessage() {
    const text = input.value.trim();
    if (!text || isStreaming) return;

    addMessage('user', text);
    input.value = '';
    isStreaming = true;
    sendBtn.disabled = true;

    // Show typing indicator
    const typingEl = document.createElement('div');
    typingEl.className = 'gilo-msg typing';
    typingEl.textContent = '…';
    messagesEl.appendChild(typingEl);
    messagesEl.scrollTop = messagesEl.scrollHeight;

    try {
      const apiMessages = messages.filter(m => m.role !== 'typing').map(m => ({
        role: m.role,
        content: m.content,
      }));

      const response = await fetch(
        CONFIG.apiUrl + '/api/v1/agents/' + CONFIG.agentId + '/chat',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + CONFIG.apiKey,
          },
          body: JSON.stringify({ messages: apiMessages, stream: true }),
        }
      );

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(err.error || 'Request failed');
      }

      // Remove typing indicator
      typingEl.remove();

      // Create assistant message element
      const assistantEl = document.createElement('div');
      assistantEl.className = 'gilo-msg assistant';
      messagesEl.appendChild(assistantEl);

      let fullContent = '';
      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const lines = decoder.decode(value).split('\n');
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.substring(6);
          if (data === '[DONE]') break;

          try {
            const parsed = JSON.parse(data);
            if (parsed.type === 'content') {
              fullContent += parsed.content;
              assistantEl.textContent = fullContent;
              messagesEl.scrollTop = messagesEl.scrollHeight;
            }
          } catch (e) {
            // Skip unparseable lines
          }
        }
      }

      messages.push({ role: 'assistant', content: fullContent });
    } catch (error) {
      typingEl.remove();
      const errEl = document.createElement('div');
      errEl.className = 'gilo-msg assistant';
      errEl.textContent = 'Error: ' + error.message;
      errEl.style.color = '#ef4444';
      messagesEl.appendChild(errEl);
    } finally {
      isStreaming = false;
      sendBtn.disabled = false;
      input.focus();
    }
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
})();
