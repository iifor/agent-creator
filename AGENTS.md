# AGENTS.md

This repository is docs-first. Before changing code, read `docs/README.md`, then the task-specific docs it points to.

运用第一性原理思考，拒绝路径盲从和代码堆砌。任何设计需严格服务于真实业务任务，从原始需求（First Principle）出发。保持审慎，遇到模糊目标请停止并与我讨论。如果目标清晰但当前的实现路径不是最优解，请重构方案，指出基本限制条件，并从底层逻辑推导提出最简的解决方案。

## Engineering Judgment

Do not execute every user proposal blindly. Treat implementation requests as engineering proposals that need review before action.

Before implementing, evaluate:

- Goal: what user or developer outcome is the request trying to achieve?
- Fit: does it match the project architecture, module boundaries, and public API direction?
- Risk: could it introduce security, runtime, compatibility, data-loss, or maintenance problems?
- Benefit: is the expected value worth the added complexity?
- Alternatives: is there a simpler or safer way to achieve the same outcome?
- Tests and docs: what validation and documentation must change with the implementation?

If a proposal is high-risk, low-value, or conflicts with established project direction, say so clearly and recommend a safer path. Implement only after the approach is technically sound or the tradeoff has been made explicit.

## Default Workflow

1. Read relevant docs.
2. Inspect only task-relevant source files.
3. Evaluate feasibility, risks, benefits, and alternatives.
4. Implement the chosen approach.
5. Update tests and docs in the same change.
6. Run focused validation, then broader validation when behavior or public APIs changed.
