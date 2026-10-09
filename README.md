# CodePilot AI

A full-stack AI coding chatbot built with **HTML, CSS, vanilla JavaScript, Node.js, and Express.js**.
It helps you research, write, generate, debug, and understand code — and it analyzes screenshots and designs.

> ⚠️ This project requires at least one external service (an AI provider). Without it, chat and image
> analysis are disabled and the UI tells you exactly what to configure. Web research requires a search
> provider. Nothing is faked.

---

## Features

- 💬 Streaming AI chat with code-aware Markdown rendering
- 🖼️ Image / screenshot analysis via a vision-capable model
- 🔎 Research mode using a real web-search API with citations
- 🗂️ Conversation history (in-memory guest mode or PostgreSQL)
- 📁 Project workspace: create projects, add files, download as ZIP
- 🌓 Dark / light themes (saved in local storage)
- 📱 Responsive layout with a collapsible sidebar
- 🔐 API keys stay server-side; uploads are validated; safe path handling

---

## Tech Stack

| Layer     | Technology                                  |
|-----------|---------------------------------------------|
| Frontend  | HTML5, CSS3, vanilla JavaScript, Fetch API  |
| Backend   | Node.js, Express.js                         |
| Database  | PostgreSQL (optional; guest mode available) |
| AI        | Any OpenAI-compatible chat completions API  |
| Search    | Any Tavily-compatible search API            |
| Streaming | Server-Sent Events (SSE)                    |

No React, Vue, Angular, Tailwind, Bootstrap, or jQuery is used.

---

## Prerequisites

- **Node.js 20+** and **npm**
- An **AI provider API key** (OpenAI, Groq, Together, OpenRouter, etc.)
- *(Optional)* A **search API key** for research mode (Tavily, etc.)
- *(Optional)* A **PostgreSQL database** for persistence

Check your versions:

```bash
node -v
npm -v
