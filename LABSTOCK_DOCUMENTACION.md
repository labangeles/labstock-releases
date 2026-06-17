# LabStock — Documentación Técnica Completa
**Laboratorio Clínico Los Ángeles · Costa Sur, Guatemala**
**Versión actual: 1.6.15** | Última actualización: 15 de junio de 2026

---

## 1. Resumen del Sistema

LabStock es una aplicación de escritorio para gestión de inventario, caja chica, compras a proveedores, gastos fijos y recursos humanos del Laboratorio Clínico Los Ángeles, que opera en **5 sedes** en la Costa Sur de Guatemala.

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
│   └── preload.js       # Bridge renderer ↔ main (contextBridge)
├── src/
│   ├── App.jsx          # Root: routing de vistas, CRUD items, sidebar, modales globales
│   ├── contexts/
│   │   ├── AuthContext.jsx    # Sesión Supabase, perfil, sedes
│   │   ├── ThemeContext.jsx   # Dark / Light mode
│   │   └── OnlineContext.jsx  # Estado de conexión + sync pendiente
│   ├── lib/
│   │   └── supabase.js        # Cliente Supabase inicializado
│   ├── shared/
│   │   └── ui.jsx             # Tokens (T), íconos (Ico), Btn, IconBtn, Modal, Field, etc.
│   └── features/
│       ├── inicio/
│       │   └── InicioScreen.jsx
│       ├── caja/
│       │   ├── CajaScreen.jsx
│       │   ├── HistorialCajaScreen.jsx
│       │   ├── AuditorDashboard.jsx
│       │   ├── hooks/useCuadre.js
│       │   ├── lib/exportExcel.js
│       │   └── components/    # CerrarCuadreModal, DepositoModal, GastoModal, etc.
│       ├── compras/
│       │   └── ComprasScreen.jsx
│       ├── admin/
│       │   ├── GastosFijosScreen.jsx
│       │   └── AnalisisFinancieroScreen.jsx
│       └── rrhh/                          ← MÓDULO NUEVO (ver sección 14)
│           ├── RRHHScreen.jsx             # Pantalla raíz con tabs
│           ├── components/
│           │   ├── EmpleadosTab.jsx
│           │   ├── NominaTab.jsx
│           │   ├── AsistenciaTab.jsx
│           │   └── PrestacionesTab.jsx
│           └── lib/
│               ├── calcNomina.js          # Cálculo IGSS, ISR, bonificaciones
│               └── exportNomina.js        # Export .xlsx de nómina
├── supabase/
│   └── migrations/
└── dist-electron/          # Output del build
```

---

## 3. Roles y permisos

| Rol | Acceso |
|-----|--------|
| **admin** | Todo — bodega, caja, compras, pedidos, usuarios, gastos fijos, análisis financiero, RRHH |
| **tecnico** | Bodega (su sede), caja (si tiene permiso), pedidos |
| **auditor** | Caja historial + compras + gastos fijos — solo lectura |
| **secretaria** | Inventario (solo lectura), compras (crear/ver), caja si tiene permiso |

### Permisos especiales (campo `permisos` en profiles)
```js
permisos.caja   = true   // tecnico/secretaria puede ver caja
permisos.bodega = false  // tecnico no ve bodega
```

### Vistas por rol (App.jsx)
```js
// Auditor
['inicio','auditoria','caja_historial','compras','gastos_fijos']

// Secretaria
['inicio','compras','inventario'] + ['caja_dia','caja_historial'] si cajaPerm
```

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

### Sedes (nombres exactos en BD)
```
Santa Lucía   ← sede central, receptora de pedidos
La Democracia
La Gomera     ← permite_compras = true
Sipacate
Siquinalá
```

### RLS — Patrón estándar
```sql
-- Leer: cualquier miembro de la organización
USING (organizacion_id = auth_org_id())

-- Escribir: solo admin (subquery inline — NO usar auth_role())
WITH CHECK (
  (SELECT rol FROM profiles WHERE profiles.id = auth.uid()) = 'admin'
)
```

> ⚠️ Siempre usar subquery inline para verificar rol. La función `auth_role()` puede ser inestable en RLS.
> ⚠️ `CREATE POLICY IF NOT EXISTS` no existe en PostgreSQL. Usar `DROP POLICY IF EXISTS` + `CREATE POLICY`.

---

## 5. Módulos funcionales

### 5.1 Inicio (`InicioScreen`)
- Saludo por hora, nombre sin título académico, frase del día
- Alertas urgentes por rol: insumos críticos, cuadres sin cerrar, gastos pendientes, pedidos activos

### 5.2 Bodega / Inventario
- CRUD insumos (código, nombre, categoría, unidad, stock actual/mínimo/máximo)
- Estados: OK / Precaución (≤100% mínimo) / Crítico (≤50%) / Agotado
- Flag `en_uso` — insumos actualmente en uso
- Importar CSV (auto-detecta separador `,` o `;`, auto-detecta encoding UTF-8/Windows-1252)
- Exportar CSV (BOM + sep=, + CRLF para Excel)
- Código auto-generado por categoría: `REA-0001`, `CON-0002`, etc.
- Upsert por `(codigo, sede_id)` — reimportar actualiza sin duplicar
- Realtime via Supabase channel
- Secretaria: solo lectura

### 5.3 Caja (`CajaScreen`)
- Un cuadre por sede por día; apertura automática
- Ingresos, gastos con categoría/comprobante, depósitos bancarios
- Cálculo: caja final, depósito esperado, diferencia (sobrante/faltante)
- Cierre con firma del admin; badge en tray cuando hay cuadres sin cerrar

### 5.4 Historial de Caja (`HistorialCajaScreen`)
- Filtros sede/fechas/estado; admin puede reabrir cuadres
- Muestra nota de comentario cuando hay sobrante, faltante, o no se registró depósito
- Exportación Excel (.xlsx) con 3 hojas: Resumen, Gastos, Depósitos

### 5.5 Auditor Dashboard (`AuditorDashboard`)
- Resumen contable con gráficas (barras por sede, tendencia diaria)
- Filtros: semana / mes / mes anterior / últimos 30 días / historial

### 5.6 Compras (`ComprasScreen`)
- Registro por proveedor del catálogo: factura, tipo doc, monto, cadena frío
- Crédito: días + fecha de vencimiento automática, badge por estado
- Exportación CSV

### 5.7 Pedidos (`PedidosScreen`)
- Carrito de items entre sedes → Pendiente → En proceso → Enviado → Recibido
- Referencia auto `PED-0001…`; badge en sidebar para Santa Lucía
- Admin puede eliminar pedidos del historial

### 5.8 Gastos Fijos (`GastosFijosScreen`)
- Configuración (admin): plantillas con nombre, sede, monto, banco, día de vencimiento
- Checklist mensual: auto-generado, marcar pagado con comprobante
- Auditor: solo lectura + exportar CSV

### 5.9 Análisis Financiero (`AnalisisFinancieroScreen`)
- Solo admin; ingresos vs egresos por sede, utilidad neta por mes

### 5.10 Usuarios (`UsuariosScreen`)
- Solo admin; crea/edita usuarios via Supabase Admin API (service role en main process)
- Deshabilitar / habilitar usuarios; resetear contraseña; contraseña mínimo 3 caracteres

---

## 6. Electron — IPC Handlers

| Handler | Descripción |
|---------|-------------|
| `show-notification` | Notificación nativa del OS |
| `get-app-version` | Versión desde package.json |
| `update-alert-badge` | Actualiza tooltip del tray |
| `save-file` | Diálogo guardar CSV |
| `save-xlsx` | Diálogo guardar Excel (recibe base64) |
| `open-file` | Diálogo abrir CSV |
| `create-user` | Supabase Admin API — crear usuario |
| `update-user` | Actualizar datos de usuario |
| `reset-password` | Resetear contraseña por userId |
| `disable-user` | Ban 876600h + activo=false |
| `enable-user` | Quitar ban + activo=true |
| `get-machine-id` | node-machine-id — ID único del dispositivo |
| `reset-machine-id` | Reasignar binding de máquina |

### Variables de entorno (.env)
```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_KEY=eyJ...    ← SOLO proceso principal
```

---

## 7. Sistema de diseño (shared/ui.jsx)

### Tokens de color
```js
T.teal / T.tealDk / T.tealXL   // Verde teal — color primario
T.ok / T.okBg                   // Verde — OK
T.warn / T.warnBg               // Naranja — precaución
T.crit / T.critBg               // Rojo — crítico
T.out / T.outBg                 // Gris — agotado
T.hi / T.mid / T.lo             // Escala de texto (alta / media / baja)
T.surface / T.canvas / T.border // Fondos y bordes
```

Todos los tokens son `var(--css-variable)` — compatibles con dark/light mode automáticamente.

### Componentes
`Btn`, `IconBtn`, `Modal`, `Field`, `TInput`, `TSelect`, `StatCard`, `fmtQ` (formatea quetzales)

### Íconos SVG inline (sin dependencia externa)
`Home, Layers, Box, Bell, Cart, Activity, DollarSign, History, Receipt, Users, Wallet, TrendingUp, BarChart, Map, Calendar, Check, XCircle, Edit, Trash, Plus, Download, Upload, Search, ChevronDown, Sliders, AlertTriangle, Package, Clock, X, ArrowRight, Code`

---

## 8. Migraciones SQL ejecutadas

| Archivo | Descripción | Estado |
|---------|-------------|--------|
| `20260611_modulo_caja.sql` | Tablas caja, RLS, multi-tenant | ✅ |
| `20260611_caja_realtime.sql` | Realtime en tablas de caja | ✅ |
| `20260611_profiles_auditor.sql` | Rol auditor, RLS profiles | ✅ |
| `20260611_fix_trigger_create_user.sql` | Fix trigger creación de perfil | ✅ |
| `20260611_modulo_compras.sql` | Tablas compras, proveedores, RLS | ✅ |
| `20260612_gastos_fijos.sql` | Tabla gastos_fijos | ✅ |
| `20260612_gastos_fijos_v2.sql` | Columnas adicionales, gastos_fijos_pagos | ✅ |
| `20260613_caja_rls_secretaria_tecnico.sql` | RLS caja para secretaria/tecnico | ✅ |
| `20260613_machine_binding.sql` | Columna machine_id en profiles | ✅ |
| `20260614_en_uso.sql` | Columna en_uso en items | ✅ |
| `20260614_codigo_por_sede.sql` | UNIQUE(codigo, sede_id) — reemplaza unique global | ✅ |

---

## 9. Exportaciones de datos

| Módulo | Formato | Notas |
|--------|---------|-------|
| Inventario | CSV | BOM + sep=, + CRLF |
| Caja / Historial | XLSX | 3 hojas: Resumen, Gastos, Depósitos |
| Compras | CSV | BOM + sep=, + CRLF |
| Gastos Fijos | CSV | BOM + sep=, + CRLF |

---

## 10. Auto-actualizaciones

### Flujo de release
```bash
# 1. Cambios + commit
git add src/... electron/... && git commit -m "feat: ..."

# 2. Actualizar versión en package.json

# 3. Build
npm run build         # genera dist-electron/LabStock-Setup-X.X.X.exe

# 4. npm run release  — electron-builder publica en GitHub Releases (draft)
#    o subir manualmente: .exe + .exe.blockmap + latest.yml
```

> ⚠️ El nombre del .exe DEBE tener guiones (`LabStock-Setup-1.6.15.exe`), no puntos.
> ⚠️ El patch en `node_modules/app-builder-lib/.../electronGet.js` (cp fallback para rename) se pierde al hacer `npm install`. Reaplicar si es necesario.

---

## 11. Historial de versiones

| Versión | Cambios |
|---------|---------|
| **v1.0.0** | Sistema inicial: bodega, caja, compras, pedidos, usuarios multi-sede |
| **v1.5.0** | Módulo Gastos Fijos + Análisis Financiero + Pantalla Inicio + Auditor + Secretaria solo lectura |
| **v1.5.1** | Fix: instancia única (`requestSingleInstanceLock`) |
| **v1.5.2** | Fix: `autoUpdater` no definido al abrir menú Ayuda |
| **v1.5.3** | Fix: CSV con CRLF para compatibilidad Excel en Windows |
| **v1.6.7** | Fix: importar CSV con separador `;` (Excel en español) + mapeo columnas por nombre |
| **v1.6.8** | Fix: importación multi-sede — UNIQUE(codigo, sede_id) en vez de único global |
| **v1.6.9** | Fix: encoding Windows-1252 en CSV de Excel español (TextDecoder con fallback) |
| **v1.6.10** | Fix: UI freeze post-importación — reemplazó `alert()` nativo con error en modal |
| **v1.6.11** | Fix: ítems seleccionados en CartModal ilegibles en modo oscuro (`T.tealXL` en vez de `#F0FAFA`) |
| **v1.6.12** | Fix: íconos de acción muy oscuros en tabla inventario (`T.mid` en `IconBtn`) |
| **v1.6.13** | Feature: resetear contraseña de usuarios + habilitar/deshabilitar + mínimo 3 caracteres |
| **v1.6.14** | Feature: admin puede eliminar pedidos del historial + SQL para limpiar tabla pedidos |
| **v1.6.15** | Feature: muestra nota/comentario en historial de caja cuando hay sobrante, faltante o sin depósito |

---

## 12. Notas técnicas clave

1. **Upsert con NULL**: `NULL != NULL` en PostgreSQL — items sin `codigo` siempre hacen INSERT (no upsert). La constraint `UNIQUE(codigo, sede_id)` ignora filas con `codigo IS NULL`.

2. **RLS**: Siempre subquery inline (`SELECT rol FROM profiles WHERE id = auth.uid()`). No usar `auth_role()`.

3. **`CREATE POLICY IF NOT EXISTS`** no existe. Usar `DROP POLICY IF EXISTS` + `CREATE POLICY`.

4. **Creación de usuarios**: Solo desde proceso principal con `SUPABASE_SERVICE_KEY` vía IPC. El trigger de Supabase crea el perfil base; el handler IPC complementa con sede, rol y permisos.

5. **Realtime**: Canales suscritos por sede para evitar datos cruzados.

6. **export .xlsx vía IPC**: Los datos se pasan como base64 para evitar límites de tamaño en IPC de Electron.

7. **Machine binding**: `node-machine-id` vincula cada usuario a un dispositivo. Admin puede resetear el binding por usuario.

---

## 13. Pendientes técnicos

- [ ] Firma de código del .exe (certificate) — elimina advertencia SmartScreen
- [ ] Exclusión permanente de Windows Defender para la carpeta del proyecto (evita EPERM en builds)
- [ ] Agregar `gh` CLI para automatizar releases: `winget install GitHub.cli`

---

## 14. Arquitectura — Módulo Recursos Humanos (RRHH)

### Objetivo
Gestión de personal del laboratorio: expedientes de empleados, asistencia, nómina quincenal/mensual con cálculos según la ley laboral de Guatemala, y control de prestaciones (Bono 14, Aguinaldo, IGSS).

### Acceso por rol
| Rol | Acceso |
|-----|--------|
| admin | Completo — ver, crear, editar, aprobar nómina |
| auditor | Solo lectura — expedientes y reportes de nómina |
| tecnico / secretaria | Sin acceso |

### Pantalla raíz
`src/features/rrhh/RRHHScreen.jsx` con 4 tabs:
1. **Empleados** — expedientes
2. **Asistencia** — registro diario
3. **Nómina** — generación y pago
4. **Prestaciones** — Bono 14, Aguinaldo, IGSS

---

### 14.1 Tablas SQL

#### `cargos`
```sql
CREATE TABLE cargos (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacion_id  uuid NOT NULL REFERENCES organizaciones(id),
  nombre           text NOT NULL,          -- "Técnico de Laboratorio", "Recepcionista"
  departamento     text,
  activo           boolean NOT NULL DEFAULT true,
  created_at       timestamptz DEFAULT now()
);
```

#### `empleados`
```sql
CREATE TABLE empleados (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacion_id  uuid NOT NULL REFERENCES organizaciones(id),
  sede_id          uuid NOT NULL REFERENCES sedes(id),
  cargo_id         uuid REFERENCES cargos(id),

  -- Datos personales
  nombre           text NOT NULL,
  apellido         text NOT NULL,
  dpi              text,                   -- Documento Personal de Identificación (Guatemala)
  nit              text,
  fecha_nacimiento date,
  telefono         text,
  correo           text,

  -- Datos laborales
  fecha_ingreso    date NOT NULL DEFAULT current_date,
  tipo_contrato    text NOT NULL DEFAULT 'tiempo_completo',
                   -- tiempo_completo | medio_tiempo | temporal
  salario_base     numeric(10,2) NOT NULL, -- En quetzales (GTQ)
  activo           boolean NOT NULL DEFAULT true,
  fecha_baja       date,
  motivo_baja      text,

  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

CREATE INDEX idx_empleados_org ON empleados(organizacion_id, activo);
CREATE INDEX idx_empleados_sede ON empleados(sede_id, activo);
```

#### `asistencia`
```sql
CREATE TABLE asistencia (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empleado_id    uuid NOT NULL REFERENCES empleados(id),
  fecha          date NOT NULL,
  hora_entrada   time,
  hora_salida    time,
  tipo           text NOT NULL DEFAULT 'normal',
                 -- normal | permiso_con_goce | permiso_sin_goce | vacaciones | ausente | feriado
  horas_extra    numeric(4,2) DEFAULT 0,
  nota           text,
  registrado_por uuid REFERENCES profiles(id),
  created_at     timestamptz DEFAULT now(),

  UNIQUE (empleado_id, fecha)
);
```

#### `nomina` (cabecera del período)
```sql
CREATE TABLE nomina (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacion_id  uuid NOT NULL REFERENCES organizaciones(id),
  sede_id          uuid REFERENCES sedes(id),    -- NULL = todas las sedes

  -- Período
  tipo_periodo     text NOT NULL DEFAULT 'mensual',  -- mensual | quincenal
  fecha_inicio     date NOT NULL,
  fecha_fin        date NOT NULL,
  periodo_label    text NOT NULL,                -- "Junio 2026" | "2026-06 Q1"

  -- Estado
  estado           text NOT NULL DEFAULT 'borrador',
                   -- borrador | aprobada | pagada
  aprobado_por     uuid REFERENCES profiles(id),
  fecha_aprobacion timestamptz,
  fecha_pago       date,

  notas            text,
  created_by       uuid REFERENCES profiles(id),
  created_at       timestamptz DEFAULT now()
);
```

#### `nomina_items` (línea por empleado)
```sql
CREATE TABLE nomina_items (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nomina_id        uuid NOT NULL REFERENCES nomina(id) ON DELETE CASCADE,
  empleado_id      uuid NOT NULL REFERENCES empleados(id),

  -- Devengados
  salario_base          numeric(10,2) NOT NULL,
  dias_trabajados       numeric(4,1)  NOT NULL DEFAULT 30,
  salario_proporcional  numeric(10,2) NOT NULL,  -- base * (dias/30)
  horas_extra           numeric(4,2)  DEFAULT 0,
  valor_horas_extra     numeric(10,2) DEFAULT 0,
  bonificacion_incentivo numeric(10,2) DEFAULT 250, -- Q250 fijo por ley (Decreto 78-89)
  otros_ingresos        numeric(10,2) DEFAULT 0,
  total_devengado       numeric(10,2) NOT NULL,

  -- Deducciones
  deduccion_igss        numeric(10,2) NOT NULL,  -- 4.83% del salario base
  deduccion_isr         numeric(10,2) DEFAULT 0, -- ISR si aplica
  otras_deducciones     numeric(10,2) DEFAULT 0,
  total_descuentos      numeric(10,2) NOT NULL,

  -- Neto
  total_neto            numeric(10,2) NOT NULL,

  -- Pago
  estado                text NOT NULL DEFAULT 'pendiente',  -- pendiente | pagado
  metodo_pago           text,  -- efectivo | transferencia | cheque
  numero_cuenta         text,
  fecha_pago_efectivo   date,

  UNIQUE (nomina_id, empleado_id)
);
```

#### `prestaciones` (Bono 14, Aguinaldo, IGSS patronal)
```sql
CREATE TABLE prestaciones (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empleado_id      uuid NOT NULL REFERENCES empleados(id),
  organizacion_id  uuid NOT NULL REFERENCES organizaciones(id),
  anio             integer NOT NULL,
  tipo             text NOT NULL,
                   -- bono14 | aguinaldo | igss_patronal | indemnizacion | vacaciones_pagadas

  -- Cálculo
  base_calculo     numeric(10,2),  -- salario promedio del período
  monto_calculado  numeric(10,2),
  monto_pagado     numeric(10,2),

  -- Estado
  estado           text NOT NULL DEFAULT 'pendiente',
  fecha_pago       date,
  comprobante      text,
  notas            text,

  created_at       timestamptz DEFAULT now(),

  UNIQUE (empleado_id, anio, tipo)
);
```

#### `vacaciones_permisos`
```sql
CREATE TABLE vacaciones_permisos (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empleado_id      uuid NOT NULL REFERENCES empleados(id),
  tipo             text NOT NULL,
                   -- vacaciones | permiso_con_goce | permiso_sin_goce | licencia_medica
  fecha_inicio     date NOT NULL,
  fecha_fin        date NOT NULL,
  dias_habiles     integer NOT NULL,
  motivo           text,

  -- Aprobación
  estado           text NOT NULL DEFAULT 'solicitado',  -- solicitado | aprobado | rechazado
  aprobado_por     uuid REFERENCES profiles(id),
  fecha_aprobacion timestamptz,
  nota_aprobacion  text,

  created_at       timestamptz DEFAULT now()
);
```

---

### 14.2 Lógica de negocio Guatemala

```js
// src/features/rrhh/lib/calcNomina.js

const IGSS_EMPLEADO    = 0.0483;  // 4.83% — Decreto 295 IGSS
const IGSS_PATRONAL    = 0.1267;  // 12.67%
const BONIF_INCENTIVO  = 250;     // Q250/mes fijo — Decreto 78-89

export function calcularLineaNomina({ salarioBase, diasTrabajados = 30, horasExtra = 0 }) {
  const diasMes          = 30;
  const salarioProp      = (salarioBase / diasMes) * diasTrabajados;
  const valorHoraExtra   = (salarioBase / diasMes / 8) * 1.5 * horasExtra;
  const totalDevengado   = salarioProp + valorHoraExtra + BONIF_INCENTIVO;
  const deduccionIGSS    = salarioBase * IGSS_EMPLEADO;  // IGSS se calcula sobre salario base
  const totalDescuentos  = deduccionIGSS;
  const totalNeto        = totalDevengado - totalDescuentos;

  return {
    salarioProp: round2(salarioProp),
    valorHorasExtra: round2(valorHoraExtra),
    bonificacionIncentivo: BONIF_INCENTIVO,
    totalDevengado: round2(totalDevengado),
    deduccionIGSS: round2(deduccionIGSS),
    igssPatronal: round2(salarioBase * IGSS_PATRONAL),   // costo del empleador (no se descuenta)
    totalDescuentos: round2(totalDescuentos),
    totalNeto: round2(totalNeto),
  };
}

// Bono 14: 1 mes de salario pagado en julio (proporcional si < 1 año)
export function calcularBono14(salarioBase, mesesTrabajados) {
  return round2((salarioBase / 12) * Math.min(mesesTrabajados, 12));
}

// Aguinaldo: 1 mes de salario pagado en diciembre (proporcional)
export function calcularAguinaldo(salarioBase, mesesTrabajados) {
  return round2((salarioBase / 12) * Math.min(mesesTrabajados, 12));
}

// Vacaciones: 15 días hábiles por año (después de 150 días trabajados) — Código de Trabajo Guatemala
export function calcularVacaciones(salarioBase, diasTrabajados) {
  if (diasTrabajados < 150) return 0;
  const diasVac = Math.floor((diasTrabajados / 365) * 15);
  return round2((salarioBase / 30) * diasVac);
}

const round2 = n => Math.round(n * 100) / 100;
```

---

### 14.3 RLS

```sql
-- empleados: admin y auditor de la organización pueden leer
CREATE POLICY "rrhh_empleados_select" ON empleados
  FOR SELECT USING (
    organizacion_id = auth_org_id()
    AND (SELECT rol FROM profiles WHERE id = auth.uid()) IN ('admin', 'auditor')
  );

CREATE POLICY "rrhh_empleados_write" ON empleados
  FOR ALL WITH CHECK (
    organizacion_id = auth_org_id()
    AND (SELECT rol FROM profiles WHERE id = auth.uid()) = 'admin'
  );

-- Misma lógica para nomina, nomina_items, prestaciones, asistencia, vacaciones_permisos
```

---

### 14.4 Pantallas (componentes)

#### `EmpleadosTab`
- Tabla con búsqueda/filtro por sede y estado
- Modal alta: datos personales + datos laborales + cargo
- Modal editar: todos los campos + dar de baja con motivo
- Badge de antigüedad (calculada desde `fecha_ingreso`)

#### `AsistenciaTab`
- Vista semana/mes por empleado o por sede
- Registro rápido: fila por empleado, entrada/salida o tipo especial
- Resumen mensual: días normales, permisos, ausencias, horas extra

#### `NominaTab`
- Botón "Generar nómina" → selecciona período y sede
- Auto-llena líneas con empleados activos y calcula automáticamente
- Tabla editable: ajustar días trabajados, horas extra, otros ingresos/descuentos
- Estados: Borrador → Aprobar (admin) → Marcar como pagada
- Exportar a Excel (.xlsx): columnas nombre, cargo, devengado, IGSS, ISR, neto, método pago
- Costo total del período: suma netos + IGSS patronal de todos los empleados

#### `PrestacionesTab`
- Tabs internos: Bono 14 / Aguinaldo / IGSS / Vacaciones
- Lista de empleados con monto calculado y estado de pago
- Botón "Generar prestaciones del año" — calcula para todos los empleados activos
- Marcar como pagado con fecha y comprobante

---

### 14.5 Integración con módulos existentes

- **Análisis Financiero**: incluir costo de nómina como egreso mensual
- **Sidebar**: nueva entrada "Recursos Humanos" con ícono `Users` — visible solo para admin y auditor
- **InicioScreen**: alerta admin cuando haya nómina en estado `borrador` ya vencida o prestaciones pendientes de pago en el mes actual

---

### 14.6 Migración SQL

Archivo: `supabase/migrations/20260615_modulo_rrhh.sql`

```sql
BEGIN;

-- Habilitar RLS en todas las tablas RRHH
ALTER TABLE cargos               ENABLE ROW LEVEL SECURITY;
ALTER TABLE empleados            ENABLE ROW LEVEL SECURITY;
ALTER TABLE asistencia           ENABLE ROW LEVEL SECURITY;
ALTER TABLE nomina               ENABLE ROW LEVEL SECURITY;
ALTER TABLE nomina_items         ENABLE ROW LEVEL SECURITY;
ALTER TABLE prestaciones         ENABLE ROW LEVEL SECURITY;
ALTER TABLE vacaciones_permisos  ENABLE ROW LEVEL SECURITY;

-- Habilitar realtime en empleados y nomina (para actualizaciones en tiempo real)
ALTER PUBLICATION supabase_realtime ADD TABLE empleados;
ALTER PUBLICATION supabase_realtime ADD TABLE nomina;

COMMIT;
```

> Ejecutar **después** de crear las tablas en el SQL Editor de Supabase.

---

*Documento actualizado el 15 de junio de 2026. Desarrollado por **Teloxis**.*
