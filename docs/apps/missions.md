# Missions

- **Path:** `apps/missions`
- **Owner:** Experiences / Missions
- **Runtime:** Bun.serve, React 19, PostgreSQL/RLS; orchestrator is separate specialized Rust capability
- **Tenant model:** organization

## Purpose and actors

Missions lets humans propose, risk-assess, approve, observe and judge bounded agent missions while keeping reported activity distinct from accepted results. Requesters propose; approvers authorize; operators respond to blocks; agents/orchestrator report; reviewers issue final verdict.

## Journeys

1. **Propose/approve:** requester creates mission from accepted planning handoff, scope, risks, acceptance criteria and budgets; required approver accepts or refuses.
2. **Observe/intervene:** authorized mission starts through orchestrator, app projects attributable events, blockers and decision requests; operator may pause/cancel within policy.
3. **Review result:** agent reports artifact/evidence refs; human compares against criteria and accepts, rejects or abandons with reason.
4. **Audit/export:** authorized actor exports immutable MissionRecord and evidence references, not hidden chain-of-thought or secrets.

## Non-goals

- orchestrating processes/tools inside the web app ;
- agent marketplace/profile, general project management or autonomous approval ;
- equating event volume, agent status or claimed completion with success ;
- editing event history ;
- accepting handoff that grants execution rights.

## Domain protocol

**Commands:** `ProposeMission`, `AssessMissionRisk`, `ApproveMission`, `RefuseMission`, `StartMission`, `PauseMission`, `ResumeMission`, `CancelMission`, `RecordOrchestratorEvent`, `AnswerDecisionRequest`, `SubmitMissionResult`, `AcceptMissionResult`, `RejectMissionResult`, `AbandonMission`, `ExportMissionRecord`.

**Queries:** `GetMission`, `ListMissions`, `GetMissionEvents`, `GetOpenDecisionRequests`, `GetResultEvidence`, `GetApprovalHistory`, `GetMissionExport`.

**Events:** `MissionProposed`, `MissionRiskAssessed`, `MissionApproved`, `MissionRefused`, `MissionStarted`, `MissionBlocked`, `HumanDecisionRequested`, `MissionPaused`, `MissionCancelled`, `MissionResultSubmitted`, `MissionResultAccepted`, `MissionResultRejected`, `MissionAbandoned`.

State machine is fail-closed and revisioned. Only orchestrator adapter can report execution events; only human roles can approve mission or verdict. `result-submitted` is not terminal success.

## Refusal matrix

| Code | Refusal |
| --- | --- |
| `mission.spec_unaccepted` | referenced SpecPackage/handoff not accepted/verified |
| `mission.handoff_not_planning_only` | handoff contains execution capability |
| `mission.risk_unassessed` | approval/start requested before risk policy result |
| `mission.approval_required` | operation lacks required human approval |
| `mission.transition_forbidden` | state/actor cannot perform transition |
| `mission.revision_stale` | command targets stale aggregate revision |
| `mission.event_untrusted` | event source/token is not bound orchestrator instance |
| `mission.budget_exceeded` | time/tool/network/cost budget exceeded; mission blocks/stops |
| `mission.evidence_missing` | result lacks required artifact/evidence reference |
| `mission.tenant_mismatch` | mission/spec/event tenant differs |

Unknown event types are quarantined, never projected as success.

## Data

PostgreSQL owns mission aggregate, approvals, append-only events, decision requests, budgets and verdicts. Evidence/artifacts remain owned by Proof/Artifact and are referenced by digest. Orchestrator runtime state is not Missions authority. Retention follows ADR-0002 section 3. Migration source is accepted mission/handoff contracts and selected archived test fixtures; historical execution logs are not imported as trusted evidence.

## Authentication and authorization

Browser uses opaque session. Biscuit resources are `mission/<id>`, `mission/<id>/decision/<id>` and exact artifact/evidence refs. Authority includes user, mandatory tenant, `role(user, role)`, root token ID and an expiration check. Orchestrator tokens are attenuated to one mission and `report-event|submit-result`; they cannot approve or verdict. Human approver tokens cannot impersonate orchestrator. Token revocation and RLS are checked for each command.

## Runtime boundaries

TypeScript owns mission domain, human workflow, persistence and projection. WP-G2-S01 does not implement an orchestrator or harness. Any future Rust orchestration owns process/tool scheduling and budget enforcement only behind a separately approved execution-plan/control protocol, attenuated authorization and sandbox; it emits authorized protocol events without shared DB. Until that Specification Lock exists, Missions may use contract fixtures for UI/domain tests but cannot start a real mission or claim orchestrator integration.

## Accessibility and degraded mode

Timeline has ordered textual/table view, filters and live announcements that do not steal focus. Risk, block and verdict never rely on color. Orchestrator outage marks control status unknown and disables start/resume/accept based solely on stale report; audit/export remains. Database outage fails commands closed. Evidence outage allows viewing recorded refs but prevents acceptance when criterion requires retrieval.

## Contracts

- MissionRecord v1 — `contracts/schemas/mission-record.v1.schema.json` ;
- Agent Handoff v1 — `contracts/schemas/agent-handoff.v1.schema.json` ;
- Orchestrator Event v1 — `contracts/schemas/orchestrator-event.v1.schema.json` ;
- Evidence/Artifact refs — canonical schemas ;
- Missions API — `contracts/openapi/missions.v1.yaml` ;
- Biscuit policies — `contracts/authz/missions-v1.datalog`.

## Evidence

Unit tests exhaust every state/role transition, revisions and idempotency. Contract tests reject execution handoffs, forged/unknown events and hash mismatch. Integration runs simulated orchestrator, PostgreSQL RLS, revocation and budget stop. E2E covers propose/approve/block/decide/result/reject/accept/export. Security tests prove orchestrator cannot approve and user cannot report execution.

## Work packages

1. mission/handoff/event/authz contracts and transition table — Canonical Core ;
2. mission persistence/RLS/domain API — Experiences ;
3. orchestrator adapter and simulated event producer — Specialized Rust ;
4. human cockpit/accessibility — Experiences + Web Platform ;
5. Proof/Artifact verification integration — Specialized Rust ;
6. adversarial authorization/budget/replay qualification — Infrastructure and Release.

Domain/UI and orchestrator can proceed in parallel against protocol fixtures; integration starts only after transition/authz lock.

## Release and rollback

Release requires simulated and one bounded real mission with attributable approval, enforced budget, block/decision, evidence and human verdict; cross-tenant and role-confusion attacks must fail. Rollback first prevents new starts, preserves event ingestion compatibility and restores app/orchestrator pair. Event history and accepted deletion are never rewritten.
