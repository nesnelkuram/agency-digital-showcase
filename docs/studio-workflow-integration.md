# Studio workflow integration — 2026-10-06

This change connects the existing workflow form to the authenticated server completion path. It does not implement the full VoicePack or brand-language engines described in `marka-dili-motoru.md` and `metin-uretici-motoru.md`.

## Implemented vertical flow

1. A human submits the configured step form. Required fields and values are validated again on the server. Tenant, project access, step assignment/reviewer role, workflow status and template version are checked.
2. The server captures production-relevant operational brief and brand-character context from the project's lead. Contact/access fields and share tokens are excluded. The source IDs, update times, copied content and content hash remain attached to the workflow; later source edits do not silently change an ongoing run.
3. A transaction completes the human step, writes its output under `context.step_<nodeId>` and claims each newly ready AI step with a unique execution ID. Repeated submissions cannot start a second generation.
4. The existing Gemini workflow provider is called and awaited. Its resolved prompt/configuration and context are stored in the execution's `ai_outputs` record. Missing mapped/required input blocks generation instead of disappearing from the prompt.
5. Successful output always stops at `ai_review` on this path. The drawer offers approval or rejection with a reason. Approval is bound to the current execution ID; only approved output enters downstream context.
6. Rejection records the reason and stops progression. An explicit retry creates a new execution, includes that output's feedback, and requires a fresh human review. It does not rewrite the brand's permanent rules.

## Scope and limits

- The tested slice is a human brief step → AI step → human review → next human step/end, including parallel ready AI steps. Conditional edges and subprocess nodes stop with an explicit `blockedReason`; they are not silently treated as ordinary links. Full graph parity is a separate phase.
- The context snapshot is a migration step, not a published, approved VoicePack. It does not provide fact verification, semantic quality scoring, immutable template history, MDD publishing, provider selection or automatic social publishing.
- The existing field-presence heuristic is not creative quality. Human review is mandatory in this path, regardless of that score.
- Existing workflows start through their existing entry points. Automatic execution of a first AI node without a preceding submitted human step is outside this change.
- No background durable queue is added. Claimed work is awaited by the server request; infrastructure interruption still needs operational recovery. Provider/configuration failures stop downstream progression.
- Brief snapshots are stored in `runtime_state/brief`, which has no client grant in the repository's Firestore rules. The visible `context.workflowBrief` is only a mirror and is not trusted on later requests. Existing broad client write access to workflow instances is unchanged; these endpoint checks do not constitute a complete rules/security migration.
- Main application routes remain `/admin/workflows/instance/:id` and `/admin/projects/:projectId/workflow/:instanceId`.

## Validation

- `vitest run tests/workflowRuntime.test.ts tests/workflowApi.test.ts tests/workflowStepForm.test.tsx tests/studioPostDetail.test.tsx tests/studioCalendarBoard.test.tsx tests/approvalEngine.test.ts tests/contentPlanAccess.test.ts`
- Runtime tests replace Firestore with a transactional in-memory store and replace the model provider. They do not contact Firebase, Gemini or customers.
- Vite production compilation and both changed API bundles were checked in an isolated source copy. Public asset copying was disabled for that compilation only.
- The repository has no configured lint command. Global TypeScript checking has pre-existing errors (React default-import configuration, media types and workflow type definitions). A targeted check reports no diagnostics in the changed files, but still fails in their existing dependencies.

No credentials, real generation, customer notifications, deployment or push are part of this change.
