# AGENTS.md

## Project Development Rules

These rules apply to all AI agents working in this repository.

---

## 1. Work in Small Sequential Phases

All implementation, refactor, migration, and feature work must be split into small, sequential phases.

Each phase should:
- have one clear goal;
- change only a limited part of the project;
- be small enough for the user to manually test afterward;
- avoid bundling unrelated systems into the same phase;
- leave the project in a usable state whenever reasonably possible.

Do not implement multiple major systems at once unless the user explicitly asks for it.

---

## 2. Explain Before Implementing

Before starting each implementation phase, briefly explain:

1. what will change;
2. why this phase is needed;
3. what the user will be able to test after the phase is complete.

Keep this explanation short and simple.

Prefer analogy-based explanations.

Example style:

> This phase is like replacing the front door without rebuilding the whole house.  
> I will only rebuild the combat screen layout. Afterward, you can test whether the battlefield, buttons, and mobile layout feel correct.

Avoid long technical lectures unless the user asks for them.

---

## 3. Stop After Each Phase for User Testing

After completing one implementation phase:

- summarize what changed;
- list the exact files or areas changed;
- explain what the user should manually test;
- stop before starting the next implementation phase.

Do not automatically continue into the next major phase.

The user decides whether the phase passes manual testing.

If the user reports a problem:
- fix that problem within the current phase first;
- do not move forward until the user is satisfied or explicitly accepts the remaining issue.

---

## 4. The User Owns Gameplay / Acceptance Testing

The AI agent must not act as the final gameplay tester or acceptance tester.

The user will manually test:
- gameplay feel;
- UI feel;
- combat flow;
- balance;
- narrative experience;
- mobile usability;
- whether a phase is acceptable.

The AI may run appropriate engineering checks such as:
- build checks;
- type checks;
- lint;
- formatting;
- static analysis;
- directly relevant automated unit/integration tests.

But the AI must not claim:
- “gameplay is verified”;
- “the UI feels correct”;
- “the balance is good”;
- “the feature is accepted”;
- “manual testing passed”.

Only the user can make those judgments.

---

## 5. Never Skip the Manual-Test Boundary

When a phase is complete, do not immediately begin the next phase just because the code builds.

Always provide a manual test checklist and wait for the user's result before continuing to the next major phase.

Exception:
- very small fixes inside the same already-approved phase may be completed together when they directly fix the user's reported issue.

---

## 6. Keep Explanations Beginner-Friendly

Assume the user may not want deep implementation details every time.

When explaining changes:
- use plain Traditional Chinese when speaking to the user;
- use short sentences;
- use simple analogies;
- explain the visible result first;
- explain technical details only when useful.

Good example:

> Think of this as separating the referee from the storyteller.  
> The combat engine decides the numbers; the AI only describes what happened.

Bad example:

> We will refactor the event-driven combat pipeline into several polymorphic reducers with domain adapters...

unless the user specifically asks for that level of detail.

---

## 7. Canonical Design Documents Are Authoritative

Before implementing gameplay or UI behavior, read the current canonical documents.

At minimum, follow:
- `docs/development/CANONICAL_MANIFEST.md`
- `docs/development/OPEN_QUESTIONS.md`
- relevant gameplay/world documents for the feature being implemented.

Do not treat:
- old chat transcripts;
- old ZIP bundles;
- prototypes;
- stale duplicate files;
- placeholder values

as authoritative if they conflict with the canonical documents.

---

## 8. Do Not Invent Missing Game Rules

If a gameplay rule is explicitly unresolved:

- do not silently invent a permanent rule;
- do not write your own assumption back into canonical design docs;
- mark temporary engineering values clearly as placeholders/config;
- report the unresolved point to the user when it materially affects implementation.

For low-risk engineering details that do not change game design, make a reasonable implementation choice and continue.

---

## 9. Separate Rules, UI, AI Narration, and State

Maintain clear boundaries between:

- authoritative game/domain rules;
- persistent game state;
- frontend presentation/UI;
- animation/pacing;
- AI/LLM narration.

In combat especially:

> The system decides the result.  
> The AI narrates the result.

The LLM must not directly override authoritative combat state.

---

## 10. Preserve the User's Manual Development Workflow

The intended workflow is:

1. Agent explains the next small phase.
2. Agent implements only that phase.
3. Agent runs appropriate engineering checks.
4. Agent summarizes the change.
5. Agent gives the user a short manual test checklist.
6. User tests manually.
7. User reports pass/problems.
8. Agent fixes the current phase if needed.
9. Only after user acceptance does the next phase begin.

Follow this loop throughout the project.

---

## 11. Phase Completion Response Format

After each implementation phase, respond in this structure:

### What changed
A short summary.

### Simple explanation
A brief analogy explaining what was changed.

### What you can test now
A short checklist of manual tests for the user.

### Engineering checks
List only the automated checks actually run.

### Next phase
Name the next logical phase, but do not start it until the user approves the current phase.

---

## 12. Scope Discipline

Do not:
- redesign unrelated systems while implementing one phase;
- rewrite world lore without permission;
- change canonical game rules just to simplify code;
- introduce large framework migrations without a concrete need;
- bundle cleanup, redesign, backend migration, and new gameplay into one giant phase.

Prefer the smallest change that moves the project safely forward.

---

## 13. AI TRPG Project-Specific Reminder

This project is a browser-based AI TRPG with:
- authoritative RPG state and rules;
- AI-assisted narration;
- long-term memory/state;
- character progression;
- inventory/skills;
- NPC relationships;
- structured combat;
- responsive desktop/mobile UI.

The target is not a pure chatbot and not a purely graphical action game.

The game should remain:
- system-driven where rules must be reliable;
- AI-driven where narration, interpretation, and flexible story interaction are valuable.

---

## 14. Language and Terminology

When communicating with the user:
- **always use Traditional Chinese as the primary language and English only as a secondary/supporting language; Simplified Chinese is forbidden and must not appear in user-facing responses, implementation explanations, phase summaries, test instructions, or newly written project documentation unless the user explicitly provides Simplified Chinese text that must be quoted verbatim for a specific task;**
- use Traditional Chinese by default;
- keep explanations concise and practical;
- use analogy-based explanations when introducing a phase.

Project terminology:
- use `代行者`;
- do not replace it with `代理者`.

---

## 15. Final Rule

Do not optimize for finishing the whole project in one pass.

Optimize for:
- small safe phases;
- clear user testing points;
- easy rollback;
- easy debugging;
- preserving the user's control over design decisions.
