# Hackathon Commit Plan 🚀

This document outlines the step-by-step git commit plan to simulate progressive development for the hackathon. Since the code is already built, follow this schedule and stage **only the specific files/folders** mentioned for each hour. Do not commit everything at once!

> **Current Time:** ~10:30 AM
> **Goal:** Commit progress every 1 hour from 11:00 AM to 5:00 PM.

---

### 🕒 11:00 AM - Commit 1: Initial Setup & Configuration
**Message:** `chore: initialize project with vite, bun, and core configs`
**Files to stage:**
- `client/package.json`
- `client/bun.lock`
- `client/bunfig.toml`
- `client/vite.config.ts`
- `client/tsconfig.json`
- `client/eslint.config.js`
- `client/.env`, `client/.gitignore`, `client/.prettierrc`, `client/.prettierignore`
- `client/components.json`
- `client/README.md`

**Command to run:**
```bash
git add client/package.json client/bun.lock client/bunfig.toml client/vite.config.ts client/tsconfig.json client/eslint.config.js client/.env client/.gitignore client/.prettierrc client/.prettierignore client/components.json client/README.md
git commit -m "chore: initialize project with vite, bun, and core configs"
```

---

### 🕒 12:00 PM - Commit 2: UI Framework & Base Components
**Message:** `feat: setup UI framework, theming, and base components`
**Files to stage:**
- `client/src/styles.css`
- `client/src/components/ui/` (all base UI components)
- `client/src/components/theme-provider.tsx`
- `client/src/components/animated.tsx`
- `client/public/`

**Command to run:**
```bash
git add client/src/styles.css client/src/components/ui client/src/components/theme-provider.tsx client/src/components/animated.tsx client/public
git commit -m "feat: setup UI framework, theming, and base components"
```

---

### 🕒 1:00 PM - Commit 3: Database & Backend Architecture
**Message:** `feat: integrate drizzle, supabase schemas, and server setup`
**Files to stage:**
- `server/` (the entire server folder)
- `client/drizzle/`
- `client/drizzle.config.ts`
- `client/supabase/`
- `client/src/server.ts`
- `client/src/start.ts`
- `client/src/lib/` (utility functions, API configs)

**Command to run:**
```bash
git add server/ client/drizzle/ client/drizzle.config.ts client/supabase/ client/src/server.ts client/src/start.ts client/src/lib/
git commit -m "feat: integrate drizzle, supabase schemas, and server setup"
```

---

### 🕒 2:00 PM - Commit 4: Routing & Authentication Flow
**Message:** `feat: add application routing and auth pages (login, reset password)`
**Files to stage:**
- `client/src/router.tsx`
- `client/src/routeTree.gen.ts`
- `client/src/routes/__root.tsx`
- `client/src/routes/index.tsx`
- `client/src/routes/auth.tsx`
- `client/src/routes/reset-password.tsx`
- `client/src/routes/settings.tsx`
- `client/src/hooks/` (auth & other hooks)

**Command to run:**
```bash
git add client/src/router.tsx client/src/routeTree.gen.ts client/src/routes/__root.tsx client/src/routes/index.tsx client/src/routes/auth.tsx client/src/routes/reset-password.tsx client/src/routes/settings.tsx client/src/hooks/
git commit -m "feat: add application routing and auth pages (login, reset password)"
```

---

### 🕒 3:00 PM - Commit 5: App Layout & Dashboard
**Message:** `feat: implement authenticated layout and dashboard analytics`
**Files to stage:**
- `client/src/routes/_authenticated/route.tsx`
- `client/src/routes/_authenticated/dashboard.tsx`

**Command to run:**
```bash
git add client/src/routes/_authenticated/route.tsx client/src/routes/_authenticated/dashboard.tsx
git commit -m "feat: implement authenticated layout and dashboard analytics"
```

---

### 🕒 4:00 PM - Commit 6: Core Feature - Products Management
**Message:** `feat: build products management view and data integration`
**Files to stage:**
- `client/src/routes/_authenticated/products.tsx`
- `client/src/integrations/` (API mutations/queries for products)

**Command to run:**
```bash
git add client/src/routes/_authenticated/products.tsx client/src/integrations/
git commit -m "feat: build products management view and data integration"
```

---

### 🕒 5:00 PM - Commit 7: Documentation & Final Polish
**Message:** `docs: add technical documentation, roadmap, and final touches`
**Files to stage:**
- `Technical_docs_design.md`
- `client/remaining.md`
- `client/roadmap.md`
- `client/Technical_docs_design.md`
- Any other remaining modified files (`git add .`)

**Command to run:**
```bash
git add Technical_docs_design.md client/remaining.md client/roadmap.md client/Technical_docs_design.md
git add .
git commit -m "docs: add technical documentation, roadmap, and final touches"
```

---

### 💡 Pro-Tips for Hackathon Demo:
- **Don't use `git add .` until the very last step.**
- If you made changes to a file that belongs to a later commit, you can use `git add -p <file>` to stage only specific chunks of code, but the directory-based approach above is easier.
- Take a screenshot of the app working at the 3 PM and 5 PM marks to have proof of progress for your presentation!
