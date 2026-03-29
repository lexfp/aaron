// ── DOM refs ──
const intervalInput = document.getElementById('interval');
const clickCountInput = document.getElementById('clickCount');
const countRow = document.getElementById('countRow');
const modeUnlimited = document.getElementById('modeUnlimited');
const modeCount = document.getElementById('modeCount');
const startKeyBtn = document.getElementById('startKeyBtn');
const stopKeyBtn = document.getElementById('stopKeyBtn');
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const clicksDone = document.getElementById('clicksDone');
const cpsDisplay = document.getElementById('cpsDisplay');
const speedNote = document.getElementById('speedNote');
const presets = document.querySelectorAll('.preset');
const clickTypeBtns = document.querySelectorAll('[data-click]');

// ── Default settings ──
const DEFAULTS = {
  interval: 100,
  mode: 'infinite',
  clickCount: 100,
  clickType: 'left',
  startKey: { key: 'F6', code: 'F6', ctrl: false, shift: false, alt: false },
  stopKey: { key: 'F7', code: 'F7', ctrl: false, shift: false, alt: false },
};

let settings = { ...DEFAULTS };
let recording = null; // 'start' or 'stop'

// ── Load saved settings ──
chrome.storage.local.get('acSettings', (data) => {
  if (data.acSettings) {
    settings = { ...DEFAULTS, ...data.acSettings };
  }
  applySettingsToUI();
});

function applySettingsToUI() {
  intervalInput.value = settings.interval;
  clickCountInput.value = settings.clickCount;

  // Mode
  if (settings.mode === 'count') {
    modeCount.classList.add('active');
    modeUnlimited.classList.remove('active');
    countRow.classList.remove('hidden');
  } else {
    modeUnlimited.classList.add('active');
    modeCount.classList.remove('active');
    countRow.classList.add('hidden');
  }

  // Keybinds
  startKeyBtn.textContent = formatKeybind(settings.startKey);
  stopKeyBtn.textContent = formatKeybind(settings.stopKey);

  // Click type
  clickTypeBtns.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.click === settings.clickType);
  });

  // Speed note
  updateSpeedNote();

  // Preset highlights
  presets.forEach(p => {
    p.classList.toggle('active', parseFloat(p.dataset.val) === settings.interval);
  });
}

function formatKeybind(kb) {
  const parts = [];
  if (kb.ctrl) parts.push('Ctrl');
  if (kb.alt) parts.push('Alt');
  if (kb.shift) parts.push('Shift');
  parts.push(kb.key);
  return parts.join('+');
}

function saveSettings() {
  chrome.storage.local.set({ acSettings: settings });
  // Notify content scripts of the change
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, { type: 'settingsUpdate', settings }).catch(() => { });
    }
  });
}

function updateSpeedNote() {
  const interval = settings.interval;
  if (interval < 4) {
    const cps = Math.round(1000 / interval);
    speedNote.textContent = `⚡ ~${cps.toLocaleString()} CPS target (browser may limit sub-4ms)`;
  } else {
    const cps = Math.round(1000 / interval);
    speedNote.textContent = `${cps.toLocaleString()} clicks per second`;
  }
}

// ── Interval input ──
intervalInput.addEventListener('input', () => {
  const val = parseFloat(intervalInput.value);
  if (val >= 0.1) {
    settings.interval = val;
    saveSettings();
    updateSpeedNote();
    presets.forEach(p => {
      p.classList.toggle('active', parseFloat(p.dataset.val) === val);
    });
  }
});

// ── Presets ──
presets.forEach(btn => {
  btn.addEventListener('click', () => {
    const val = parseFloat(btn.dataset.val);
    intervalInput.value = val;
    settings.interval = val;
    saveSettings();
    updateSpeedNote();
    presets.forEach(p => p.classList.toggle('active', p === btn));
  });
});

// ── Mode toggle ──
function setMode(newMode) {
  settings.mode = newMode;
  if (newMode === 'count') {
    modeCount.classList.add('active');
    modeUnlimited.classList.remove('active');
    countRow.classList.remove('hidden');
  } else {
    modeUnlimited.classList.add('active');
    modeCount.classList.remove('active');
    countRow.classList.add('hidden');
  }
  saveSettings();
}

modeUnlimited.addEventListener('click', (e) => {
  e.preventDefault();
  setMode('infinite');
});

modeCount.addEventListener('click', (e) => {
  e.preventDefault();
  setMode('count');
});

// ── Click count ──
clickCountInput.addEventListener('input', () => {
  const val = parseInt(clickCountInput.value);
  if (val >= 1) {
    settings.clickCount = val;
    saveSettings();
  }
});

// ── Click type ──
clickTypeBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    settings.clickType = btn.dataset.click;
    clickTypeBtns.forEach(b => b.classList.toggle('active', b === btn));
    saveSettings();
  });
});

// ── Keybind recording ──
function startRecording(which, btnEl) {
  // Cancel any existing recording
  if (recording) {
    document.querySelectorAll('.keybind-btn').forEach(b => b.classList.remove('recording'));
  }

  recording = which;
  btnEl.classList.add('recording');
  btnEl.textContent = '⏺ Press key...';

  function handler(e) {
    e.preventDefault();
    e.stopPropagation();

    // Ignore lone modifier keys
    if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return;

    const kb = {
      key: e.key,
      code: e.code,
      ctrl: e.ctrlKey,
      shift: e.shiftKey,
      alt: e.altKey,
    };

    if (which === 'start') {
      settings.startKey = kb;
    } else {
      settings.stopKey = kb;
    }

    btnEl.classList.remove('recording');
    btnEl.textContent = formatKeybind(kb);
    recording = null;
    saveSettings();

    document.removeEventListener('keydown', handler, true);
  }

  document.addEventListener('keydown', handler, true);
}

startKeyBtn.addEventListener('click', () => startRecording('start', startKeyBtn));
stopKeyBtn.addEventListener('click', () => startRecording('stop', stopKeyBtn));


// ── Listen for status updates from content script ──
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'status') {
    updateStatus(msg);
  }
});

function updateStatus(data) {
  if (data.running) {
    statusDot.classList.add('active');
    statusText.textContent = 'Running';
    statusText.classList.add('running');
    statusText.classList.remove('idle');
  } else {
    statusDot.classList.remove('active');
    statusText.textContent = 'Idle';
    statusText.classList.add('idle');
    statusText.classList.remove('running');
  }

  if (data.clicks !== undefined) {
    clicksDone.textContent = data.clicks.toLocaleString();
  }
  if (data.cps !== undefined) {
    cpsDisplay.textContent = data.cps.toLocaleString();
  }
}

// ── Poll status on open ──
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  if (tabs[0]) {
    chrome.tabs.sendMessage(tabs[0].id, { type: 'getStatus' }).catch(() => { });
  }
});
