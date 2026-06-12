// Lanzador de Electron — limpia variables de entorno inyectadas por VS Code / Claude Code
const { spawn } = require('child_process')
const electron = require('electron')

// Variables que VS Code inyecta y que hacen que Electron arranque en modo Node
const VSCODE_VARS = [
  'ELECTRON_RUN_AS_NODE',
  'ELECTRON_NO_ATTACH_CONSOLE',
  'VSCODE_CWD',
  'VSCODE_PID',
  'VSCODE_AMD_ENTRYPOINT',
  'VSCODE_HANDLES_UNCAUGHT_ERRORS',
  'VSCODE_NLS_CONFIG',
  'VSCODE_PORTABLE',
  'VSCODE_SHELL_LOGIN',
  'VSCODE_INJECTION',
  'VSCODE_STABLE',
]

const env = { ...process.env }
VSCODE_VARS.forEach(v => delete env[v])

const child = spawn(electron, ['.'], { stdio: 'inherit', env, windowsHide: false })
child.on('close', code => process.exit(code ?? 0))
