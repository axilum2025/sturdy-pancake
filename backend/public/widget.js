// ============================================================
// GiLo AI – Embeddable Chat Widget
// Drop-in <script> tag to add an AI chat bubble to any website
//
// Usage:
//   <script src="https://YOUR_BACKEND/widget.js"
//           data-agent-id="AGENT_ID"
//           data-api-key="API_KEY"
//           data-position="bottom-right"
//           data-theme="dark"
//           data-accent="#3b82f6"
//           data-title="Chat with us"
//           data-welcome="Hello! How can I help?"
//           data-lang="en">
//   </script>
// ============================================================
(function () {
  'use strict';

  // ---- Config from script tag ----
  const scriptTag = document.currentScript || document.querySelector('script[data-agent-id]');
  if (!scriptTag) return;

  const CFG = {
    agentId: scriptTag.getAttribute('data-agent-id') || '',
    apiKey: scriptTag.getAttribute('data-api-key') || '',
    position: scriptTag.getAttribute('data-position') || 'bottom-right',
    theme: scriptTag.getAttribute('data-theme') || 'dark',
    accent: scriptTag.getAttribute('data-accent') || '#3b82f6',
    title: scriptTag.getAttribute('data-title') || 'Assistant',
    welcome: scriptTag.getAttribute('data-welcome') || '',
    lang: scriptTag.getAttribute('data-lang') || 'fr',
    baseUrl: scriptTag.src ? new URL(scriptTag.src).origin : '',
  };

  if (!CFG.agentId || !CFG.baseUrl) {
    console.error('[GiLo Widget] data-agent-id and a valid script src are required.');
    return;
  }

  // ---- Namespace / Scoping ----
  const NS = 'gilo-widget';

  // ---- Styles ----
  const isDark = CFG.theme === 'dark';
  const css = `
    #${NS}-fab {
      position: fixed;
      ${CFG.position.includes('right') ? 'right: 20px;' : 'left: 20px;'}
      ${CFG.position.includes('top') ? 'top: 20px;' : 'bottom: 20px;'}
      width: 56px; height: 56px; border-radius: 50%;
      background: ${CFG.accent};
      color: #fff;
      border: none; cursor: pointer;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
      display: flex; align-items: center; justify-content: center;
      z-index: 2147483646;
      transition: transform 0.2s, box-shadow 0.2s;
      font-size: 24px; line-height: 1;
    }
    #${NS}-fab:hover { transform: scale(1.08); box-shadow: 0 6px 28px rgba(0,0,0,0.4); }
    #${NS}-fab svg { width: 28px; height: 28px; fill: #fff; }
    #${NS}-fab.open svg.chat-icon { display: none; }
    #${NS}-fab:not(.open) svg.close-icon { display: none; }

    #${NS}-panel {
      position: fixed;
      ${CFG.position.includes('right') ? 'right: 20px;' : 'left: 20px;'}
      ${CFG.position.includes('top') ? 'top: 88px;' : 'bottom: 88px;'}
      width: 380px; max-width: calc(100vw - 40px);
      height: 520px; max-height: calc(100vh - 120px);
      border-radius: 16px;
      overflow: hidden;
      display: none; flex-direction: column;
      z-index: 2147483646;
      box-shadow: 0 12px 48px rgba(0,0,0,0.35);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: ${isDark ? '#1e293b' : '#ffffff'};
      color: ${isDark ? '#f1f5f9' : '#1e293b'};
      border: 1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.1)'};
    }
    #${NS}-panel.open { display: flex; }

    #${NS}-header {
      padding: 14px 16px;
      background: ${isDark ? '#0f172a' : '#f1f5f9'};
      border-bottom: 1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)'};
      font-weight: 600; font-size: 15px;
      display: flex; align-items: center; gap: 8px;
    }
    #${NS}-header .dot {
      width: 8px; height: 8px; border-radius: 50%; background: #22c55e;
    }

    #${NS}-messages {
      flex: 1; overflow-y: auto; padding: 16px;
      display: flex; flex-direction: column; gap: 12px;
    }
    #${NS}-messages::-webkit-scrollbar { width: 4px; }
    #${NS}-messages::-webkit-scrollbar-thumb { background: rgba(128,128,128,0.3); border-radius: 2px; }

    .${NS}-msg { max-width: 85%; padding: 10px 14px; border-radius: 12px; font-size: 14px; line-height: 1.5; word-break: break-word; white-space: pre-wrap; }
    .${NS}-msg.user {
      align-self: flex-end;
      background: ${CFG.accent}33;
      border: 1px solid ${CFG.accent}33;
      color: ${isDark ? '#e2e8f0' : '#1e293b'};
    }
    .${NS}-msg.assistant {
      align-self: flex-start;
      background: ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'};
      color: ${isDark ? '#e2e8f0' : '#334155'};
    }
    .${NS}-msg.typing::after {
      content: '●●●';
      animation: ${NS}-blink 1s infinite;
    }
    @keyframes ${NS}-blink { 0%,100%{opacity:.2} 50%{opacity:1} }

    #${NS}-input-area {
      padding: 12px;
      border-top: 1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)'};
      display: flex; gap: 8px; align-items: flex-end;
    }
    #${NS}-input {
      flex: 1; padding: 10px 14px; border-radius: 10px;
      border: 1px solid ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'};
      background: ${isDark ? '#0f172a' : '#f8fafc'};
      color: ${isDark ? '#f1f5f9' : '#1e293b'};
      font-size: 14px; resize: none; outline: none;
      font-family: inherit;
      max-height: 100px; overflow-y: auto;
    }
    #${NS}-input::placeholder { color: ${isDark ? 'rgba(241,245,249,0.4)' : 'rgba(0,0,0,0.35)'}; }
    #${NS}-input:focus { border-color: ${CFG.accent}; }

    #${NS}-send {
      width: 38px; height: 38px; border-radius: 10px;
      background: ${CFG.accent}; border: none; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0; transition: opacity 0.15s;
    }
    #${NS}-send:disabled { opacity: 0.4; cursor: not-allowed; }
    #${NS}-send svg { width: 18px; height: 18px; fill: #fff; }

    #${NS}-powered {
      text-align: center; padding: 6px;
      font-size: 11px; opacity: 0.4;
      border-top: 1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'};
    }
    #${NS}-powered a { color: inherit; text-decoration: none; }
    #${NS}-powered a:hover { text-decoration: underline; }

    @media (max-width: 480px) {
      #${NS}-panel {
        width: calc(100vw - 16px);
        height: calc(100vh - 100px);
        right: 8px !important; left: 8px !important;
        bottom: 76px !important;
        border-radius: 12px;
      }
    }
  `;

  // ---- Create DOM ----
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  // FAB button
  const fab = document.createElement('button');
  fab.id = `${NS}-fab`;
  fab.setAttribute('aria-label', 'Open chat');
  fab.innerHTML = `
    <svg class="chat-icon" viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.2L4 17.2V4h16v12z"/></svg>
    <svg class="close-icon" viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
  `;
  document.body.appendChild(fab);

  // Panel
  const panel = document.createElement('div');
  panel.id = `${NS}-panel`;
  panel.innerHTML = `
    <div id="${NS}-header"><span class="dot"></span>${CFG.title}</div>
    <div id="${NS}-messages"></div>
    <div id="${NS}-input-area">
      <textarea id="${NS}-input" rows="1" placeholder="${CFG.lang === 'fr' ? 'Écrivez votre message…' : 'Type your message…'}"></textarea>
      <button id="${NS}-send" disabled aria-label="Send">
        <svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
      </button>
    </div>
    <div id="${NS}-powered">Powered by <a href="https://gilo.ai" target="_blank" rel="noopener">GiLo AI</a></div>
  `;

  // Fetch agent config to check hideBranding
  fetch(`${CFG.baseUrl}/api/v1/agents/${CFG.agentId}`, {
    headers: CFG.apiKey ? { 'x-api-key': CFG.apiKey } : {},
  }).then(r => r.json()).then(data => {
    if (data?.config?.hideBranding) {
      const pw = document.getElementById(`${NS}-powered`);
      if (pw) pw.style.display = 'none';
    }
  }).catch(() => {});

  document.body.appendChild(panel);

  // ---- Elements ----
  const messagesEl = document.getElementById(`${NS}-messages`);
  const inputEl = document.getElementById(`${NS}-input`);
  const sendBtn = document.getElementById(`${NS}-send`);

  // ---- State ----
  const messages = []; // { role, content }
  let conversationId = null;
  let isStreaming = false;

  // ---- Show welcome ----
  if (CFG.welcome) {
    addMessage('assistant', CFG.welcome);
  }

  // ---- Toggle ----
  fab.addEventListener('click', () => {
    const open = panel.classList.toggle('open');
    fab.classList.toggle('open', open);
    fab.setAttribute('aria-label', open ? 'Close chat' : 'Open chat');
    if (open) inputEl.focus();
  });

  // ---- Input handling ----
  inputEl.addEventListener('input', () => {
    sendBtn.disabled = !inputEl.value.trim() || isStreaming;
    inputEl.style.height = 'auto';
    inputEl.style.height = Math.min(inputEl.scrollHeight, 100) + 'px';
  });

  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!sendBtn.disabled) send();
    }
  });

  sendBtn.addEventListener('click', send);

  // ---- Send message ----
  async function send() {
    const text = inputEl.value.trim();
    if (!text || isStreaming) return;

    addMessage('user', text);
    inputEl.value = '';
    inputEl.style.height = 'auto';
    sendBtn.disabled = true;
    isStreaming = true;

    // Add typing indicator
    const typingEl = addMessage('assistant', '');
    typingEl.classList.add('typing');

    try {
      const endpoint = `${CFG.baseUrl}/api/v1/agents/${CFG.agentId}/chat`;
      const body = {
        messages: messages.filter(m => m.role !== 'system'),
        ...(conversationId ? { conversationId } : {}),
      };

      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${CFG.apiKey}`,
        },
        body: JSON.stringify(body),
      });

      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}`);
      }

      // Read SSE stream
      typingEl.classList.remove('typing');
      typingEl.textContent = '';
      let fullContent = '';

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const payload = line.substring(6);
          if (payload === '[DONE]') continue;

          try {
            const parsed = JSON.parse(payload);
            if (parsed.type === 'conversation') {
              conversationId = parsed.conversationId;
            } else if (parsed.type === 'content' || parsed.content) {
              const chunk = parsed.content || '';
              fullContent += chunk;
              typingEl.textContent = fullContent;
              scrollToBottom();
            } else if (parsed.type === 'error') {
              typingEl.textContent = CFG.lang === 'fr'
                ? '⚠️ Une erreur est survenue.'
                : '⚠️ An error occurred.';
            }
          } catch {
            // not JSON, skip
          }
        }
      }

      // Save assistant message to local state
      if (fullContent) {
        messages.push({ role: 'assistant', content: fullContent });
      } else {
        typingEl.textContent = CFG.lang === 'fr'
          ? 'Pas de réponse reçue.'
          : 'No response received.';
      }

    } catch (err) {
      typingEl.classList.remove('typing');
      typingEl.textContent = CFG.lang === 'fr'
        ? '⚠️ Erreur de connexion.'
        : '⚠️ Connection error.';
      console.error('[GiLo Widget]', err);
    } finally {
      isStreaming = false;
      sendBtn.disabled = !inputEl.value.trim();
    }
  }

  // ---- Helpers ----
  function addMessage(role, content) {
    if (role === 'user') {
      messages.push({ role, content });
    }
    const el = document.createElement('div');
    el.className = `${NS}-msg ${role}`;
    el.textContent = content;
    messagesEl.appendChild(el);
    scrollToBottom();
    return el;
  }

  function scrollToBottom() {
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }
})();
