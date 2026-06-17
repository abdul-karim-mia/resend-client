# Contributing to resend-client

Thank you for your interest in contributing! Here's how to get started.

## Development Setup

1. Fork and clone the repository
2. Follow the [Quick Start](README.md#quick-start) guide
3. Create a feature branch: `git checkout -b feat/your-feature`

## Pull Request Guidelines

- Keep PRs focused — one feature or fix per PR
- Add a clear description of what changed and why
- Ensure `pnpm build` passes before submitting

## Reporting Issues

Use the GitHub issue templates for:
- **Bug reports** — include steps to reproduce, expected vs actual behavior
- **Feature requests** — describe the use case

## Code Style

- TypeScript strict mode — no `any` types
- Follow existing patterns in `worker/src/routes/` for new API routes
- Frontend components live in `frontend/src/components/`

## Security Issues

Please **do not** open public issues for security vulnerabilities.  
Email the maintainer directly instead.
