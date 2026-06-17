# LabStock — Documentación Técnica Completa
**Laboratorio Clínico Los Ángeles · Costa Sur, Guatemala**
**Versión actual: 1.7.2** | Última actualización: 17 de junio de 2026

---

## 1. Resumen del Sistema

LabStock es una aplicación de escritorio para gestión de inventario, caja chica, compras a proveedores, gastos fijos, ventas y recursos humanos del Laboratorio Clínico Los Ángeles, que opera en **5 sedes** en la Costa Sur de Guatemala.

### Stack tecnológico
| Capa | Tecnología |
|------|-----------|
| Escritorio | Electron 42 + React 18 |
| Frontend | React (JSX sin TypeScript), diseño propio sin librería UI |
| Backend / BD | Supabase (PostgreSQL + Auth + RLS + Realtime) |
| Build | Vite 5 + electron-builder 26 |
| Actualizaciones | electron-updater → GitHub Releases |
| Gráficas | Recharts |
| Excel | SheetJS (xlsx) |
| Código fuente | github.com/labangeles/labstock-releases (rama `main`) |

**Desarrollado por:** Teloxis · **Cliente:** Laboratorio Clínico Los Ángeles

---

## 2. Arquitectura de archivos

```
labstock/
├── electron/
│   ├── main.js          # Proceso principal (ventana, tray, IPC, auto-updater)
│   └── preload.js       # Bridge renderer → main (contextBridge)
├── src/
│   ├── App.jsx          # Root: routing de vistas, CRUD items, sidebar acordeón, modales globales
│   ├── index.css        # Estilos globales; user-select:none en body para Electron
│   ├── contexts/
│   │   ├── AuthContext.jsx    # Sesión Supabase, perfil, sedes
│   │   ├── ThemeContext.jsx   # Dark / Light mode
│   │   └── OnlineContext.jsx  # Estado de conexión + sync pendiente
│   ├── lib/
│   │   └── supabase.js        # Cliente Supabase inicializado
│   ├── shared/
│   │   └── ui.jsx             # Tokens (T), íconos (Ico), Btn, IconBtn, Modal, Field, etc.
│   ├── components/
│   │   ├── Emblem.jsx         # Medallas SVG metálicas (4 formas, 12 glifos, 4 paletas)
│   │   └── Reconocimientos.jsx # Catálogo de emblemas con estados earned/locked
│   └── features/
│       ├── inicio/
│       │   ├── InicioScreen.jsx
│       │   └── components/
│       │       ├── MarcajeWidget.jsx    # Widget de asistencia paso a paso
│       │       ├── AlertasRRHH.jsx
│       │       └── PromocionesSection.jsx
│       ├── caja/
│       │   ├── CajaScreen.jsx
│       │   ├── HistorialCajaScreen.jsx
│       │   ├── AuditorDashboard.jsx
│       │   ├── hooks/useCuadre.js
│       │   ├── lib/exportExcel.js
│       │   └── components/
│       ├── compras/
│       │   └── ComprasScreen.jsx
│       ├── ventas/
│       │   ├── IgssGomeraTab.jsx        # Facturación DTE FEL IGSS — sede La Gomera
│       │   └── EmpresasTab.jsx          # Facturación empresas privadas
│       ├── admin/
│       │   ├── GastosFijosScreen.jsx
│       │   └── AnalisisFinancieroScreen.jsx
│       └── rrhh/
│           ├── RRHHScreen.jsx           # Pantalla raíz con tabs (autoservicio + gestión)
│           ├── autoservicio/
│           │   ├── MiPerfilTab.jsx      # Datos personales + foto + bancarios
│           │   ├── MisDocumentosTab.jsx
│           │   ├── MisVacacionesTab.jsx
│           │   └── MiExpedienteTab.jsx
│           ├── gestion/
│           │   ├── EmpleadosTab.jsx
│           │   ├── AsistenciaTab.jsx
│           │   ├── AprobacionesTab.jsx
│           │   └── DisciplinaTab.jsx    # Solo amonestaciones/suspensiones (sin reconocimientos)
│           └── lib/
│               ├── useMiEmpleado.js     # Hook: fila de empleados del usuario actual
│               ├── storage.js           # Upload/download firmado de fotos y documentos
│               ├── edad.js              # calcularEdad, calcularAntiguedad
│               └── guatemala.js         # Departamentos y municipios
├── supabase/
│   └── migrations/
└── dist-electron/          # Output del build
```

---

## 3. Roles y permisos

| Rol | Acceso |
|-----|--------|
| **admin** | Todo: bodega, caja, compras, pedidos, usuarios, gastos fijos, análisis financiero, ventas, RRHH completo |
| **tecnico** | Bodega (su sede), caja (si tiene permiso), pedidos |
| **auditor** | Caja historial + compras + gastos fijos — solo lectura |
| **secretaria** | Inventario (solo lectura), compras (crear/ver), caja/ventas si tiene permiso |

### Permisos especiales (campo `permisos` JSONB en profiles)
```js
permisos.caja            = true   // tecnico/secretaria puede ver caja
permisos.bodega          = false  // tecnico no ve bodega
permisos.ventas_igss     = true   // secretaria puede ver IGSS Gomera
permisos.ventas_empresas = true   // secretaria puede ver Ventas Empresas
```

### Vistas permitidas por rol — guardia de navegación (App.jsx)
```js
// Secretaria — base
['inicio', 'compras', 'inventario']
// + si permisos.caja
['caja_dia', 'caja_historial']
// + si permisos.ventas_igss
['ventas_igss']
// + si permisos.ventas_empresas
['ventas_empresas']
```

> Al cambiar el rol de un usuario en el modal de edición, se resetean automáticamente:
> `sedeId`, `permBodega`, `permCaja`, `permVentasIgss`, `permVentasEmp`

---

## 4. Base de datos — Tablas principales

| Tabla | Descripción |
|-------|-------------|
| `organizaciones` | Organización raíz (una sola instancia) |
| `sedes` | 5 sedes del laboratorio |
| `profiles` | Usuarios extendidos (rol, sede_id, permisos JSONB, activo, machine_id) |
| `items` | Inventario de insumos por sede — UNIQUE(codigo, sede_id) |
| `actividad` | Log de movimientos de inventario |
| `pedidos` | Pedidos internos entre sedes |
| `pedido_items` | Líneas de pedido |
| `cuadres_caja` | Cuadre diario de caja por sede |
| `gastos_caja` | Gastos de cada cuadre |
| `depositos_caja` | Depósitos bancarios de cada cuadre |
| `actividad_caja` | Log de caja |
| `v_cuadres_resumen` | Vista para dashboard auditor |
| `compras` | Compras a proveedores |
| `compra_items` | Líneas de compra con vencimiento |
| `proveedores` | Catálogo de proveedores |
| `gastos_fijos` | Plantillas de gastos fijos mensuales |
| `gastos_fijos_pagos` | Registro de pago mensual — UNIQUE(gasto_fijo_id, mes, anio) |
| `ventas_igss` | Facturas DTE FEL emitidas al IGSS (sede La Gomera) |
| `ventas_empresas` | Facturas emitidas a empresas privadas |
| `empleados` | Expedientes de empleados (sin datos monetarios — privacidad) |
| `cargos` | Catálogo de puestos |
| `empleado_datos_bancarios` | Datos bancarios del empleado (separados por privacidad) |
| `acciones_disciplinarias` | Amonestaciones, suspensiones y reconocimientos |
| `asistencia` | Marcajes diarios de entrada/salida/breaks |
| `vacaciones_permisos` | Solicitudes y aprobaciones de vacaciones |
| `feriados` | Feriados de la organización |
| `v_saldo_vacaciones` | Vista de días disponibles de vacaciones |

### Sedes
```
Santa Lucía   — sede central, receptora de pedidos
La Democracia
La Gomera     — permite_compras = true, módulo IGSS Gomera
Sipacate
Siquinalá
```

### RLS — Patrón estándar
```sql
USING (organizacion_id = auth_org_id())
WITH CHECK (
  (SELECT rol FROM profiles WHERE profiles.id = auth.uid()) = 'admin'
)
```

> ⚠️ Siempre usar subquery inline para verificar rol. No usar `auth_role()`.
> ⚠️ `CREATE POLICY IF NOT EXISTS` no existe. Usar `DROP POLICY IF EXISTS` + `CREATE POLICY`.

---

## 5. Módulos funcionales

### 5.1 Inicio
- Saludo por hora, nombre sin título académico, frase del día rotativa
- **Foto de perfil** desde bucket `rrhh-fotos` con URL firmada
- **Emblema SVG** del mes debajo de la foto (si el empleado tiene reconocimientos ganados); tooltip al hover
- **MarcajeWidget**: pasos progresivos — Entrada → Desayuno → Regreso → Almuerzo → Regreso → Salida
- Alertas por rol: insumos críticos, cuadres sin cerrar, gastos pendientes, pedidos activos

### 5.2 Bodega / Inventario
- CRUD insumos; estados OK / Precaución / Crítico / Agotado; flag `en_uso`
- Importar/exportar CSV; código auto-generado por categoría (`REA-0001`, etc.)
- Upsert por `(codigo, sede_id)`; Realtime; secretaria: solo lectura

### 5.3 Caja
- Un cuadre por sede por día; apertura automática; cierre con firma admin
- Ingresos, gastos, depósitos; cálculo sobrante/faltante; badge en tray

### 5.4 Historial de Caja
- Filtros sede/fechas/estado; admin puede reabrir cuadres
- Exportación Excel (.xlsx): Resumen, Gastos, Depósitos

### 5.5 Auditor Dashboard
- Gráficas: barras por sede, tendencia diaria; filtros de período

### 5.6 Compras
- Registro por proveedor: factura, tipo, monto, cadena frío, crédito; exportar CSV

### 5.7 Pedidos
- Carrito entre sedes; estados; referencia `PED-0001…`; admin puede eliminar

### 5.8 Ventas
- **IGSS Gomera**: facturas DTE FEL; parseo XML automático (NIT, autorización, monto)
- **Empresas**: facturación a clientes privados
- Permisos granulares: `ventas_igss` y `ventas_empresas` en profiles JSONB
- Grupo "Ventas" en sidebar visible solo si el usuario tiene al menos un permiso activo

### 5.9 Gastos Fijos
- Plantillas (admin): nombre, sede, monto, banco, día vencimiento
- Checklist mensual auto-generado; auditor: solo lectura + exportar CSV

### 5.10 Análisis Financiero
- Solo admin; ingresos vs egresos por sede, utilidad neta por mes

### 5.11 Usuarios
- Solo admin; crea/edita vía Supabase Admin API (service role en main process)
- Deshabilitar/habilitar; resetear contraseña (mínimo 3 caracteres)

---

## 6. Módulo RRHH

### 6.1 Acceso
| Rol | Autoservicio | Gestión |
|-----|-------------|---------|
| admin | ✓ | ✓ completo |
| auditor | ✓ | ✓ solo lectura |
| tecnico / secretaria | ✓ | ✗ |

### 6.2 Tabs autoservicio (todos los roles)
| Tab | Descripción |
|-----|-------------|
| Mi perfil | Datos personales, foto, datos bancarios |
| Mis documentos | Documentos en bucket `rrhh-documentos` |
| Vacaciones | Solicitar y ver estado |
| Mi expediente | Datos laborales propios (sin salario) |
| **Mis reconocimientos** | Emblemas SVG del mes ganados/bloqueados |

### 6.3 Tabs de gestión (admin / auditor)
| Tab | Roles | Descripción |
|-----|-------|-------------|
| Empleados | admin, auditor | CRUD expedientes |
| Asistencia | admin, auditor | Registro diario |
| Nómina | admin, auditor | Generación y aprobación |
| Prestaciones | admin, auditor | Bono 14, aguinaldo, IGSS |
| Aprobaciones | admin, auditor | Aprobar vacaciones |
| Disciplina | admin | Amonestaciones y suspensiones |

### 6.4 Sistema de Reconocimientos

#### Catálogo (12 emblemas)
| ID | Título | Paleta | Forma |
|----|--------|--------|-------|
| `empleado` | Empleado del mes | gold | sunburst |
| `puntual` | Puntualidad sobresaliente | teal | medallion |
| `desempeno` | Desempeño excepcional | gold | medallion |
| `equipo` | Espíritu de equipo | teal | medallion |
| `calidad` | Calidad en resultados | steel | hexagon |
| `iniciativa` | Iniciativa y proactividad | teal | medallion |
| `antiguedad` | Años de servicio | gold | medallion |
| `paciente` | Atención al paciente | teal | medallion |
| `metas` | Superación de metas | gold | medallion |
| `actitud` | Actitud positiva | teal | sunburst |
| `compromiso` | Compromiso con la calidad | steel | shield |
| `innovacion` | Innovación y mejora | teal | hexagon |

#### Reset mensual
- Todos los reconocimientos se resetean el 1 de cada mes (query filtra por mes actual)
- **Años de servicio** es permanente: query sin filtro de fecha para este título
- La tabla `acciones_disciplinarias` conserva el historial completo

#### Asignación por admin (RRHH > Mis reconocimientos)
- Panel "Gestión del mes": selector de empleado + grid de 12 emblemas con toggle ON/OFF
- Toggle ON → INSERT en `acciones_disciplinarias` con `tipo='reconocimiento'`
- Toggle OFF → DELETE del registro del mes (o todos, para Años de servicio)
- Empleados no-admin solo ven sus propios emblemas

#### Emblem.jsx
```jsx
<Emblem
  shape="sunburst"    // medallion | sunburst | hexagon | shield
  glyph="star"        // star clock trophy team flask bulb laurel heart target sun shield gear
  palette="gold"      // gold (Honor) | steel (Distinción) | teal (Mérito) | lock (Bloqueado)
  ribbon={true}
  size={92}
/>
```

### 6.5 Foto de perfil
- Bucket privado: `rrhh-fotos` — path: `empleados/{id}/foto.{ext}`
- Políticas storage: SELECT + INSERT + DELETE + UPDATE para el propio empleado o admin/auditor
- Al actualizar: se eliminan versiones previas (jpg/jpeg/png/webp) y se sube la nueva
- RPC `rpc_actualizar_mi_perfil` actualiza `foto_path` en tabla `empleados`

---

## 7. Sidebar acordeón

| Grupo | Items visibles |
|-------|----------------|
| Bodega | Inventario, Alertas, Pedidos |
| Caja / Auditoría | Caja del día, Historial |
| Compras | Compras |
| Finanzas | Gastos Fijos, Análisis Financiero |
| Ventas | IGSS Gomera, Empresas |
| Recursos Humanos | Recursos Humanos, Usuarios |

- Solo el grupo de la vista activa queda abierto al cargar
- `activeGroupKey` calculado desde `view` actual; `useEffect` abre el grupo al navegar
- Badge en cabecera del grupo cuando está colapsado
- Grupos sin items visibles para el rol no se renderizan

---

## 8. Electron — IPC Handlers

| Handler | Descripción |
|---------|-------------|
| `show-notification` | Notificación nativa del OS |
| `get-app-version` | Versión desde package.json |
| `update-alert-badge` | Actualiza tooltip del tray |
| `save-file` | Diálogo guardar CSV |
| `save-xlsx` | Diálogo guardar Excel (recibe base64) |
| `open-file` | Diálogo abrir CSV |
| `create-user` | Supabase Admin API — crear usuario |
| `update-user` | Actualizar datos de usuario (rol, sede, permisos, nombre) |
| `reset-password` | Resetear contraseña por userId |
| `disable-user` | Ban 876600h + activo=false |
| `enable-user` | Quitar ban + activo=true |
| `get-machine-id` | node-machine-id — ID único del dispositivo |
| `reset-machine-id` | Reasignar binding de máquina |

### Variables de entorno (.env)
```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_KEY=eyJ...    — SOLO proceso principal
```

---

## 9. Sistema de diseño (shared/ui.jsx)

### Tokens de color
```js
T.teal / T.tealDk / T.tealXL / T.tealL  // Verde teal — color primario
T.ok / T.okBg                             // Verde — OK
T.warn / T.warnBg                         // Naranja — precaución
T.crit / T.critBg                         // Rojo — crítico
T.hi / T.mid / T.lo                       // Escala de texto
T.surface / T.canvas / T.border           // Fondos y bordes
```

### Componentes disponibles
`Btn`, `IconBtn`, `Modal`, `Field`, `TInput`, `TSelect`, `StatCard`, `fmtQ`

### Íconos SVG inline
`Home, Layers, Box, Bell, Cart, Activity, DollarSign, History, Receipt, Users, Wallet, TrendingUp, BarChart, Map, Calendar, Check, XCircle, Edit, Trash, Plus, Download, Upload, Search, ChevronDown, Sliders, AlertTriangle, Package, Clock, X, ArrowRight, Code`

---

## 10. Migraciones SQL

| Archivo | Descripción | Estado |
|---------|-------------|--------|
| `20260611_modulo_caja.sql` | Tablas caja, RLS, multi-tenant | ✓ |
| `20260611_caja_realtime.sql` | Realtime en tablas de caja | ✓ |
| `20260611_profiles_auditor.sql` | Rol auditor, RLS profiles | ✓ |
| `20260611_fix_trigger_create_user.sql` | Fix trigger creación de perfil | ✓ |
| `20260611_modulo_compras.sql` | Tablas compras, proveedores, RLS | ✓ |
| `20260612_gastos_fijos.sql` | Tabla gastos_fijos | ✓ |
| `20260612_gastos_fijos_v2.sql` | Columnas adicionales, gastos_fijos_pagos | ✓ |
| `20260613_caja_rls_secretaria_tecnico.sql` | RLS caja para secretaria/tecnico | ✓ |
| `20260613_machine_binding.sql` | Columna machine_id en profiles | ✓ |
| `20260614_en_uso.sql` | Columna en_uso en items | ✓ |
| `20260614_codigo_por_sede.sql` | UNIQUE(codigo, sede_id) | ✓ |
| `20260615_rrhh_autoservicio.sql` | Tablas RRHH, RPCs autoservicio, storage policies | ✓ |
| `20260616_asistencia.sql` | Tabla asistencia con marcajes | ✓ |
| `20260616_asistencia_desayuno.sql` | Pasos desayuno/regreso al widget de marcaje | ✓ |
| `20260616_ventas.sql` | Tablas ventas_igss, ventas_empresas, permisos | ✓ |
| `20260617_storage_update_policy.sql` | Política UPDATE para buckets rrhh-fotos/documentos | ✓ |

---

## 11. Flujo de release (auto-actualizaciones)

```bash
# 1. Cambios + commit
git add src/... && git commit -m "feat: ..."

# 2. Actualizar versión en package.json

# 3. Build y publish
$env:GH_TOKEN = "ghp_..."   # SOLO sesión PowerShell, NUNCA en archivo
npm run release              # vite build + electron-builder --win --publish=always
                             # Sube .exe + .exe.blockmap + latest.yml → GitHub Releases (draft)

# 4. Publicar el draft via API GitHub (el auto-updater ignora drafts)
# electron-builder crea 2 drafts duplicados — eliminar el que solo tiene .blockmap
# y publicar el que tiene .exe + latest.yml
```

> ⚠️ El `GH_TOKEN` NUNCA se escribe en ningún archivo. Solo como variable de sesión PowerShell.

---

## 12. Historial de versiones

| Versión | Cambios |
|---------|---------|
| **v1.0.0** | Sistema inicial: bodega, caja, compras, pedidos, usuarios multi-sede |
| **v1.5.0** | Gastos Fijos + Análisis Financiero + Inicio + Auditor + Secretaria solo lectura |
| **v1.5.1** | Fix: instancia única |
| **v1.5.2** | Fix: autoUpdater no definido al abrir menú Ayuda |
| **v1.5.3** | Fix: CSV con CRLF para compatibilidad Excel en Windows |
| **v1.6.7** | Fix: importar CSV con separador `;` + mapeo columnas por nombre |
| **v1.6.8** | Fix: importación multi-sede — UNIQUE(codigo, sede_id) |
| **v1.6.9** | Fix: encoding Windows-1252 en CSV de Excel español |
| **v1.6.10** | Fix: UI freeze post-importación |
| **v1.6.11** | Fix: ítems seleccionados ilegibles en modo oscuro |
| **v1.6.12** | Fix: íconos de acción oscuros en inventario |
| **v1.6.13** | Feature: resetear contraseña + habilitar/deshabilitar usuarios |
| **v1.6.14** | Feature: admin puede eliminar pedidos del historial |
| **v1.6.15** | Feature: nota en historial de caja (sobrante, faltante, sin depósito) |
| **v1.7.0** | Feature: módulo Ventas (IGSS Gomera + Empresas) con permisos granulares; Administración → Finanzas; Usuarios movido a RRHH |
| **v1.7.1** | Feature: sidebar acordeón; MarcajeWidget rediseñado; emblemas SVG reconocimientos; RRHH > Mis reconocimientos con asignación admin; DisciplinaTab sin reconocimientos; fix secretaria → ventas IGSS; fix user-select en Electron |
| **v1.7.2** | Fix: foto de perfil fallaba al reubicar (política UPDATE faltante en storage); storage.js borra versión previa antes de insertar |

---

## 13. Notas técnicas clave

1. **Upsert con NULL**: `NULL != NULL` en PostgreSQL — `UNIQUE(codigo, sede_id)` ignora filas con `codigo IS NULL`.
2. **RLS**: Siempre subquery inline. No usar `auth_role()`.
3. **`CREATE POLICY IF NOT EXISTS`** no existe. Usar `DROP POLICY IF EXISTS` + `CREATE POLICY`.
4. **Creación de usuarios**: Solo desde proceso principal con `SUPABASE_SERVICE_KEY` vía IPC.
5. **Realtime**: Canales suscritos por sede.
6. **Export .xlsx**: Datos en base64 vía IPC para evitar límites de tamaño.
7. **Machine binding**: `node-machine-id` vincula usuario a dispositivo. Admin puede resetear.
8. **Storage firmado**: URLs firmadas con TTL 1 hora. Buckets privados.
9. **Reconocimientos mensuales**: Reset lógico por filtro de fecha en query, no se borran datos. "Años de servicio" no tiene filtro de fecha.
10. **Sidebar acordeón**: `activeGroupKey` calculado desde `view`; `useEffect([activeGroupKey])` abre el grupo al navegar.

---

## 14. Pendientes técnicos

- [ ] Firma de código del .exe — elimina advertencia SmartScreen
- [ ] Exclusión permanente de Windows Defender para la carpeta del proyecto
- [ ] Instalar `gh` CLI: `winget install GitHub.cli`
- [ ] Nómina completa (estructura SQL lista, falta UI)
- [ ] Prestaciones (Bono 14, Aguinaldo — estructura SQL lista, falta UI)
- [ ] Export de reconocimientos (PDF/imagen con emblemas del empleado)
- [ ] Asignación de reconocimientos desde EmpleadosTab (acceso directo admin)

---

*Documento actualizado el 17 de junio de 2026. Desarrollado por **Teloxis**.*
