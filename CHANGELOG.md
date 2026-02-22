# Changelog

## 2026-02-22

### Changed
- **URL**: Deployed to new Cloudflare Workers URL: `https://stu.spencer-859.workers.dev/`
- **Deleted**: Old worker `botschat-api` removed from Cloudflare
- **E2E Encryption**: Now disabled by default (opt-in via settings)
- **Model Routing**: Fixed model ID format for proper OpenClaw routing
- **System Prompts**: Added to agents (main, kimi, jenna) to prevent "blank slate" responses

### Added
- **Auto-session titles**: First message in a session now auto-generates a contextual title using Gemini Flash
- **Model normalization**: Short model IDs are mapped to full provider/model-id format
- **Message model field**: All WebSocket messages now include the selected model for routing

### Fixed
- Billing error caused by wrong model routing (was routing to Anthropic instead of Moonshot)
- Session naming now works with proper model format
