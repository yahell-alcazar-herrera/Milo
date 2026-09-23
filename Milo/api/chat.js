const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MAX_MESSAGES = 30;
const MAX_MESSAGE_LENGTH = 12000;

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Método no permitido" });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return response.status(500).json({ error: "Falta configurar GROQ_API_KEY en el servidor" });
  }

  const body = request.body || {};
  const messages = Array.isArray(body.messages) ? body.messages : [];
  if (!messages.length || messages.length > MAX_MESSAGES) {
    return response.status(400).json({ error: "Historial inválido" });
  }

  const mensajesLimpios = messages.map((message) => ({
    role: message.role === "system" ? "system" : message.role === "assistant" ? "assistant" : "user",
    content: String(message.content || "").slice(0, MAX_MESSAGE_LENGTH)
  }));

  try {
    const groqResponse = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: body.model || "openai/gpt-oss-20b",
        messages: mensajesLimpios,
        temperature: Math.min(1, Math.max(0, Number(body.temperature) || 0.75))
      })
    });

    const data = await groqResponse.json();
    return response.status(groqResponse.status).json(data);
  } catch (error) {
    return response.status(502).json({ error: "No se pudo conectar con el proveedor de IA" });
  }
}
