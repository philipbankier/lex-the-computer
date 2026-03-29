# Contributing to Lex

Thank you for your interest in contributing to Lex! This guide will help you get set up.

## Development Setup

### Prerequisites
- Node.js 20+
- pnpm 9+
- PostgreSQL 15+
- Redis 7+

### Getting Started

```bash
# Clone the repo
git clone https://github.com/lex-the-computer/lex
cd lex

# Install dependencies
pnpm install

# Set up environment
cp .env.example .env
# Edit .env with your database URL and at least one AI API key

# Run database migrations
pnpm --filter @lex/core migrate

# Start development
pnpm dev
```

This starts:
- **Web** (Next.js) on `http://localhost:3000`
- **Core** (Hono API) on `http://localhost:3001`

## Project Structure

```
packages/
├── web/                    # Next.js 15 frontend
│   ├── app/
│   │   ├── (auth)/         # Login, signup, onboarding
│   │   └── (app)/          # Main app pages
│   ├── components/
│   │   ├── layout/         # Sidebar, TabBar, ChatSidebar, etc.
│   │   └── tabs/           # Tab context provider
│   └── lib/                # Utilities (themes, cron parser)
│
├── core/                   # Hono API server
│   ├── src/
│   │   ├── routes/         # API route handlers
│   │   ├── services/       # Business logic
│   │   ├── tools/          # AI tool definitions
│   │   ├── db/             # Drizzle schema
│   │   └── lib/            # Database, env config
│   └── migrations/         # SQL migration files
│
└── shared/                 # Shared types (future)
```

## Code Style

- **TypeScript** throughout
- **Functional components** with hooks (no class components except ErrorBoundary)
- **Tailwind CSS** for styling — use utility classes, avoid custom CSS where possible
- **CSS variables** for theming (defined in `globals.css`, applied via `lib/themes.ts`)
- Use `fetch` for API calls (no external HTTP client libraries)
- Keep components in the page file when specific to that page; extract to `components/` when reused

## Adding a New Page

1. Create `packages/web/app/(app)/your-page/page.tsx`
2. The sidebar nav items are in `components/layout/Sidebar.tsx`
3. Use the `useTabs()` hook for navigation

## Adding a New API Route

1. Create `packages/core/src/routes/your-route.ts`
2. Register it in `packages/core/src/index.ts`
3. Follow the existing pattern: `const router = new Hono(); export { router };`

## Adding a Database Table

1. Add the table definition to `packages/core/src/db/schema.ts`
2. Create a migration in `packages/core/migrations/NNNN_description.sql`
3. Run `pnpm --filter @lex/core migrate`

## Creating a Skill

Skills follow the AgentSkills format:
```
workspace/skills/your-skill/
├── SKILL.md          # Frontmatter + instructions
├── scripts/          # Optional scripts
├── references/       # Optional reference files
└── assets/           # Optional assets
```

## Pull Request Process

1. Fork the repo and create a feature branch
2. Make your changes
3. Ensure both packages build: `pnpm --filter @lex/web build && pnpm --filter @lex/core build`
4. Write a clear PR description explaining what and why
5. Submit the PR against `main`

## Reporting Issues

Please open an issue on GitHub with:
- Steps to reproduce
- Expected vs actual behavior
- Environment details (OS, Docker version, browser)

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
