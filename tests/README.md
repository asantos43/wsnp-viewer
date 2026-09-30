# tests/

These scripts (`wsnp-check.mjs`, `wsnp-crypt.mjs`, `wsnp.mjs`, `zip.js`) were copied from the PageKeep repository
to show how the WSNP format ([`../docs/FORMAT.md`](../docs/FORMAT.md)) is validated, encrypted and packed.

**They are a reference for the format only.** Read them like a specification; they are not run, they are not
this project's tests, and nothing here depends on them. The viewer's own tests are `*.test.ts` files next to
the code and the Playwright tests in [`../e2e/`](../e2e/).
