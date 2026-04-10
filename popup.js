const STORAGE_KEY_ENABLED = 'ob_extension_enabled';

const toggleButton = document.getElementById('toggle-extension');
const statusValue = document.getElementById('status-value');
const statusHint = document.getElementById('status-hint');

let isEnabled = true;

function updateUi(enabled) {
  isEnabled = enabled;
  toggleButton.classList.toggle('enabled', enabled);
  statusValue.textContent = enabled ? 'Aktywne' : 'Wyłączone';
  statusValue.className = `status-value ${enabled ? 'enabled' : 'disabled'}`;
  statusHint.textContent = enabled
    ? 'Włączone na auto1.com. Po wyłączeniu panel i pobieranie danych zostaną zatrzymane.'
    : 'Rozszerzenie jest całkowicie wyłączone. Kliknij ponownie, aby je uruchomić.';
}

async function loadState() {
  const stored = await chrome.storage.local.get([STORAGE_KEY_ENABLED]);
  updateUi(stored[STORAGE_KEY_ENABLED] !== false);
}

toggleButton.addEventListener('click', async () => {
  toggleButton.disabled = true;

  try {
    await chrome.storage.local.set({
      [STORAGE_KEY_ENABLED]: !isEnabled
    });
  } finally {
    toggleButton.disabled = false;
  }
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'local' || !changes[STORAGE_KEY_ENABLED]) {
    return;
  }

  updateUi(changes[STORAGE_KEY_ENABLED].newValue !== false);
});

loadState();