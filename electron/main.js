require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') })

const {
  app, BrowserWindow, Tray, Menu, nativeImage,
  ipcMain, Notification, dialog,
} = require('electron')

// Evitar que Chrome throttlee timers y rendering cuando la ventana está en segundo plano
app.commandLine.appendSwitch('disable-renderer-backgrounding')
app.commandLine.appendSwitch('disable-background-timer-throttling')
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows')
// Mejor gestión de memoria V8
app.commandLine.appendSwitch('js-flags', '--max-old-space-size=512 --expose-gc')
const path = require('path')
const fs   = require('fs')
const isDev = !app.isPackaged

let mainWindow = null
let tray = null
let autoUpdater = null

/* ── ÍCONO DE APLICACIÓN ────────────────────────────────── */
const ICON_PATH = path.join(__dirname, 'icon.png')

function createTrayIcon() {
  try {
    if (fs.existsSync(ICON_PATH)) {
      return nativeImage.createFromPath(ICON_PATH)
    }
  } catch {}
  return nativeImage.createEmpty()
}

/* ── VENTANA PRINCIPAL ──────────────────────────────────── */
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280, height: 840,
    minWidth: 1024, minHeight: 600,
    title: 'LabStock — Lab. Clínico Los Ángeles',
    backgroundColor: '#0E1419', // evita flash blanco al cargar en modo oscuro
    icon: ICON_PATH,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      backgroundThrottling: false,  // mantiene Realtime activo aunque no sea la ventana enfocada
      spellcheck: false,            // menos overhead en inputs de texto
    },
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
    mainWindow.focus()
  })

  // ── SEGURIDAD: bloquear DevTools en producción ──────────
  if (!isDev) {
    mainWindow.webContents.on('devtools-opened', () => {
      mainWindow.webContents.closeDevTools()
    })
    mainWindow.webContents.on('before-input-event', (event, input) => {
      const blocked =
        input.key === 'F12' ||
        (input.control && input.shift && ['I','J','C','U'].includes(input.key.toUpperCase()))
      if (blocked) event.preventDefault()
    })
    // Deshabilitar menú contextual (inspeccionar elemento)
    mainWindow.webContents.on('context-menu', (e) => e.preventDefault())
  }

  // ── SEGURIDAD: bloquear navegación a URLs externas ──────
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const isLocal = url.startsWith('file://') || url.startsWith('http://localhost')
    if (!isLocal) event.preventDefault()
  })

  // ── SEGURIDAD: bloquear window.open() ───────────────────
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))

  mainWindow.on('close', (e) => {
    if (tray && !app.isQuitting) {
      e.preventDefault()
      mainWindow.hide()
    }
  })

  /* ── MENÚ — solo lo esencial para técnicos ── */
  const menu = Menu.buildFromTemplate([
    {
      label: 'Archivo',
      submenu: [
        {
          label: 'Minimizar a bandeja',
          accelerator: 'CmdOrCtrl+M',
          click: () => mainWindow.hide(),
        },
        { type: 'separator' },
        {
          label: 'Cerrar LabStock',
          accelerator: 'CmdOrCtrl+Q',
          click: () => { app.isQuitting = true; app.quit() },
        },
      ],
    },
    {
      label: 'Ayuda',
      submenu: [
        {
          label: 'Buscar actualizaciones',
          click: () => {
            if (isDev) {
              dialog.showMessageBox(mainWindow, { type:'info', title:'LabStock', message:'Las actualizaciones no están disponibles en modo desarrollo.', buttons:['OK'] })
              return
            }
            mainWindow._manualCheck = true
            autoUpdater.checkForUpdates()
          },
        },
        { type: 'separator' },
        {
          label: 'Acerca de LabStock',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'LabStock',
              message: `LabStock v${app.getVersion()}`,
              detail: 'Laboratorio Clínico Los Ángeles\nCosta Sur, Guatemala\nSistema de gestión de inventario',
              buttons: ['Cerrar'],
            })
          },
        },
      ],
    },
  ])
  Menu.setApplicationMenu(menu)
}

/* ── BANDEJA ────────────────────────────────────────────── */
function createTray() {
  const icon = createTrayIcon()
  tray = new Tray(icon)
  tray.setToolTip('LabStock — Lab. Clínico Los Ángeles')
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Abrir LabStock', click: () => { mainWindow.show(); mainWindow.focus() } },
    { type: 'separator' },
    { label: 'Cerrar', click: () => { app.isQuitting = true; app.quit() } },
  ]))
  tray.on('click', () => {
    if (mainWindow.isVisible()) mainWindow.hide()
    else { mainWindow.show(); mainWindow.focus() }
  })
}

/* ── IPC: NOTIFICACIÓN ──────────────────────────────────── */
ipcMain.handle('show-notification', (_, { title, body }) => {
  if (Notification.isSupported()) new Notification({ title, body }).show()
})

/* ── IPC: VERSIÓN ───────────────────────────────────────── */
ipcMain.handle('get-app-version', () => app.getVersion())

/* ── IPC: BADGE BANDEJA ─────────────────────────────────── */
ipcMain.handle('update-alert-badge', (_, count) => {
  if (!tray) return
  tray.setToolTip(
    count > 0
      ? `LabStock — ${count} alerta${count > 1 ? 's' : ''} activa${count > 1 ? 's' : ''}`
      : 'LabStock — Todo en orden'
  )
})

/* ── IPC: EXPORTAR ARCHIVO (diálogo nativo) ─────────────── */
ipcMain.handle('save-file', async (_, { defaultPath, content }) => {
  const { filePath, canceled } = await dialog.showSaveDialog(mainWindow, {
    defaultPath,
    filters: [{ name: 'CSV', extensions: ['csv'] }],
  })
  if (canceled || !filePath) return { canceled: true }
  fs.writeFileSync(filePath, content, 'utf8')
  return { filePath }
})

/* ── IPC: EXPORTAR XLSX (diálogo nativo, datos en base64) ── */
ipcMain.handle('save-xlsx', async (_, { defaultPath, data }) => {
  const { filePath, canceled } = await dialog.showSaveDialog(mainWindow, {
    defaultPath,
    filters: [{ name: 'Excel', extensions: ['xlsx'] }],
  })
  if (canceled || !filePath) return { canceled: true }
  const buffer = Buffer.from(data, 'base64')
  fs.writeFileSync(filePath, buffer)
  return { filePath }
})

/* ── IPC: IMPORTAR ARCHIVO (diálogo nativo) ─────────────── */
ipcMain.handle('open-file', async () => {
  const { filePaths, canceled } = await dialog.showOpenDialog(mainWindow, {
    filters: [{ name: 'CSV', extensions: ['csv'] }],
    properties: ['openFile'],
  })
  if (canceled || !filePaths.length) return { canceled: true }
  const content = fs.readFileSync(filePaths[0], 'utf8')
  return { content, filePath: filePaths[0] }
})

/* ── IPC: CREAR USUARIO (service role — solo main process) ─ */
ipcMain.handle('create-user', async (_, { email, password, nombre, rol, sedeId, permisos }) => {
  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const serviceKey  = process.env.SUPABASE_SERVICE_KEY
  if (!supabaseUrl || !serviceKey) return { error: 'Credenciales de Supabase no configuradas.' }

  try {
    const { createClient } = require('@supabase/supabase-js')
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data, error: authErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { nombre, rol, sede_id: sedeId || '' },
    })
    if (authErr) return { error: authErr.message }

    // Actualizar perfil con sede_id, rol y permisos (el trigger ya crea la fila base)
    const profileUpdate = { nombre, rol, sede_id: sedeId || null }
    if (permisos) profileUpdate.permisos = permisos
    await admin.from('profiles').update(profileUpdate).eq('id', data.user.id)

    return { success: true }
  } catch (e) {
    return { error: e.message }
  }
})

/* ── IPC: ACTUALIZAR USUARIO (rol, permisos, sede) ──────── */
ipcMain.handle('update-user', async (_, { userId, nombre, rol, sedeId, permisos }) => {
  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const serviceKey  = process.env.SUPABASE_SERVICE_KEY
  if (!supabaseUrl || !serviceKey) return { error: 'Credenciales de Supabase no configuradas.' }
  try {
    const { createClient } = require('@supabase/supabase-js')
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    await admin.auth.admin.updateUserById(userId, {
      user_metadata: { nombre, rol, sede_id: sedeId || '' },
    })
    const profileUpdate = {
      nombre,
      rol,
      sede_id: sedeId || null,
      permisos: permisos || { bodega: true, caja: false },
    }
    const { error } = await admin.from('profiles').update(profileUpdate).eq('id', userId)
    if (error) return { error: error.message }
    return { success: true }
  } catch (e) {
    return { error: e.message }
  }
})

/* ── IPC: MACHINE ID ────────────────────────────────────── */
ipcMain.handle('get-machine-id', async () => {
  try {
    const { machineIdSync } = require('node-machine-id')
    return machineIdSync(true)
  } catch {
    return null
  }
})

/* ── IPC: RESETEAR MACHINE ID DE UN USUARIO (solo admin) ── */
ipcMain.handle('reset-machine-id', async (_, userId) => {
  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const serviceKey  = process.env.SUPABASE_SERVICE_KEY
  if (!supabaseUrl || !serviceKey) return { error: 'Sin credenciales de servicio.' }
  try {
    const { createClient } = require('@supabase/supabase-js')
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    await admin.from('profiles').update({ machine_id: null }).eq('id', userId)
    return { success: true }
  } catch (e) {
    return { error: e.message }
  }
})

/* ── IPC: RESTABLECER CONTRASEÑA ───────────────────────── */
ipcMain.handle('reset-password', async (_, { userId, password }) => {
  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const serviceKey  = process.env.SUPABASE_SERVICE_KEY
  if (!supabaseUrl || !serviceKey) return { error: 'Credenciales no configuradas.' }
  try {
    const { createClient } = require('@supabase/supabase-js')
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const { error } = await admin.auth.admin.updateUserById(userId, { password })
    if (error) return { error: error.message }
    return { success: true }
  } catch (e) {
    return { error: e.message }
  }
})

/* ── IPC: HABILITAR USUARIO ─────────────────────────────── */
ipcMain.handle('enable-user', async (_, userId) => {
  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const serviceKey  = process.env.SUPABASE_SERVICE_KEY
  if (!supabaseUrl || !serviceKey) return { error: 'Credenciales no configuradas.' }
  try {
    const { createClient } = require('@supabase/supabase-js')
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    await admin.auth.admin.updateUserById(userId, { ban_duration: 'none' })
    await admin.from('profiles').update({ activo: true }).eq('id', userId)
    return { success: true }
  } catch (e) {
    return { error: e.message }
  }
})

/* ── IPC: DESHABILITAR USUARIO ──────────────────────────── */
ipcMain.handle('disable-user', async (_, userId) => {
  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const serviceKey  = process.env.SUPABASE_SERVICE_KEY
  if (!supabaseUrl || !serviceKey) return { error: 'Credenciales no configuradas.' }
  try {
    const { createClient } = require('@supabase/supabase-js')
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    await admin.auth.admin.updateUserById(userId, { ban_duration: '876600h' })
    await admin.from('profiles').update({ activo: false }).eq('id', userId)
    return { success: true }
  } catch (e) {
    return { error: e.message }
  }
})

/* ── AUTO-UPDATER ───────────────────────────────────────── */
function setupUpdater() {
  if (isDev) return  // No buscar actualizaciones en modo desarrollo

  autoUpdater = require('electron-updater').autoUpdater
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('update-available', (info) => {
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Nueva versión disponible',
      message: `LabStock v${info.version} está disponible`,
      detail: 'Se descargará en segundo plano. Te avisamos cuando esté lista para instalar.',
      buttons: ['Descargar ahora', 'Después'],
      defaultId: 0,
      icon: ICON_PATH,
    }).then(({ response }) => {
      if (response === 0) autoUpdater.downloadUpdate()
    })
  })

  autoUpdater.on('download-progress', ({ percent }) => {
    const p = Math.round(percent)
    if (mainWindow) mainWindow.setProgressBar(p / 100)
    if (tray) tray.setToolTip(`LabStock — Descargando actualización ${p}%`)
  })

  autoUpdater.on('update-downloaded', () => {
    if (mainWindow) mainWindow.setProgressBar(-1)
    if (tray) tray.setToolTip('LabStock — Actualización lista')
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Actualización lista',
      message: '¡Nueva versión descargada!',
      detail: 'La aplicación se reiniciará para instalar la actualización.',
      buttons: ['Reiniciar ahora', 'Más tarde'],
      defaultId: 0,
      icon: ICON_PATH,
    }).then(({ response }) => {
      if (response === 0) {
        app.isQuitting = true
        autoUpdater.quitAndInstall()
      }
    })
  })

  autoUpdater.on('update-not-available', () => {
    if (mainWindow?._manualCheck) {
      mainWindow._manualCheck = false
      dialog.showMessageBox(mainWindow, {
        type: 'info', title: 'LabStock actualizado',
        message: 'Ya tienes la versión más reciente instalada.',
        buttons: ['OK'], icon: ICON_PATH,
      })
    }
  })

  autoUpdater.on('error', (err) => {
    if (mainWindow) mainWindow.setProgressBar(-1)
    const msg = err?.message || 'Error desconocido'
    dialog.showMessageBox(mainWindow, {
      type: 'error', title: 'Error de actualización',
      message: 'No se pudo verificar actualizaciones',
      detail: msg, buttons: ['OK'], icon: ICON_PATH,
    })
  })

  // Revisar 3 segundos después de que la ventana esté lista
  setTimeout(() => autoUpdater.checkForUpdates(), 3000)
}

/* ── SINGLE INSTANCE — solo una ventana a la vez ─────────── */
const gotLock = app.requestSingleInstanceLock()

if (!gotLock) {
  // Ya hay una instancia corriendo — salir inmediatamente
  app.quit()
} else {
  // Si alguien intenta abrir una segunda instancia, traer la existente al frente
  app.on('second-instance', () => {
    if (mainWindow) {
      if (!mainWindow.isVisible()) mainWindow.show()
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  /* ── INICIO ───────────────────────────────────────────── */
  app.whenReady().then(() => {
    createWindow()
    createTray()
    setupUpdater()
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin' && !tray) app.quit()
  })

  app.on('activate', () => {
    if (mainWindow) { mainWindow.show(); mainWindow.focus() }
  })

  app.on('before-quit', () => { app.isQuitting = true })
}
