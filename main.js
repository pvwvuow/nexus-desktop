const { app, BrowserWindow, ipcMain, Notification, Tray, Menu, nativeImage, shell, globalShortcut } = require('electron');
const { autoUpdater } = require('electron-updater');
const Store = require('electron-store');
const path = require('path');

// ═══════════════════════════════════════════════════════════
// 🔧 CONFIGURATION
// ═══════════════════════════════════════════════════════════

const store = new Store();
let mainWindow = null;
let updaterWindow = null;
let tray = null;
let isQuitting = false;
let splashWindow = null;

const isDev = process.argv.includes('--dev') || !app.isPackaged;

console.log('🌌 NEXUS Desktop Starting...');
console.log('📦 App Path:', app.getAppPath());
console.log('🔧 Dev Mode:', isDev);
console.log('📍 Version:', app.getVersion());

// Single instance lock
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
    console.log('⚠️ Another instance is already running');
    app.quit();
} else {
    app.on('second-instance', () => {
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
            mainWindow.show();
        }
    });
}

// ═══════════════════════════════════════════════════════════
// ✨ SPLASH SCREEN
// ═══════════════════════════════════════════════════════════

function createSplash() {
    splashWindow = new BrowserWindow({
        width: 500,
        height: 350,
        transparent: true,
        frame: false,
        alwaysOnTop: true,
        skipTaskbar: true,
        webPreferences: { nodeIntegration: false }
    });

    splashWindow.loadURL(`data:text/html;charset=utf-8,
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body {
                    background: transparent;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    height: 100vh;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                }
                .splash {
                    text-align: center;
                    background: linear-gradient(135deg, rgba(26,26,46,0.98), rgba(22,33,62,0.98));
                    backdrop-filter: blur(40px);
                    padding: 50px 60px;
                    border-radius: 28px;
                    border: 1px solid rgba(255,255,255,0.15);
                    box-shadow: 0 30px 60px rgba(0,0,0,0.6);
                }
                .logo {
                    width: 100px;
                    height: 100px;
                    margin: 0 auto 24px;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 50px;
                    animation: pulse 2s ease-in-out infinite;
                    box-shadow: 0 10px 30px rgba(102,126,234,0.4);
                }
                @keyframes pulse {
                    0%, 100% { transform: scale(1); opacity: 1; }
                    50% { transform: scale(1.08); opacity: 0.9; }
                }
                h1 { 
                    color: white; 
                    font-size: 42px; 
                    font-weight: 700;
                    margin-bottom: 12px;
                    letter-spacing: 2px;
                }
                p { 
                    color: rgba(255,255,255,0.6); 
                    font-size: 13px; 
                    letter-spacing: 3px; 
                    text-transform: uppercase;
                }
                .spinner {
                    width: 28px;
                    height: 28px;
                    border: 3px solid rgba(255,255,255,0.1);
                    border-top-color: #667eea;
                    border-radius: 50%;
                    animation: spin 0.8s linear infinite;
                    margin: 28px auto 0;
                }
                @keyframes spin { to { transform: rotate(360deg); } }
            </style>
        </head>
        <body>
            <div class="splash">
                <div class="logo">🌌</div>
                <h1>NEXUS</h1>
                <p>Initializing...</p>
                <div class="spinner"></div>
            </div>
        </body>
        </html>
    `);

    splashWindow.center();
}

// ═══════════════════════════════════════════════════════════
// 🪟 CREATE MAIN WINDOW
// ═══════════════════════════════════════════════════════════

function createWindow() {
    const windowState = store.get('windowState', {
        width: 1400,
        height: 900,
        x: undefined,
        y: undefined,
        isMaximized: false
    });

    mainWindow = new BrowserWindow({
        width: windowState.width,
        height: windowState.height,
        x: windowState.x,
        y: windowState.y,
        minWidth: 1100,
        minHeight: 700,
        frame: false,
        transparent: false,
        backgroundColor: '#1a1a2e',
        show: false,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            enableRemoteModule: false,
            preload: path.join(__dirname, 'preload.js'),
            webSecurity: true
        },
        icon: path.join(__dirname, 'build/icon.png'),
        title: 'NEXUS'
    });

    if (windowState.isMaximized) {
        mainWindow.maximize();
    }

    // Save window state
    const saveState = () => {
        if (!mainWindow) return;
        const bounds = mainWindow.getBounds();
        store.set('windowState', {
            width: bounds.width,
            height: bounds.height,
            x: bounds.x,
            y: bounds.y,
            isMaximized: mainWindow.isMaximized()
        });
    };

    mainWindow.on('resize', saveState);
    mainWindow.on('move', saveState);

    // Load appropriate page
    const accessToken = store.get('accessToken');
    if (accessToken) {
        mainWindow.loadFile(path.join(__dirname, 'src/app.html'));
        console.log('✅ Loaded app.html (user logged in)');
    } else {
        mainWindow.loadFile(path.join(__dirname, 'src/login.html'));
        console.log('✅ Loaded login.html (no token)');
    }

    // Show window after load
    mainWindow.once('ready-to-show', () => {
        if (splashWindow) {
            splashWindow.close();
            splashWindow = null;
        }

        setTimeout(() => {
            mainWindow.show();
            mainWindow.focus();
            
            if (isDev) {
                mainWindow.webContents.openDevTools();
            }
        }, 100);
    });

    // Minimize to tray instead of closing
    mainWindow.on('close', (event) => {
        if (!isQuitting) {
            event.preventDefault();
            mainWindow.hide();
        }
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    // Open external links in browser
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: 'deny' };
    });

    console.log('✅ Main window created');
}

// ═══════════════════════════════════════════════════════════
// 🔄 CREATE UPDATER WINDOW
// ═══════════════════════════════════════════════════════════

function createUpdaterWindow() {
    if (updaterWindow) {
        updaterWindow.focus();
        return;
    }

    updaterWindow = new BrowserWindow({
        width: 600,
        height: 700,
        resizable: false,
        frame: false,
        transparent: false,
        backgroundColor: '#030305',
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        },
        parent: mainWindow,
        modal: false,
        show: false
    });

    updaterWindow.loadFile(path.join(__dirname, 'src/updater.html'));

    updaterWindow.once('ready-to-show', () => {
        updaterWindow.show();
    });

    updaterWindow.on('closed', () => {
        updaterWindow = null;
    });

    console.log('✅ Updater window created');
}

// ═══════════════════════════════════════════════════════════
// 🎯 CREATE TRAY
// ═══════════════════════════════════════════════════════════

function createTray() {
    const iconPath = path.join(__dirname, 'build/icon.png');
    const icon = nativeImage.createFromPath(iconPath);
    
    const trayIcon = process.platform === 'win32' 
        ? icon.resize({ width: 16, height: 16 })
        : icon.resize({ width: 22, height: 22 });
    
    tray = new Tray(trayIcon);
    
    const contextMenu = Menu.buildFromTemplate([
        {
            label: 'Open NEXUS',
            click: () => {
                if (mainWindow) {
                    mainWindow.show();
                    if (process.platform === 'darwin') app.dock.show();
                }
            }
        },
        { type: 'separator' },
        {
            label: `Version ${app.getVersion()}`,
            enabled: false
        },
        {
            label: 'Check for Updates',
            click: () => {
                if (!isDev) {
                    createUpdaterWindow();
                } else {
                    console.log('⏭️ Auto-update disabled in dev mode');
                }
            }
        },
        { type: 'separator' },
        {
            label: 'Quit',
            click: () => {
                isQuitting = true;
                app.quit();
            }
        }
    ]);
    
    tray.setContextMenu(contextMenu);
    tray.setToolTip('NEXUS - Orbital Communication');
    
    tray.on('click', () => {
        if (mainWindow) {
            mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
        }
    });
    
    console.log('✅ Tray icon created');
}

// ═══════════════════════════════════════════════════════════
// 🔄 AUTO UPDATER
// ═══════════════════════════════════════════════════════════

function initAutoUpdater() {
    if (isDev) {
        console.log('⏭️ Auto-updater disabled in dev mode');
        return;
    }

    autoUpdater.logger = console;
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;

    autoUpdater.on('checking-for-update', () => {
        console.log('🔍 Checking for updates...');
        sendToUpdater('checking-for-update');
    });

    autoUpdater.on('update-available', (info) => {
        console.log('🆕 Update available:', info.version);
        sendToUpdater('update-available', {
            version: info.version,
            currentVersion: app.getVersion(),
            releaseDate: info.releaseDate,
            releaseNotes: info.releaseNotes
        });
        
        if (mainWindow) {
            mainWindow.webContents.send('updater-message', {
                event: 'update-available',
                data: { version: info.version }
            });
        }
    });

    autoUpdater.on('update-not-available', () => {
        console.log('✅ NEXUS is up to date');
        sendToUpdater('update-not-available', {
            version: app.getVersion(),
            message: 'You are running the latest version'
        });
        
        if (mainWindow) {
            mainWindow.webContents.send('updater-message', {
                event: 'update-not-available',
                data: {}
            });
        }
    });

    autoUpdater.on('download-progress', (progress) => {
        const percent = Math.round(progress.percent);
        console.log(`📥 Download: ${percent}%`);
        
        sendToUpdater('download-progress', {
            percent: progress.percent,
            transferred: progress.transferred,
            total: progress.total,
            bytesPerSecond: progress.bytesPerSecond
        });

        if (mainWindow) {
            mainWindow.webContents.send('updater-message', {
                event: 'download-progress',
                data: { percent: progress.percent }
            });
        }

        if (tray) {
            tray.setToolTip(`NEXUS - Downloading: ${percent}%`);
        }
    });

    autoUpdater.on('update-downloaded', (info) => {
        console.log('✅ Update downloaded:', info.version);
        
        sendToUpdater('update-downloaded', {
            version: info.version,
            message: 'Update ready to install'
        });

        if (mainWindow) {
            mainWindow.webContents.send('updater-message', {
                event: 'update-downloaded',
                data: { version: info.version }
            });
        }

        if (Notification.isSupported()) {
            const notification = new Notification({
                title: '✨ Update Ready',
                body: `NEXUS ${info.version} is ready. Restart to install.`,
                icon: path.join(__dirname, 'build/icon.png')
            });
            
            notification.on('click', () => {
                isQuitting = true;
                autoUpdater.quitAndInstall();
            });
            
            notification.show();
        }

        if (tray) {
            tray.setToolTip('NEXUS - Orbital Communication');
        }
    });

    autoUpdater.on('error', (err) => {
        console.error('❌ Update error:', err);
        
        sendToUpdater('update-error', {
            message: err.message || 'Update failed'
        });

        if (mainWindow) {
            mainWindow.webContents.send('updater-message', {
                event: 'update-error',
                data: { message: err.message }
            });
        }
    });

    // Check on startup (after 5s)
    setTimeout(() => {
        console.log('🔍 Auto-checking for updates...');
        autoUpdater.checkForUpdates();
    }, 5000);

    // Check every 4 hours
    setInterval(() => {
        autoUpdater.checkForUpdates();
    }, 4 * 60 * 60 * 1000);
}

function sendToUpdater(event, data = {}) {
    if (updaterWindow && !updaterWindow.isDestroyed()) {
        updaterWindow.webContents.send('updater-message', { event, data });
    }
}

// ═══════════════════════════════════════════════════════════
// ⌨️ GLOBAL SHORTCUTS
// ═══════════════════════════════════════════════════════════

function registerShortcuts() {
    // Show/Hide window
    globalShortcut.register('CommandOrControl+Shift+O', () => {
        if (mainWindow) {
            mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
        }
    });

    // Mute shortcut
    globalShortcut.register('CommandOrControl+Shift+M', () => {
        if (mainWindow) {
            mainWindow.webContents.send('global-shortcut-mute');
        }
    });

    // Deafen shortcut
    globalShortcut.register('CommandOrControl+Shift+D', () => {
        if (mainWindow) {
            mainWindow.webContents.send('global-shortcut-deafen');
        }
    });

    console.log('⌨️ Global shortcuts registered');
}

// ═══════════════════════════════════════════════════════════
// 📡 IPC HANDLERS
// ═══════════════════════════════════════════════════════════

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🪟 Window Controls
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ipcMain.on('minimize-window', () => {
    if (mainWindow) mainWindow.minimize();
});

ipcMain.on('maximize-window', () => {
    if (mainWindow) {
        mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize();
    }
});

ipcMain.on('close-window', () => {
    if (mainWindow) mainWindow.close();
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🔐 Authentication
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ipcMain.on('login-success', () => {
    if (mainWindow) {
        mainWindow.loadFile(path.join(__dirname, 'src/app.html'));
        console.log('✅ User logged in, switched to app.html');
    }
});

ipcMain.on('logout', () => {
    store.delete('accessToken');
    store.delete('userData');
    if (mainWindow) {
        mainWindow.loadFile(path.join(__dirname, 'src/login.html'));
        console.log('✅ User logged out, switched to login.html');
    }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🔄 Auto-Updater Controls
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ipcMain.on('check-for-updates', () => {
    if (!isDev) {
        console.log('🔍 Manual update check requested');
        autoUpdater.checkForUpdates();
    } else {
        console.log('⏭️ Update check skipped in dev mode');
        sendToUpdater('update-error', {
            message: 'Updates disabled in development mode'
        });
    }
});

ipcMain.on('download-update', () => {
    if (!isDev) {
        console.log('📥 Download update requested');
        autoUpdater.downloadUpdate();
    }
});

ipcMain.on('install-update', () => {
    if (!isDev) {
        console.log('🔄 Install update requested');
        isQuitting = true;
        autoUpdater.quitAndInstall(false, true);
    }
});

ipcMain.handle('get-app-version', () => {
    return app.getVersion();
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🖥️ App Controls
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ipcMain.handle('app.getVersion', () => app.getVersion());
ipcMain.handle('app.getName', () => app.getName());
ipcMain.handle('app.getPath', (e, name) => app.getPath(name));

ipcMain.handle('app.minimize', () => {
    if (mainWindow) mainWindow.minimize();
});

ipcMain.handle('app.maximize', () => {
    if (mainWindow) {
        mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize();
    }
    return mainWindow?.isMaximized();
});

ipcMain.handle('app.close', () => {
    if (mainWindow) mainWindow.close();
});

ipcMain.handle('app.quit', () => {
    isQuitting = true;
    app.quit();
});

ipcMain.handle('app.isMaximized', () => {
    return mainWindow?.isMaximized() || false;
});

ipcMain.handle('app.relaunch', () => {
    app.relaunch();
    app.quit();
});

ipcMain.handle('app.installUpdate', () => {
    if (!isDev) {
        isQuitting = true;
        autoUpdater.quitAndInstall();
    }
});

ipcMain.handle('app.openUpdater', () => {
    createUpdaterWindow();
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 💾 Store Operations
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ipcMain.handle('store.get', (e, key, defaultValue) => {
    return store.get(key, defaultValue);
});

ipcMain.handle('store.set', (e, key, value) => {
    store.set(key, value);
});

ipcMain.handle('store.delete', (e, key) => {
    store.delete(key);
});

ipcMain.handle('store.clear', () => {
    store.clear();
});

ipcMain.handle('store.has', (e, key) => {
    return store.has(key);
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🔔 Notifications
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ipcMain.handle('notification.show', (e, options) => {
    if (Notification.isSupported()) {
        const notification = new Notification({
            title: options.title,
            body: options.body,
            icon: options.icon || path.join(__dirname, 'build/icon.png'),
            silent: options.silent || false
        });

        if (options.onClick) {
            notification.on('click', () => {
                if (mainWindow) {
                    mainWindow.show();
                    mainWindow.focus();
                }
            });
        }

        notification.show();
        return true;
    }
    return false;
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🔗 Shell Operations
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ipcMain.handle('shell.openExternal', (e, url) => {
    shell.openExternal(url);
});

ipcMain.handle('shell.showItemInFolder', (e, fullPath) => {
    shell.showItemInFolder(fullPath);
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🪟 Window Operations
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ipcMain.handle('window.setAlwaysOnTop', (e, flag) => {
    if (mainWindow) mainWindow.setAlwaysOnTop(flag);
});

ipcMain.handle('window.flashFrame', () => {
    if (mainWindow) mainWindow.flashFrame(true);
});

console.log('✅ IPC handlers registered');

// ═══════════════════════════════════════════════════════════
// 🎬 APP LIFECYCLE
// ═══════════════════════════════════════════════════════════

app.whenReady().then(() => {
    console.log('✅ Electron app ready');
    
    createSplash();
    
    setTimeout(() => {
        createWindow();
        createTray();
        initAutoUpdater();
        registerShortcuts();
    }, 1500);

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        } else if (mainWindow) {
            mainWindow.show();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('before-quit', () => {
    isQuitting = true;
    globalShortcut.unregisterAll();
});

app.on('will-quit', () => {
    globalShortcut.unregisterAll();
});

// ═══════════════════════════════════════════════════════════
// 🛡️ SECURITY
// ═══════════════════════════════════════════════════════════

app.on('web-contents-created', (event, contents) => {
    contents.on('will-navigate', (event, navigationUrl) => {
        const parsedUrl = new URL(navigationUrl);
        
        if (parsedUrl.protocol !== 'file:') {
            event.preventDefault();
            console.warn('⚠️ Blocked navigation to:', navigationUrl);
        }
    });

    contents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: 'deny' };
    });
});

console.log('🌌 NEXUS Desktop ready to orbit!');