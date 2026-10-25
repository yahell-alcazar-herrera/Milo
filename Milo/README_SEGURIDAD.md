# Despliegue seguro de Milo

Este proyecto debe publicarse como una aplicación web real, no como un archivo HTML abierto desde el disco.

## Reglas de seguridad

- La clave de Groq queda solo en el servidor.
- El navegador nunca debe ver `GROQ_API_KEY`.
- Las cuentas nuevas usan nombre de usuario y contraseña; no requieren correo ni verificación por email.
- Al crear una cuenta se pide una contraseña de al menos 8 caracteres; iniciar sesión acepta la contraseña existente.
- Los nombres de usuario deben ser únicos y las contraseñas se verifican en el servidor.

## Variables de entorno recomendadas

Copia `.env.example` a `.env` y completa los valores:

- `GROQ_API_KEY`
- `PORT`
- `NODE_ENV`

## Servicios recomendados para publicar

### Opción simple y robusta
- Backend: Render o Railway
- Base de datos/Auth: Supabase
- Dominio: Cloudflare o Namecheap

## Flujo sugerido

1. Subí este repositorio a GitHub.
2. Conectá el repo con Render o Railway.
3. Agregá `GROQ_API_KEY` como variable de entorno del servidor.
4. Configurá Supabase Auth para email + password.
5. Conectá el backend con Supabase y usá sesiones seguras.
6. Asigná un dominio con HTTPS.
7. Probá el login, registro, cierre de sesión y el chat real.

## Probar en tu computadora

1. Instalá Node.js LTS.
2. Copiá `.env.example` como `.env`.
3. Completa los valores reales.
4. Ejecutá `npm install`.
5. Ejecutá `npm start`.
6. Abrí `http://localhost:3000`.

No abras `chatbot.html` directamente si querés usar la app real ni la autenticación.
