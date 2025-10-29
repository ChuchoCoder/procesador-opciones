# 🚀 Deploy a Render.com - Guía Paso a Paso

## 📋 Pre-requisitos

- [x] Cuenta de GitHub
- [x] Código del proxy en este directorio
- [x] Token de autenticación de Cocos/Primary API

## 🎯 Paso 1: Crear Repositorio en GitHub

### Opción A: Nuevo Repositorio

```powershell
# Desde este directorio (ws-proxy/)
git init
git add .
git commit -m "Initial commit: WebSocket proxy para Cocos API"

# Crear repo en GitHub (via web) y luego:
git remote add origin https://github.com/TU_USUARIO/ws-proxy-cocos.git
git branch -M main
git push -u origin main
```

### Opción B: Subdirectorio en Repo Existente

```powershell
# Desde la raíz del proyecto
git add ws-proxy/
git commit -m "Add WebSocket proxy for Cocos API"
git push
```

## 🌐 Paso 2: Deploy en Render.com

### 2.1 Crear Cuenta

1. Ir a [render.com](https://render.com)
2. Click en **"Get Started for Free"**
3. Sign up con GitHub (recomendado para auto-deploy)

### 2.2 Crear Web Service

1. En el dashboard, click **"New +"** → **"Web Service"**
2. Conectar tu repositorio:
   - Si es nuevo repo: Seleccionar `ws-proxy-cocos`
   - Si es subdirectorio: Seleccionar tu repo principal

### 2.3 Configurar Service

#### Opción A: Usando render.yaml (RECOMENDADO) ✅

Si pusheaste `render.yaml` a tu repo, Render lo detectará automáticamente:

1. Selecciona tu repo
2. Render mostrará: **"Blueprint Detected"**
3. Click **"Apply"**
4. Saltar a paso 2.5 (Deploy)

**Ventaja**: Toda la configuración está en código, reproducible.

#### Opción B: Configuración Manual

Si prefieres configurar manualmente:

**Basic Settings**:

```text
Name: ws-proxy-cocos
Region: Oregon (US West) - más cercano a Argentina
Branch: main
```

**Build & Deploy**:

```text
Root Directory: ws-proxy
  ⚠️ IMPORTANTE: 
  - Si es subdirectorio del repo: ws-proxy
  - Si es repo dedicado: dejar VACÍO

Runtime: Node (18.x LTS)

Build Command: npm ci --production
  ℹ️ Este comando:
  - Instala solo dependencies (no devDependencies)
  - Es más rápido y ligero que npm install
  - Usa package-lock.json para versiones exactas

Start Command: node ws-proxy.js
```

**Instance Settings**:

```text
Plan: Free
  ✅ 750 horas/mes gratis
  ✅ Sleep después de 15 min inactividad
  ✅ Perfecto para tu uso (154h/mes)
```

### 2.4 Verificar Archivos Requeridos

Antes de continuar, asegurar que tu repo tiene estos archivos:

```text
ws-proxy/
├── ws-proxy.js          ✅ (servidor proxy)
├── package.json         ✅ (dependencias)
├── package-lock.json    ⚠️ IMPORTANTE! (versiones exactas)
└── render.yaml          ✅ (opcional, pero recomendado)
```

⚠️ **CRÍTICO**: `package-lock.json` debe estar en el repo:
- `npm ci` lo requiere (falla sin él)
- Si no lo tienes: `npm install` en local primero
- Luego: `git add package-lock.json` y commit

### 2.5 Variables de Entorno

Click en **"Advanced"** → **"Add Environment Variable"**

Agregar las siguientes variables:

| Key | Value |
|-----|-------|
| `NODE_ENV` | `production` |
| `TZ` | `America/Argentina/Buenos_Aires` |
| `PRIMARY_WS_URL` | `wss://api.cocos.xoms.com.ar` |
| `ALLOWED_ORIGINS` | `https://tu-dominio.com` (⚠️ CAMBIAR!) |

⚠️ **IMPORTANTE**: Reemplazar `https://tu-dominio.com` con la URL real de tu frontend.

Si usas localhost para desarrollo, agregar ambos:
```
https://tu-dominio.com,http://localhost:5173
```

### 2.6 Deploy

1. Click **"Create Web Service"**
2. Esperar ~2-3 minutos mientras Render:
   - Clona el repo
   - Instala dependencias
   - Inicia el servicio
3. Status cambiará a **"Live"** (verde) ✅

## 📝 Paso 3: Obtener URL del Proxy

Una vez deployed, Render te da una URL como:

```
https://ws-proxy-cocos.onrender.com
```

O:

```
https://ws-proxy-cocos-xxxxx.onrender.com
```

**Copiar esta URL** - la necesitarás para el frontend.

## ✅ Paso 4: Verificar Deployment

### Test 1: Health Check

```powershell
# Desde PowerShell
curl https://ws-proxy-cocos.onrender.com/health
```

Respuesta esperada:
```json
{
  "status": "ok",
  "uptime": 30,
  "timestamp": 1698765432000,
  "marketHours": true,
  "connections": 0
}
```

### Test 2: Home Page

Abrir en navegador:
```
https://ws-proxy-cocos.onrender.com
```

Deberías ver una página HTML con el estado del proxy.

### Test 3: Stats

```powershell
curl https://ws-proxy-cocos.onrender.com/stats
```

Respuesta esperada:
```json
{
  "totalConnections": 0,
  "activeConnections": 0,
  "messagesForwarded": 0,
  "errors": 0,
  "uptime": 45,
  "marketHours": true,
  "memory": { ... }
}
```

## 🔧 Paso 5: Integrar con Frontend

### Actualizar configuración del cliente

```javascript
// frontend/src/services/broker/jsrofex-client.js

// ANTES (directo a Primary API - NO FUNCIONA)
const WS_URL = 'wss://api.cocos.xoms.com.ar';

// DESPUÉS (a través del proxy - FUNCIONA ✅)
const WS_URL = import.meta.env.PROD
  ? 'wss://ws-proxy-cocos.onrender.com'  // ⚠️ USAR TU URL REAL
  : 'ws://localhost:8080';  // Para desarrollo local

// Conectar
connect(token) {
  const url = `${WS_URL}?token=${encodeURIComponent(token)}`;
  this.ws = new WebSocket(url);
  
  this.ws.onopen = () => {
    console.log('✅ Conectado al proxy WebSocket');
  };
  
  // ... resto del código
}
```

### Actualizar variables de entorno

```bash
# frontend/.env.production
VITE_WS_PROXY_URL=wss://ws-proxy-cocos.onrender.com
```

```javascript
// Usar en código
const WS_URL = import.meta.env.VITE_WS_PROXY_URL;
```

## 🧪 Paso 6: Probar Conexión End-to-End

### Test desde Browser Console

```javascript
// En DevTools Console de tu frontend
const token = 'TU_TOKEN_AQUI';
const ws = new WebSocket(`wss://ws-proxy-cocos.onrender.com?token=${token}`);

ws.onopen = () => console.log('✅ Conectado!');
ws.onmessage = (e) => console.log('📨 Mensaje:', e.data);
ws.onerror = (e) => console.error('❌ Error:', e);
ws.onclose = () => console.log('👋 Desconectado');

// Después de conectar, suscribirse
ws.send(JSON.stringify({
  type: 'smd',
  products: [{ symbol: 'GGAL', marketId: 'ROFX' }],
  entries: ['LA', 'BI', 'OF'],
  depth: 1
}));
```

**Resultado esperado**:
1. `✅ Conectado!` - Conexión exitosa
2. `📨 Mensaje: {...}` - Market data recibido

## 📊 Paso 7: Monitorear (Primer Día)

### Ver Logs en Tiempo Real

1. En Render dashboard → Click en tu service
2. Tab **"Logs"**
3. Observar logs en tiempo real

**Logs esperados**:

```
[10:00:00] INFO: 🚀 WebSocket Proxy Server Started { port: 8080, marketHours: 'OPEN' }
[10:00:30] INFO: Client connected { clientId: 'abc123' }
[10:00:31] INFO: API connection established { clientId: 'abc123' }
[10:00:32] DEBUG: Client → API { clientId: 'abc123', bytes: 150 }
[10:00:32] DEBUG: API → Client { clientId: 'abc123', bytes: 890 }
```

### Verificar Horarios

**10:00 AM (primera conexión)**:
- ⏱️ Cold start esperado: ~30-60 segundos
- Después: conexión instantánea

**5:00 PM (última conexión)**:
- Conexiones se cierran
- 15 minutos después → Render pone service a dormir

## 🔄 Paso 8: Auto-Deploy (Opcional)

Render auto-deploya cuando haces push a GitHub:

```powershell
# Hacer cambios en ws-proxy.js
# Commit y push
git add ws-proxy/
git commit -m "Update proxy configuration"
git push

# Render automáticamente:
# 1. Detecta el push
# 2. Re-build
# 3. Re-deploy
# 4. ~2-3 minutos después: servicio actualizado
```

Ver progreso en Render dashboard → "Events" tab.

## 🐛 Troubleshooting

### ❌ Problema: "Origin not allowed"

**Error en logs**: `Origin not allowed { origin: 'https://mi-app.com' }`

**Solución**: Agregar tu dominio a `ALLOWED_ORIGINS` en environment variables:
```
ALLOWED_ORIGINS=https://mi-app.com,http://localhost:5173
```

### ❌ Problema: "Token required"

**Error**: WebSocket se cierra inmediatamente con código 1008

**Solución**: Asegurar que pasas token en query parameter:
```javascript
const url = `${WS_URL}?token=${encodeURIComponent(token)}`;
```

### ❌ Problema: "API connection error"

**Error en logs**: `API connection error { error: '...' }`

**Causas posibles**:
1. Token expirado o inválido
2. URL de Primary API incorrecta
3. Primary API fuera de servicio

**Solución**: Verificar token y URL en variables de entorno.

### ❌ Problema: Cold start muy lento

**Síntoma**: Primera conexión a las 10 AM tarda >1 minuto

**Explicación**: Normal en free tier de Render.

**Soluciones**:
- **Aceptar el delay** (es solo la primera vez del día)
- **Upgrade a Starter** ($7/mes) para eliminar cold starts
- **Pre-warm**: Hacer un health check a las 9:59 AM

### ❌ Problema: Service se duerme durante el día

**Síntoma**: Cold starts a las 11 AM, 2 PM, etc.

**Causa**: Sin conexiones activas por >15 minutos.

**Solución**: Mantener al menos 1 conexión WebSocket abierta durante horas de mercado.

## 📈 Próximos Pasos

- [ ] Deployment exitoso ✅
- [ ] Health check OK ✅
- [ ] Frontend conectado ✅
- [ ] Market data recibido ✅
- [ ] Monitoreado primer día completo
- [ ] Configurar alertas (Render dashboard → Settings → Notifications)
- [ ] Documentar URL del proxy en tu repo
- [ ] Actualizar frontend para usar proxy por defecto

## 💡 Tips

1. **Guardar URL del proxy**: Anótala en un lugar seguro
2. **Custom Domain** (opcional): Puedes configurar tu propio dominio en Render → Settings → Custom Domain
3. **Backups**: El código está en GitHub, deployment es reproducible
4. **Costs**: Mientras uses <750h/mes, es **gratis** ✅
5. **Support**: Render tiene docs excelentes en render.com/docs

## ✅ Checklist Final

- [ ] Repo en GitHub ✅
- [ ] Service creado en Render ✅
- [ ] Environment variables configuradas ✅
- [ ] Deployment exitoso (status: Live) ✅
- [ ] `/health` responde OK ✅
- [ ] URL del proxy copiada ✅
- [ ] Frontend actualizado con nueva URL ✅
- [ ] Conexión WebSocket probada ✅
- [ ] Market data recibido ✅
- [ ] Logs monitoreados ✅

**¡Listo para producción! 🎉**

---

## 📞 Soporte

Si tienes problemas:

1. **Render Logs**: Revisar logs en dashboard
2. **Test Local**: Probar `npm start` localmente primero
3. **GitHub Issues**: Crear issue si encuentras bug
4. **Render Docs**: render.com/docs/web-services

**Tiempo estimado total**: 15-20 minutos ⏱️
