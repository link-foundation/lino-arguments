---
'lino-arguments': patch
---

Replace custom getenv implementation with official npm package. Now uses the robust `getenv` package for type casting and validation, enhanced with case-insensitive lookup across multiple naming conventions. Also enforces stricter no-unused-vars linting with catch { } syntax.
