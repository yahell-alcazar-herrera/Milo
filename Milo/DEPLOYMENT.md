# Guía de publicación de Milo

## 1) Publicarlo como app web real (Render/Railway)

### Objetivo
Publicar la aplicación sin exponer la clave de Groq ni dejar la autenticación en un archivo local.

### Requisitos
- Cuenta en GitHub
- Cuenta en Render o Railway
- Cuenta en Supabase
- Un dominio opcional (Cloudflare, Namecheap, etc.)

### Pasos
1. Sube este proyecto a GitHub.
2. Crea un proyecto nuevo en Render o Railway.
3. Conéctalo al repositorio de GitHub.
4. Usa el comando de inicio: `npm start`
5. Agrega estas variables de entorno en el panel del hosting:
   - `GROQ_API_KEY`
   - `PORT=3000`
   - `NODE_ENV=production`
6. Haz deploy.
7. Prueba la URL pública.

### Recomendación
Usa Render para empezar; es más directo para una app Node sencilla.

---

## 2) Publicarlo como sitio web final con dominio

### Objetivo
Dejarlo disponible en una URL tipo `milo.app` o similar.

### Pasos
1. Compra un dominio o usa Cloudflare.
2. Conecta el dominio al hosting (Render/Railway).
3. Habilita HTTPS.
4. Configura DNS:
   - A o CNAME apuntando al host del servicio
5. Espera la propagación del DNS.
6. Prueba la app desde el dominio real.

---

## 3) Cuentas propias de Milo

Milo permite crear cuentas con nombre de usuario y contraseña. No envía correos ni depende de un proveedor externo de inicio de sesión.

- El servidor valida que el nombre sea único.
- Las contraseñas se guardan con hash scrypt en `users.json`.
- Para crear cuentas e iniciar sesión, ejecuta Milo con `npm start`; abrir `chatbot.html` directamente no conecta con el servidor.
- En Render, monta un disco persistente en `/var/data` y define `MILO_DATA_DIR=/var/data` para conservar `users.json` entre despliegues. El servicio debe tener un plan compatible y el disco genera un cargo.
- Este flujo no incluye verificación de correo ni recuperación de contraseña.
### Experiencia de chat e imágenes

- Las respuestas pueden incluir Markdown. Los bloques de código aparecen en tarjetas con botón para copiar.
- El dictado usa el reconocimiento de voz integrado en Chrome/Edge y requiere HTTPS y permiso de micrófono. La app solicita español general para mejorar compatibilidad.
- Las imágenes se crean como ilustraciones SVG con Groq. Milo puede revisar su ilustración anterior si le pedís cambios, por ejemplo “ponle pelo”. No hay un proveedor de generación fotorrealista ni búsqueda web en vivo configurados.

---## 4) Qué no debes hacer en producción

- No dejar `GROQ_API_KEY` en el HTML
- No poner el key en GitHub
- No guardar usuarios en `users.json`
- No abrir `chatbot.html` directamente
- No usar una contraseña débil ni “tu Gmail + cualquiera"

---

## 5) Siguientes pasos recomendados para Milo

1. Migrar auth local a Supabase Auth
2. Guardar usuarios en base de datos real
3. Reemplazar `users.json` por BD
4. Mantener `/api/chat` en el backend
5. Añadir dominio y HTTPS
6. Probar registro, login, cierre con confirmación, chat y IA

---

## 6) Mejor orden para hacerlo

### Fase A: app pública funcional
- Render/Railway
- `GROQ_API_KEY` segura
- dominio básico
- auth local o Supabase

### Fase B: app lista para producción
- Supabase Auth
- base de datos real
- roles, sesiones y recuperación de contraseña
- dominio profesional

### Fase C: crecimiento
- dashboard de usuarios
- historial de chats
- analítica
- plan premium

---

## 7) Recomendación final

Para subirla sin complicarte: usa Render + Supabase. Es la opción más rápida, segura y estable para una app como Milo.
