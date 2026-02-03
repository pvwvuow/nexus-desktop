const { contextBridge, ipcRenderer } = require('electron');

// ═══════════════════════════════════════════════════════════
// 🌉 NEXUS ELECTRON API BRIDGE
// ═══════════════════════════════════════════════════════════

contextBridge.exposeInMainWorld('electron', {
    // App info & controls
    app: {
        getVersion: () => ipcRenderer.invoke('app.getVersion'),
        getName: () => ipcRenderer.invoke('app.getName'),
        getPath: (name) => ipcRenderer.invoke('app.getPath', name),
        minimize: () => ipcRenderer.invoke('app.minimize'),
        maximize: () => ipcRenderer.invoke('app.maximize'),
        close: () => ipcRenderer.invoke('app.close'),
        quit: () => ipcRenderer.invoke('app.quit'),
        isMaximized: () => ipcRenderer.invoke('app.isMaximized'),
        relaunch: () => ipcRenderer.invoke('app.relaunch'),
        installUpdate: () => ipcRenderer.invoke('app.installUpdate')
    },

    // Persistent storage
    store: {
        get: (key, defaultValue) => ipcRenderer.invoke('store.get', key, defaultValue),
        set: (key, value) => ipcRenderer.invoke('store.set', key, value),
        delete: (key) => ipcRenderer.invoke('store.delete', key),
        clear: () => ipcRenderer.invoke('store.clear'),
        has: (key) => ipcRenderer.invoke('store.has', key)
    },

    // Notifications
    showNotification: (options) => ipcRenderer.invoke('notification.show', options),

    // External links & files
    openExternal: (url) => ipcRenderer.invoke('shell.openExternal', url),
    showItemInFolder: (path) => ipcRenderer.invoke('shell.showItemInFolder', path),

    // Window controls
    window: {
        setAlwaysOnTop: (flag) => ipcRenderer.invoke('window.setAlwaysOnTop', flag),
        flashFrame: () => ipcRenderer.invoke('window.flashFrame')
    },

    // Update events
    onUpdateAvailable: (callback) => {
        ipcRenderer.on('update-available', (event, info) => callback(info));
    },
    onUpdateDownloaded: (callback) => {
        ipcRenderer.on('update-downloaded', (event, info) => callback(info));
    },
    onUpdateProgress: (callback) => {
        ipcRenderer.on('update-download-progress', (event, progress) => callback(progress));
    },
    onUpdateError: (callback) => {
        ipcRenderer.on('update-error', (event, error) => callback(error));
    },

    // Global shortcuts
    onGlobalShortcut: (callback) => {
        ipcRenderer.on('global-shortcut-mute', () => callback('mute'));
        ipcRenderer.on('global-shortcut-deafen', () => callback('deafen'));
    }
});

// ═══════════════════════════════════════════════════════════
// 🪟 TITLEBAR API (برای دکمه‌های window control)
// ═══════════════════════════════════════════════════════════

contextBridge.exposeInMainWorld('electronAPI', {
    minimizeWindow: () => ipcRenderer.send('minimize-window'),
    maximizeWindow: () => ipcRenderer.send('maximize-window'),
    closeWindow: () => ipcRenderer.send('close-window')
});

// ═══════════════════════════════════════════════════════════
// 🌐 PLATFORM DETECTION
// ═══════════════════════════════════════════════════════════

contextBridge.exposeInMainWorld('platform', {
    os: process.platform,
    isElectron: true,
    electronVersion: process.versions.electron,
    nodeVersion: process.versions.node,
    chromeVersion: process.versions.chrome
});

console.log('🌉 NEXUS Preload script loaded');
console.log('🌌 Platform:', process.platform);
console.log('⚡ Electron:', process.versions.electron);