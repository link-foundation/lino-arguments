---
'lino-arguments': patch
---

fix: add repository field to package.json for npm trusted publishing

This fixes the E422 error when publishing with npm trusted publishing (OIDC).
npm provenance verification requires the repository.url in package.json to match
the Source Repository URI in the signing certificate. Without this field, the
validation fails with "repository.url is '', expected to match 'https://github.com/link-foundation/lino-arguments'".
