import "dotenv/config";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3000);
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MAX_BODY = 1024 * 1024;
const MAX_MESSAGES = 30;
const MAX_MESSAGE_LENGTH = 12000;
const solicitudes = new Map();
const USERS_FILE = path.join(ROOT, "users.json");
const sesiones = new Map();

function leerUsuarios() {
  try { return JSON.parse(fs.readFileSync(USERS_FILE, "utf8")); } catch { return []; }
}

function guardarUsuarios(usuarios) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(usuarios, null, 2), { mode: 0o600 });
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (error, derivedKey) => {
      if (error) reject(error);
      else resolve(`${salt}:${derivedKey.toString("hex")}`);
    });
  });
}

function esPasswordSegura(password, email = "") {
  const texto = String(password || "");
  if (texto.length < 12) return false;
  if (texto.toLowerCase().includes(String(email).toLowerCase())) return false;
  if (!/[a-z]/.test(texto)) return false;
  if (!/[A-Z]/.test(texto)) return false;
  if (!/[0-9]/.test(texto)) return false;
  if (!/[^A-Za-z0-9]/.test(texto)) return false;
  return true;
}

async function comprobarPassword(password, guardada) {
  const [salt, hash] = String(guardada).split(":");
  if (!salt || !hash) return false;
  const candidata = await hashPassword(password, salt);
  return crypto.timingSafeEqual(Buffer.from(candidata.split(":")[1], "hex"), Buffer.from(hash, "hex"));
}

function cookies(request) {
  return Object.fromEntries((request.headers.cookie || "").split(";").filter(Boolean).map((cookie) => {
    const [nombre, ...valor] = cookie.trim().split("=");
    return [nombre, decodeURIComponent(valor.join("="))];
  }));
}

function usuarioActual(request) {
  const token = cookies(request).milo_session;
  return token ? sesiones.get(token) : null;
}

function crearSesion(response, usuario) {
  const token = crypto.randomBytes(32).toString("hex");
  sesiones.set(token, usuario);
  const protocoloSeguro = process.env.NODE_ENV === "production" ? "; Secure" : "";
  response.setHeader("Set-Cookie", `milo_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800${protocoloSeguro}`);
}

function leerJson(request) {
  return leerCuerpo(request).then((texto) => JSON.parse(texto || "{}"));
}

function enviarJson(response, status, data) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(data));
}

function limiteSuperado(request) {
  const ip = request.socket.remoteAddress || "desconocida";
  const ahora = Date.now();
  const anterior = solicitudes.get(ip) || 0;
  if (ahora - anterior < 1200) return true;
  solicitudes.set(ip, ahora);
  return false;
}

function leerCuerpo(request) {
  return new Promise((resolve, reject) => {
    let cuerpo = "";
    request.on("data", (trozo) => {
      cuerpo += trozo;
      if (Buffer.byteLength(cuerpo) > MAX_BODY) reject(new Error("body_too_large"));
    });
    request.on("end", () => resolve(cuerpo));
    request.on("error", reject);
  });
}

async function atenderChat(request, response) {
  if (request.method !== "POST") return enviarJson(response, 405, { error: "Método no permitido" });
  if (!process.env.GROQ_API_KEY) return enviarJson(response, 500, { error: "Falta GROQ_API_KEY en el archivo .env" });
  if (!usuarioActual(request)) return enviarJson(response, 401, { error: "Iniciá sesión para usar Milo" });
  if (limiteSuperado(request)) return enviarJson(response, 429, { error: "Demasiadas solicitudes; esperá un momento" });

  try {
    const body = JSON.parse(await leerCuerpo(request));
    const messages = Array.isArray(body.messages) ? body.messages : [];
    if (!messages.length || messages.length > MAX_MESSAGES) return enviarJson(response, 400, { error: "Historial inválido" });

    const mensajesLimpios = messages.map((message) => ({
      role: message.role === "system" ? "system" : message.role === "assistant" ? "assistant" : "user",
      content: String(message.content || "").slice(0, MAX_MESSAGE_LENGTH)
    }));

    const groqResponse = await fetch(GROQ_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${process.env.GROQ_API_KEY}` },
      body: JSON.stringify({
        model: body.model || "openai/gpt-oss-20b",
        messages: mensajesLimpios,
        temperature: Math.min(1, Math.max(0, Number(body.temperature) || 0.75))
      })
    });
    const data = await groqResponse.json();
    return enviarJson(response, groqResponse.status, data);
  } catch (error) {
    const status = error.message === "body_too_large" ? 413 : 502;
    return enviarJson(response, status, { error: status === 413 ? "Solicitud demasiado grande" : "No se pudo conectar con Groq" });
  }
}

async function atenderAuth(request, response, ruta) {
  if (request.method === "GET" && ruta === "/api/auth/me") {
    const usuario = usuarioActual(request);
    return enviarJson(response, 200, { user: usuario ? { email: usuario.email } : null });
  }
  if (request.method === "POST" && ruta === "/api/auth/logout") {
    const token = cookies(request).milo_session;
    sesiones.delete(token);
    const protocoloSeguro = process.env.NODE_ENV === "production" ? "; Secure" : "";
    response.setHeader("Set-Cookie", `milo_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${protocoloSeguro}`);
    return enviarJson(response, 200, { ok: true });
  }
  if (request.method !== "POST") return enviarJson(response, 405, { error: "Método no permitido" });

  try {
    const body = await leerJson(request);
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const confirmPassword = String(body.confirmPassword || "");
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return enviarJson(response, 400, { error: "Usá un correo válido" });
    }
    if (password.length < 12 || !esPasswordSegura(password, email)) {
      return enviarJson(response, 400, { error: "La contraseña debe tener al menos 12 caracteres, incluir mayúscula, minúscula, número y símbolo." });
    }
    const usuarios = leerUsuarios();
    if (ruta === "/api/auth/register") {
      if (password !== confirmPassword) return enviarJson(response, 400, { error: "Las contraseñas no coinciden" });
      if (usuarios.some((user) => user.email === email)) return enviarJson(response, 409, { error: "Ese correo ya está registrado" });
      const usuario = { id: crypto.randomUUID(), email, password: await hashPassword(password), createdAt: new Date().toISOString() };
      usuarios.push(usuario);
      guardarUsuarios(usuarios);
      crearSesion(response, { id: usuario.id, email });
      return enviarJson(response, 201, { user: { email } });
    }
    if (ruta === "/api/auth/login") {
      const usuario = usuarios.find((user) => user.email === email);
      if (!usuario || !(await comprobarPassword(password, usuario.password))) return enviarJson(response, 401, { error: "Correo o contraseña incorrectos" });
      crearSesion(response, { id: usuario.id, email });
      return enviarJson(response, 200, { user: { email } });
    }
    return enviarJson(response, 404, { error: "Ruta no encontrada" });
  } catch {
    return enviarJson(response, 400, { error: "Solicitud inválida" });
  }
}

function servirArchivo(request, response) {
  const solicitado = request.url === "/" ? "/chatbot.html" : request.url.split("?")[0];
  const ruta = path.resolve(ROOT, "." + solicitado);
  if (!ruta.startsWith(ROOT) || !fs.existsSync(ruta) || fs.statSync(ruta).isDirectory()) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    return response.end("No encontrado");
  }
  const tipos = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".txt": "text/plain; charset=utf-8" };
  response.writeHead(200, { "Content-Type": tipos[path.extname(ruta)] || "application/octet-stream" });
  fs.createReadStream(ruta).pipe(response);
}

const servidor = http.createServer((request, response) => {
  const ruta = request.url?.split("?")[0];
  if (ruta === "/api/chat") return atenderChat(request, response);
  if (ruta?.startsWith("/api/auth/")) return atenderAuth(request, response, ruta);
  return servirArchivo(request, response);
});

servidor.listen(PORT, () => console.log(`Milo disponible en http://localhost:${PORT}`));
