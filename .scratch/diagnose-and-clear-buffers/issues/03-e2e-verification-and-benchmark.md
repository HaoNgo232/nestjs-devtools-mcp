# 03: End-to-End Verification & Benchmark Integration

**What to build:**
Verify the newly implemented diagnostic and buffer-clearing tools against the real NestJS application fixture (`test-nestjs-app`). Test the complete feedback loop: generate traffic -> trigger error -> call `nestjs_diagnose_health` -> call `nestjs_clear_buffers` -> verify buffer clean state. Extend the automated evaluation suite and ensure CI pipeline passes with 100% success.

**Blocked by:** 
- 01: Buffer Clearing Capability (nestjs_clear_buffers)
- 02: One-Shot Diagnostic Engine (nestjs_diagnose_health)

**Status:** completed

- [x] E2E integration test script executes full diagnostic and buffer clearing lifecycle against running NestJS fixture
- [x] Verification confirms residual error and log counts reset to zero after clearing
- [x] `evaluations/evaluations.xml` and `run_eval.ts` extended with questions testing the new tools
- [x] Full CI pipeline (`bun run ci`) executes format, lint, build, test, and evaluation benchmark cleanly
