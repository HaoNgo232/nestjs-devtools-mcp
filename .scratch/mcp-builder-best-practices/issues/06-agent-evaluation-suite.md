# 06: Agent Evaluation Suite (Phase 4 Benchmark)

**What to build:**
Create an automated evaluation benchmark containing 10 realistic, read-only question-and-answer pairs defined in an XML evaluation file, along with an evaluation runner script. The suite assesses whether an AI agent can effectively use the MCP server tools to inspect, diagnose, and reason about a running NestJS target application.

**Blocked by:** 
- 02: Standardize Discovery & Runtime Tools (nestjs_discover_servers)
- 03: Modernize Routes and Configuration Inspection Tools
- 04: Paginated Observability Tools (nestjs_get_logs, nestjs_get_request_history, nestjs_get_errors)

**Status:** completed

- [x] 10 realistic, verifiable, independent evaluation questions created and documented in XML format
- [x] Questions require multiple tool calls and non-trivial exploration of the test application
- [x] Every question verified against the provided test NestJS application
- [x] Evaluation runner script implemented to execute questions and measure accuracy against ground truth
- [x] Benchmark documentation and run instructions added to the project
