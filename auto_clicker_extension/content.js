// ═══════════════════════════════════════════════════
//  AUTO CLICKER PRO – Content Script
//  Handles clicking, keybind detection, mouse tracking
// ═══════════════════════════════════════════════════

(() => {
  if (window.__autoClickerProLoaded) return;
  window.__autoClickerProLoaded = true;

  let settings = {
    interval: 100,
    mode: 'unlimited',
    clickCount: 100,
    clickType: 'left',
    startKey: { key: 'F6', code: 'F6', ctrl: false, shift: false, alt: false },
    stopKey:  { key: 'F7', code: 'F7', ctrl: false, shift: false, alt: false },
  };

  let isRunning = false;
  let totalClicks = 0;
  let mouseX = 0;
  let mouseY = 0;
  let lastClickTime = 0;
  let startTime = 0;
  let statusInterval = null;
  let mainIntervalId = null;

  // --- MINIMAL ON-SCREEN TRACKER ---
  let trackerEl = document.getElementById('ac-pro-tracker');
  if (!trackerEl) {
    trackerEl = document.createElement('div');
    trackerEl.id = 'ac-pro-tracker';
    trackerEl.style.cssText = 'position:fixed;top:10px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.85);color:#0f0;padding:8px 16px;z-index:9999999;font-family:monospace;font-size:14px;border-radius:6px;pointer-events:none;border:1px solid #0f0;display:none;font-weight:bold;';
    document.documentElement.appendChild(trackerEl);
  }
  
  function updateTracker() {
    if (!trackerEl) return;
    if (isRunning) {
      trackerEl.style.display = 'block';
      const modeText = settings.mode === 'count' ? `Set Count (${settings.clickCount})` : 'Unlimited';
      trackerEl.innerText = `Mode: ${modeText} | Clicks: ${totalClicks}`;
    } else {
      trackerEl.style.display = 'none';
    }
  }
  // ---------------------------------

  chrome.storage.local.get('acSettings', (data) => {
    if (data.acSettings) {
      settings = { ...settings, ...data.acSettings };
    }
  });

  chrome.storage.onChanged.addListener((changes) => {
    if (changes.acSettings) {
      settings = { ...settings, ...changes.acSettings.newValue };
    }
  });

  const mousemoveHandler = (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
  };
  document.addEventListener('mousemove', mousemoveHandler, { passive: true });

  function matchesKeybind(e, kb) {
    if (!kb) return false;
    const keyMatch = kb.code ? e.code === kb.code : e.key === kb.key;
    return keyMatch && e.ctrlKey === !!kb.ctrl && e.shiftKey === !!kb.shift && e.altKey === !!kb.alt;
  }

  const keydownHandler = (e) => {
    if (matchesKeybind(e, settings.startKey) && !isRunning) {
      e.preventDefault();
      e.stopPropagation();
      startClicking();
    } else if (matchesKeybind(e, settings.stopKey) && isRunning) {
      e.preventDefault();
      e.stopPropagation();
      stopClicking('Stopped by User Hotkey (F7)');
    }
  };
  document.addEventListener('keydown', keydownHandler, true);

  function performBatchClicks(count) {
    if (count <= 0) return;
    const target = document.elementFromPoint(mouseX, mouseY);
    if (!target) return;

    const buttonCode = settings.clickType === 'right' ? 2 : settings.clickType === 'middle' ? 1 : 0;
    const eventOpts = {
      bubbles: true, cancelable: true, view: window,
      clientX: mouseX, clientY: mouseY,
      screenX: mouseX + window.screenX, screenY: mouseY + window.screenY,
      button: buttonCode, buttons: 1 << buttonCode,
    };

    const eventsToFire = [
      new PointerEvent('pointerdown', eventOpts),
      new MouseEvent('mousedown', eventOpts),
      new PointerEvent('pointerup', eventOpts),
      new MouseEvent('mouseup', eventOpts),
      buttonCode === 0 ? new MouseEvent('click', eventOpts) : new MouseEvent('contextmenu', eventOpts)
    ];

    for (let i = 0; i < count; i++) {
      if (!isRunning) break;

      try {
        for (const ev of eventsToFire) {
          target.dispatchEvent(ev);
        }
      } catch (err) {}

      totalClicks++;

      // Strict enforcement of the user's intent:
      if (String(settings.mode) === 'count') {
        const strictLimit = parseInt(settings.clickCount) || 100;
        if (totalClicks >= strictLimit) {
          stopClicking('count_limit');
          break;
        }
      }
    }
  }

  function startClicking() {
    if (isRunning) return;
    isRunning = true;
    totalClicks = 0;
    startTime = performance.now();
    lastClickTime = startTime;

    sendStatus();

    // A single master interval handles all timing math up to 10,000 cps gracefully.
    mainIntervalId = setInterval(() => {
      if (!isRunning) return;

      const now = performance.now();
      const elapsed = now - lastClickTime;
      const interval = settings.interval;

      if (elapsed >= interval) {
        const theoreticalClicks = Math.floor(elapsed / interval);
        // Soft cap batch chunks to prevent browser freezing if the main thread hung briefly.
        // E.g. at 0.1ms interval, every 10ms boundary it evaluates down to 100 limit chunk safely.
        const maxBatch = Math.min(theoreticalClicks, 100);

        performBatchClicks(maxBatch);
        lastClickTime += (maxBatch * interval);
      }
      updateTracker();
    }, 10);

    statusInterval = setInterval(sendStatus, 250);
  }

  function stopClicking() {
    isRunning = false;
    updateTracker();
    
    if (mainIntervalId) {
      clearInterval(mainIntervalId);
      mainIntervalId = null;
    }
    
    if (statusInterval) {
      clearInterval(statusInterval);
      statusInterval = null;
    }
    
    sendStatus();
  }

  function sendStatus() {
    const elapsed = performance.now() - startTime;
    const cps = elapsed > 0 ? Math.round((totalClicks / elapsed) * 1000) : 0;

    try {
      chrome.runtime.sendMessage({
        type: 'status', running: isRunning, clicks: totalClicks, cps: isRunning ? cps : 0,
      });
    } catch (e) {
      // Clean up orphaned script if extension is reloaded
      stopClicking();
      document.removeEventListener('keydown', keydownHandler, true);
      document.removeEventListener('mousemove', mousemoveHandler, true);
    }
  }

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    switch (msg.type) {
      case 'start':
        if (msg.settings) settings = { ...settings, ...msg.settings };
        startClicking();
        sendResponse({ ok: true });
        break;
      case 'stop':
        stopClicking();
        sendResponse({ ok: true });
        break;
      case 'settingsUpdate':
        if (msg.settings) {
          const wasRunning = isRunning;
          if (wasRunning) stopClicking();
          settings = { ...settings, ...msg.settings };
        }
        sendResponse({ ok: true });
        break;
      case 'getStatus':
        sendStatus();
        sendResponse({ ok: true });
        break;
    }
    return true;
  });

  console.log('[Auto Clicker Pro] Final Master Engine initialized.');
})();
