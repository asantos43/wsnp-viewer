# Contributing

## Workflow

- The repository is `asantos43/wsnp-viewer`. Work is split into the phases of
  [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md). **Each phase is developed on its own branch and delivered as its
  own pull request against `main`** (for example `phase-0-prototype`, `phase-1-mvp`). Nothing else is pushed to
  `main`, except documentation agreed beforehand.
- Commit messages start with a short summary line in the imperative ("Add …", "Fix …"), then explain why.
- A pull request is complete only with:
  1. **tests** for what it adds (unit, component, end-to-end, security, performance or packaging, as
     [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md), "Testing", says), passing on the three systems;
  2. its lines in **`CHANGELOG.md`**, under **Unreleased**;
  3. the **documentation** it affects (README, the user guide, and `VIEWER-GUIDELINES.md`,
     `ARCHITECTURE.md` or `PAGEKEEP-ZIP.md` if behaviour changed). The description of the format
     (`FORMAT.md`, `MANIFEST-SIGNING.md`) is not here: it lives in the
     [`wsnp-format`](https://github.com/asantos43/wsnp-format) repository, so a change to the format is a pull request there first.

## Before you push

```sh
npm run lint
npm run typecheck
npm test
npm run test:e2e
```

## Things to know

- The files in `tests/` (with an "s") are a reference for the WSNP format, copied from the PageKeep repository.
  They are not run and nothing depends on them. The viewer's own tests live next to the code (`*.test.ts`) and in `e2e/`.
- Test files are always synthetic (see `fixtures/`). Real captures come from private sites and are never committed.
- Code is TypeScript in ES modules, formatted like the code around it, and linted with oxlint.
