---
'lino-arguments': patch
---

Validate environment aliases only when read, so unrelated duplicate proxy or npm variables no longer prevent makeConfig from starting. Preserve ambiguity errors for requested keys and strict validation of configuration and .lenv sources.
