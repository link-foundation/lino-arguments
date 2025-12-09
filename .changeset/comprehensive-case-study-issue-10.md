---
'lino-arguments': patch
---

docs: add comprehensive case study for issue #10 trusted publishing analysis

This PR provides detailed documentation and analysis for Issue #10, which covered npm trusted publishing failures in our CI/CD pipeline.

**Documentation added:**
- Comprehensive analysis of E422 error (missing repository field) - RESOLVED
- Detailed investigation of E404 error with manual workflow_dispatch triggers
- Comparison of authentication strategies (NPM_TOKEN vs OIDC)
- Workflow comparison with test-anywhere reference repository
- Evidence-based findings from online research
- Complete CI logs preserved in ci-logs/ directory
- Timeline reconstruction and root cause analysis
- Proposed solutions with trade-off analysis

**Key findings:**
1. E422 error was caused by missing `repository` field in package.json - fixed in PR #11
2. E404 error for manual releases is likely due to OIDC/Trusted Publisher configuration mismatch with workflow_dispatch triggers
3. test-anywhere uses NPM_TOKEN authentication which works reliably for all trigger types
4. Multiple solution options proposed (NPM_TOKEN fallback, Trusted Publisher config, unified workflows, etc.)

This documentation serves as a valuable reference for future npm publishing issues and OIDC troubleshooting.

Related: Issue #10, PR #11
