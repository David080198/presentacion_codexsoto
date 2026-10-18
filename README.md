# CodexSoto Live · Agentes de IA 2026

App interactiva para la conferencia **Agentes de IA 2026**: el público escanea un QR, vota desde el celular, manda preguntas y se registra al final. La presentación se sirve desde la misma app: al cambiar de lámina, los celulares cambian solos de dinámica y los resultados aparecen en vivo en las láminas.

**Tema:** De PLN y Transformers a agentes LLM en producción · 6 niveles · 42 diapositivas interactivas.

## Rutas principales

| Ruta | Para quién | Qué hace |
| --- | --- | --- |
| `/` | Público (QR) | Votaciones, preguntas y registro |
| `/deck?token=TU_TOKEN` | Tú, en el proyector | La presentación (42 slides); controla los celulares y muestra resultados en vivo |
| `/admin` | Tú | Panel: cambiar dinámica, revelar respuestas, moderar preguntas, descargar registros CSV |
| `/deck-pln` | Público | Curso de PLN: presentación interactiva de solo navegación (sin votaciones ni backend) |
| `/roadmap` | Estudiantes y developers | **Guía de aprendizaje:** 6 meses, certificaciones cloud (AWS/Azure/GCP) y ágiles (CSD, CSM) |
| `/healthz` | Dokploy | Chequeo de salud |

## Contenido de la presentación (6 niveles)

| Lámina | Los celulares muestran |
| --- | --- |
| Escanea y participa | Bienvenida y contador de conectados |
| ¿Azul o roja? | Votación de píldoras |
| ¿Humano o máquina? | 4 textos para votar; cada uno se revela cuando lo revelas en la lámina |
| Todo un LLM se reduce a esto | ¿Qué palabra sigue? (temperatura ajustable) |
| Preguntas del público | Pestaña de preguntas (las más votadas se ven en la lámina) |
| Cierre y registro | Formulario de registro + botón para entrar a CodexSoto |

**Los 6 niveles:**

1. **El lenguaje** — PLN, limpieza, tokenización y BPE. Cómo una máquina ve el texto.
2. **El significado** — Embeddings, word2vec, analogías y un clasificador de canciones infantiles (tu proyecto real).
3. **El Arquitecto** — Transformer, atención multi-cabeza, codificación posicional, Q·K·V.
4. **El Oráculo** — LLMs: predicción del siguiente token, escala, entrenamiento en 3 fases, límites (alucinación, conocimiento congelado, sin acción).
5. **Los Agentes** ⭐ — Herramientas, memoria, RAG, ReAct, tool calling, MCP, multiagente, casos reales (CFO virtual, Aceitunaos POS, mesa de servicio).
6. **El mundo real** — Aplicaciones por sector, riesgos de seguridad (prompt injection), costo por token, ruta de aprendizaje en 6 meses.

## Roadmap de aprendizaje (6 meses)

**`/roadmap`** incluye una **guía estructurada de 6 meses** para que estudiantes y developers pasen de cero a construir agentes en producción:

- **6 etapas:** fundamentos → ML → Transformers → LLMs locales → Agentes → Producción.
- **Certificaciones cloud:** AWS Solutions Architect, AWS Developer, AWS ML Specialty, Azure, GCP.
- **Metodologías ágiles:** Certified Scrum Developer (CSD®), CSPO, CSM, Kanban.
- **Impacto en industria:** Dónde trabajan los agentes hoy (2026), salarios, casos reales.
- **Repositorios:** Enlaces a mis proyectos: RAG, agentes con código, detectores de plagio, chatbots.

## Por qué los agentes en 2026

Los agentes no son hype. Son **realidad productiva**:

- **Escasez de talento:** Pocos developers saben construirlos.
- **ROI inmediato:** Una empresa automatiza un proceso de 3 personas con un agente. Paga la dev en 1–2 meses.
- **Multiherramienta:** Atan LLMs, APIs, bases de datos, workflows. Es el nexo de todo.
- **Modelos abiertos listos:** Ollama + Llama 3 = agentes sin pagar a OpenAI.
- **Diferenciación:** Quien domina agentes cierra clientes que otros no pueden.

**Mi experiencia:**
- CFO virtual conectado a SAP y Shopify (análisis financiero automático).
- Aceitunaos POS: predicción de ventas e insumos + agentes de monitoreo en vivo.
- Mesa de servicio: clasificación y resolución automática de tickets.
- Detección de plagio con Transformers + agentes de búsqueda.

## Desplegar en Dokploy

1. Sube este repositorio a GitHub (o GitLab/Gitea).
2. En Dokploy: **Create Service → Application**, conecta el repositorio y la rama `main`.
3. **Build Type:** `Dockerfile` (ruta `./Dockerfile`).
4. **Environment:** copia `.env.example` y pon un `ADMIN_TOKEN` largo (por ejemplo, el resultado de `openssl rand -hex 24`).
5. **Advanced → Volumes:** agrega un volumen montado en `/app/data`. Ahí se guardan votos, preguntas y registros; sin volumen se pierden en cada despliegue.
6. **Domains:** agrega el dominio (por ejemplo `live.codexsoto.com`), puerto `3000`, HTTPS con Let's Encrypt.
7. **Deploy.**

Alternativa: crear el servicio como **Compose** usando `docker-compose.yml` (ya declara el volumen).

> Si usas un dominio distinto a `live.codexsoto.com`, cambia `LIVE_URL` al final de `public/deck.html`. Solo se usa cuando abres la presentación fuera del servidor; dentro del servidor el QR siempre apunta al dominio real.

## Correr local

```bash
cp .env.example .env   # edita ADMIN_TOKEN
npm install
ADMIN_TOKEN=un-token-de-prueba-largo npm start
# público:      http://localhost:3000
# presentación: http://localhost:3000/deck?token=un-token-de-prueba-largo
# panel:        http://localhost:3000/admin
```

O con Docker: `docker compose up --build` (con `ADMIN_TOKEN` en `.env`).

## El día de la conferencia

1. Abre `/admin` y pulsa **Reiniciar todo lo en vivo** para borrar votos de prueba (los registros nunca se borran).
2. Abre la presentación desde el botón del panel: queda con tu token.
3. Al terminar, descarga los registros en CSV desde el panel.

## Notas técnicas

- Node 20 + Express, tiempo real con Server-Sent Events (sin dependencias extra). Pensado para una sala de cientos de personas en un solo contenedor.
- Datos en `data/db.json` con escritura atómica. Un voto por dispositivo y votación; se puede cambiar el voto hasta que se revela la respuesta.
- Seguridad: límite de solicitudes por IP, validación de entradas, CSP, token de admin comparado en tiempo constante, CSV protegido contra inyección de fórmulas.
- Registro: nombre, correo, teléfono opcional, institución, carrera, intereses y consentimiento de privacidad obligatorio. Configura `PRIVACY_URL` con tu aviso de privacidad.
