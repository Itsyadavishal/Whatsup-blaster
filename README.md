# 🚀 WhatsApp Blaster

> Bulk WhatsApp messaging tool with real QR authentication, phone linking, 
> and AI-powered features. Cross-platform ready (Web → Desktop → Android).

## 📋 Quick Start

### Prerequisites
- Bun 1.x or Node.js 18+
- Chromium (for Playwright)

### Installation
```bash
# Clone the repo
git clone https://github.com/Itsyadavishal/Whatsup-blaster.git
cd Whatsup-blaster

# Install root dependencies
bun install

# Install backend service dependencies
cd mini-services/whatsapp-service && bun install && cd ../..

# Setup database
bun run db:generate && bun run db:push

# Install Playwright browsers
npx playwright install chromium
```

### Development Mode
```bash
# Terminal 1: Start backend service
cd mini-services/whatsapp-service && bun run dev

# Terminal 2: Start frontend
bun run dev
```

Open [http://localhost:3000](http://localhost:3000)

## 🏗️ Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────┐
│  Next.js :3000  │────>│  API Proxy Route │────>│ Express :3003│
│  (Frontend)     │<────│  (/api/whatsapp/*)│<────│ (Backend +   │
│                 │     │                  │     │  Playwright) │
└─────────────────┘     └──────────────────┘     └─────────────┘
```

## 📁 Project Structure

```
whatsapp-blaster/
├── src/app/
│   ├── page.tsx              # Main UI (~1390 lines)
│   ├── layout.tsx            # Root layout
│   └── api/whatsapp/[...path]/route.ts  # API proxy
├── mini-services/whatsapp-service/
│   └── index.ts              # Backend service (~901 lines)
├── prisma/schema.prisma      # Database schema
├── ABOUT.md                  # Detailed AI agent guide
└── package.json
```

## 🔌 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/whatsapp/init` | POST | Initialize WhatsApp, get QR |
| `/api/whatsapp/qrcode` | GET | Get QR code image |
| `/api/whatsapp/send-message` | POST | Send single message |
| `/api/whatsapp/bulk-send` | POST | Send bulk messages |
| `/api/whatsapp/status` | GET | Auth status |
| `/api/health` | GET | Health check |

## 🤖 AI Integration (Planned)

- **Model**: SmolLM-360M (360M parameters, ~140MB)
- **Features**: Message personalization, human-like timing, variations
- **Platforms**: Web (Transformers.js), Desktop (ONNX), Mobile (TFLite)

## 🛣️ Roadmap

- [ ] Phase 1: Fix QR display bug, add redirect mode
- [ ] Phase 2: Integrate SmolLM AI engine
- [ ] Phase 3: Desktop app (Tauri)
- [ ] Phase 4: Android app (React Native)

## 📝 For AI Agents

See [ABOUT.md](./ABOUT.md) for:
- Detailed architecture docs
- Common bugs & fixes
- Development workflow
- Testing guides
- Deployment instructions

## 📄 License

MIT License

## 👥 Collaboration

This project is developed collaboratively by:
- **Human** (You): Direction, testing, feedback
- **AI Agent X**: Primary coder, implements features
- **Super Z**: Architecture, review, guidance, quality control
