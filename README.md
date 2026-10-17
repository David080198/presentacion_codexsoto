# CodexSoto Live

App para la conferencia **Agentes de IA 2026**: el público escanea un QR, vota desde el celular, manda preguntas y se registra al final. La presentación se sirve desde la misma app: al cambiar de lámina, los celulares cambian solos de dinámica y los resultados aparecen en vivo en las láminas.

| Ruta | Para quién | Qué hace |
| --- | --- | --- |
| `/` | Público (QR) | Votaciones, preguntas y registro |
| `/deck?token=TU_TOKEN` | Tú, en el proyector | La presentación; controla los celulares y muestra resultados |
| `/admin` | Tú | Panel: cambiar dinámica a mano, revelar respuestas, moderar preguntas, descargar registros en CSV, reiniciar |
| `/healthz` | Dokploy | Chequeo de salud |

## Qué dinámica activa cada lámina

| Lámina | Los celulares muestran |
| --- | --- |
| Escanea y participa | Bienvenida y contador de conectados |
| ¿Azul o roja? | Votación de píldoras |
| ¿Humano o máquina? | 4 textos para votar; cada uno se revela cuando lo revelas en la lámina |
| Todo un LLM se reduce a esto | ¿Qué palabra sigue? |
| Preguntas del público | Pestaña de preguntas (las más votadas se ven en la lámina) |
| Cierre | Formulario de registro y botón para entrar a la plataforma |

Solo `/deck?token=...` cambia la dinámica. Si abres `/deck` sin token, ves los resultados pero no controlas los celulares.

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
