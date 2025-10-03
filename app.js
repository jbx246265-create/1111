(() => {
  const $ = (sel) => document.querySelector(sel);

  const el = {
    btnToggle: $('#btnToggle'),
    btnClear: $('#btnClear'),
    btnFullscreen: $('#btnFullscreen'),
    lang: $('#lang'),
    fontRange: $('#fontSize'),
    fontValue: $('#fontValue'),
    autoScroll: $('#autoScroll'),
    darkMode: $('#darkMode'),
    transcript: $('#transcript'),
    interim: $('#interim'),
    warn: $('#supportWarn'),
    dec: $('#decrease'),
    inc: $('#increase')
  };

  // Settings persistence
  const settings = {
    get() {
      try { return JSON.parse(localStorage.getItem('stt-settings') || '{}'); } catch { return {}; }
    },
    set(values) {
      const next = { ...settings.get(), ...values };
      localStorage.setItem('stt-settings', JSON.stringify(next));
    }
  };

  // Apply stored settings
  const initSettings = () => {
    const s = settings.get();
    const font = Number(s.fontSize || 48);
    el.fontRange.value = String(font);
    el.fontValue.textContent = font + ' px';
    el.transcript.style.fontSize = font + 'px';
    el.interim.style.fontSize = Math.max(24, Math.round(font * 0.8)) + 'px';

    if (s.lang) el.lang.value = s.lang;
    if (s.darkMode) document.documentElement.setAttribute('data-theme', 'dark');
    el.darkMode.checked = Boolean(s.darkMode);
    el.autoScroll.checked = s.autoScroll !== false;
  };

  initSettings();

  // Feature: toggle theme
  el.darkMode.addEventListener('change', () => {
    if (el.darkMode.checked) {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
    settings.set({ darkMode: el.darkMode.checked });
  });

  // Feature: font size controls
  const applyFont = (px) => {
    const clamped = Math.min(128, Math.max(24, Math.round(px)));
    el.fontRange.value = String(clamped);
    el.fontValue.textContent = clamped + ' px';
    el.transcript.style.fontSize = clamped + 'px';
    el.interim.style.fontSize = Math.max(24, Math.round(clamped * 0.8)) + 'px';
    settings.set({ fontSize: clamped });
  };

  el.fontRange.addEventListener('input', (e) => applyFont(Number(e.target.value)));
  el.dec.addEventListener('click', () => applyFont(Number(el.fontRange.value) - 4));
  el.inc.addEventListener('click', () => applyFont(Number(el.fontRange.value) + 4));

  // Feature: other settings
  el.autoScroll.addEventListener('change', () => settings.set({ autoScroll: el.autoScroll.checked }));
  el.lang.addEventListener('change', () => settings.set({ lang: el.lang.value }));

  // Fullscreen helpers
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  };
  el.btnFullscreen.addEventListener('click', toggleFullscreen);
  document.addEventListener('dblclick', toggleFullscreen);

  // Clear transcript
  el.btnClear.addEventListener('click', () => {
    el.transcript.textContent = '';
    el.interim.textContent = '';
  });

  // Keyboard shortcuts: Ctrl+= / Ctrl+- for font, Space to start/stop
  document.addEventListener('keydown', (ev) => {
    if ((ev.ctrlKey || ev.metaKey) && (ev.key === '=' || ev.key === '+')) {
      ev.preventDefault(); el.inc.click();
    } else if ((ev.ctrlKey || ev.metaKey) && ev.key === '-') {
      ev.preventDefault(); el.dec.click();
    } else if (ev.code === 'Space') {
      // avoid interfering with range
      if (document.activeElement?.tagName !== 'INPUT') {
        ev.preventDefault(); el.btnToggle.click();
      }
    }
  });

  // Speech Recognition setup
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  let recognition = null;
  let listening = false;
  let manualStop = false;

  if (!SR) {
    el.warn.hidden = false;
  } else {
    recognition = new SR();
    recognition.lang = settings.get().lang || el.lang.value || 'zh-CN';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      listening = true; manualStop = false;
      el.btnToggle.textContent = '停止听';
      el.btnToggle.classList.add('primary');
    };

    recognition.onend = () => {
      listening = false;
      el.btnToggle.textContent = '开始听';
      el.btnToggle.classList.add('primary');
      // Auto-restart unless manually stopped
      if (!manualStop) {
        // small delay improves stability
        setTimeout(() => { try { recognition.start(); } catch {} }, 250);
      }
    };

    recognition.onerror = (e) => {
      // Display simple warning for mic permission or no-speech
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        el.warn.textContent = '请允许麦克风权限后再试。';
        el.warn.hidden = false;
      } else if (e.error === 'no-speech') {
        // ignore; often harmless
      } else {
        el.warn.textContent = '识别出错：' + e.error;
        el.warn.hidden = false;
      }
    };

    recognition.onresult = (event) => {
      let finalText = '';
      let interimText = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i];
        if (res.isFinal) {
          finalText += res[0].transcript;
        } else {
          interimText += res[0].transcript;
        }
      }
      if (finalText) {
        // append a sentence with spacing
        const needBreak = el.transcript.textContent && !el.transcript.textContent.endsWith('\n');
        el.transcript.textContent += (needBreak ? '\n' : '') + finalText.trim();
        el.interim.textContent = '';
        if (el.autoScroll.checked) {
          el.transcript.parentElement.scrollTop = el.transcript.parentElement.scrollHeight;
        }
      }
      el.interim.textContent = interimText.trim();
    };

    // React to language change live
    el.lang.addEventListener('change', () => {
      const wasListening = listening;
      try { if (listening) recognition.stop(); } catch {}
      recognition.lang = el.lang.value;
      if (wasListening) setTimeout(() => { try { recognition.start(); } catch {} }, 150);
    });
  }

  // Toggle start/stop
  el.btnToggle.addEventListener('click', () => {
    if (!recognition) return; // unsupported
    if (!listening) {
      manualStop = false;
      try { recognition.start(); } catch { /* ignore duplicate start */ }
    } else {
      manualStop = true;
      try { recognition.stop(); } catch {}
    }
  });
})();

