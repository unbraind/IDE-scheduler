# DSPy + GEPA Guide (Experimental)

This extension includes an experimental bridge to [DSPy](https://dspy.ai/) so you can optimize coding prompts for Agent Scheduler’s modes or downstream tools.

Key terms
- DSPy: a framework for declarative LLM programs with optimizers for instructions/demos.
- MIPROv2: DSPy’s general optimizer that jointly tunes instructions and few-shot demos via (Bayesian) search.
- GEPA: a genetic‑Pareto prompt optimizer using reflective evolution over language traces; often strong with few model calls.

How to use
1) Prepare a tiny JSONL dataset of input/output pairs for your coding prompts.
2) Run “AgentScheduler: DSPy Optimize Coding Prompt”.
3) Choose optimizer: `mipro` or `gepa`.
4) Pick dataset and output file; the optimized instruction prompt opens in the editor.

Settings
- `agent-scheduler.experimental.dspy.enabled`: Master toggle (UI optional).
- `agent-scheduler.experimental.dspy.pythonPath`: Python path with DSPy installed.
- `agent-scheduler.experimental.dspy.optimizer`: Default optimizer.
- `agent-scheduler.experimental.dspy.model`: Default model id (passed to DSPy when supported).

Implementation
- Script: `scripts/dspy_optimize.py`
  - Loads JSONL examples.
  - Builds a tiny DSPy program for coding instructions.
  - Compiles with MIPROv2 or GEPA.
  - Saves a concise instruction string.

Notes
- Bring your own LLM credentials (e.g., OpenAI env vars) per DSPy’s docs.
- This is intentionally minimal; heavy runs and richer metrics will be added on request.

