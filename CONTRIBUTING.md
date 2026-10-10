# Contributing to harness-dc

Thanks for your interest in contributing to **harness-dc**! We welcome contributions from developers and AI agent enthusiasts.

---

## Development Setup

### Prerequisites
- **Node.js**: 18.0.0 or higher
- **npm**: 9.0.0 or higher
- **Discord Desktop App**: Running locally for testing RPC IPC sockets.

### Setup Steps
```bash
# 1. Fork & Clone the repo
git clone https://github.com/MuaraAI/harness-dc.git
cd harness-dc

# 2. Install dependencies
npm install

# 3. Run tests in watch mode
npm run test:watch

# 4. Build TypeScript
npm run build
```

---

## Adding Support for a New AI Agent

Adding a new coding agent takes just a few lines in `src/constants.ts`:

1. Register the agent in `DEFAULT_AGENTS`:
   ```typescript
   {
     key: "your-agent",
     displayName: "Your Agent Name",
     clientId: "DISCORD_APPLICATION_CLIENT_ID",
     processNames: ["binary-name", "script-name"],
     largeImageKey: "logo",
     largeText: "Your Agent Name",
     smallImageKey: "icon",
     smallText: "Active",
   }
   ```
2. Add a unit test in `tests/constants.test.ts` and `tests/scanner.test.ts`.
3. Verify with `npm test`.

---

## Git & Commit Guidelines

We enforce **Conventional Commits**:

- `feat(scope): add new feature`
- `fix(scope): fix bug`
- `docs(scope): update documentation`
- `test(scope): add or improve tests`
- `refactor(scope): refactor code without behavior change`
- `chore(scope): build, dependencies, or repo maintenance`

---

## Pull Request Checklist

Before submitting your PR:
- [ ] All tests pass: `npm test`
- [ ] TypeScript compiles cleanly without errors: `npm run build`
- [ ] No secrets or `.env` files are committed
- [ ] Code adheres to existing style and minimal-dependency philosophy (The Ladder).

---

## Questions?

Reach out to the maintainers at [admin@muaraai.com](mailto:admin@muaraai.com) or join our community discussions.
