# Astra Prompt — Rewrite the AI TRPG Website

You are working inside my existing AI TRPG repository.

I want you to **rebuild the website implementation cleanly**, using the current project as engineering context but treating the canonical design documents as the product source of truth.

This is a private browser-based AI TRPG for me and friends. It is not a conventional graphical action game. The core experience is text/story-driven exploration with real RPG state, rules, memory, characters, inventory, combat and AI narration.

## 0. Read before changing code

First read:

1. `AGENTS.md`
2. `docs/development/CANONICAL_MANIFEST.md`
3. `docs/development/OPEN_QUESTIONS.md`
4. `docs/gameplay/character_system.md`
5. `docs/gameplay/magic.md`
6. `docs/gameplay/combat_system.md`
7. `docs/gameplay/combat_ui.md`
8. `docs/world/races.md`
9. Relevant existing world/lore documents already in the repository

Inspect the existing codebase before choosing an implementation.

Do not treat old chat transcripts, old ZIP bundles or combat UI prototype HTML files as source-of-truth.

## 1. Important autonomy rule

Do not invent missing lore or missing game rules.

If the documents explicitly mark something unresolved:
- keep it unresolved;
- isolate any temporary engineering placeholder behind a clearly named config/constant;
- do not write the placeholder back into design docs as if it were canon.

For low-risk implementation details that do not change gameplay or lore, make a reasonable engineering choice and continue.

## 2. Rewrite goal

I want a clean, maintainable production website implementation.

You may replace poor frontend structure rather than preserving it for its own sake, but:
- inspect the current backend/API/data contracts first;
- preserve working backend behavior and persistence contracts unless there is a concrete reason to change them;
- do not migrate frameworks or replace major infrastructure just because another stack is fashionable;
- keep game rules separate from rendering and LLM narration;
- keep authoritative game state separate from purely presentational UI state.

The final architecture must make it difficult for AI narration to accidentally overwrite authoritative combat/game values.

## 3. Product identity

The game is an original dark high-fantasy AI TRPG.

Tone:
- post-collapse medieval fantasy;
- ruins of an ancient magical civilization;
- gods, divine agents (代行者), dragons, dangerous exploration;
- magic has declined;
- death can matter;
- adventurous and heroic, but the world is dangerous.

Do not copy D&D, Diablo, Pokémon, Blade/刀鋒 or any other game's copyrighted visual assets, names, exact UI design or proprietary content.

They are references for product concepts only.

## 4. Combat architecture: system decides, AI narrates

During combat:

**All mechanical outcomes are system-authoritative.**

The system decides:
- initiative;
- attack rolls;
- evasion rolls;
- legal targets;
- damage;
- armor;
- HP/MP;
- cooldowns;
- row position;
- item use;
- escape;
- dying/death;
- battle rewards.

The AI/LLM receives the already-determined result and narrates it.

Example:
If the engine says an enemy has 15 HP remaining, narration must not claim the enemy was decapitated and killed.

Build the code so this separation is explicit.

## 5. Combat screen layout — preserve this structure, not prototype code

Do **not** copy `combat_ui_prototype*.html`.

I only want you to preserve the layout and interaction intent described below and in `combat_ui.md`.

Create your own production-quality component structure, CSS/design system and implementation.

### Desktop header

Top bar:
- game/combat title on the left;
- action-order carousel on the right;
- Round indicator immediately to the right of the action-order carousel.

The action order must never overlap the title.

### Action-order carousel

This is not plain text.

Use compact participant chips/cards.

Behavior:
- current actor is visually highlighted;
- after that actor finishes, their chip visibly slides/moves to the end;
- the next actor becomes first;
- the battlefield should also make the currently acting unit subtly identifiable;
- transitions should feel alive but not flashy.

### Battlefield

Left side of the main desktop combat screen.

Vertical order:

1. Enemy back row
2. Enemy front row
3. visual frontline divider
4. Ally front row
5. Ally back row

This is intentional: the two front rows should visually face one another.

Use compact unit cards, not huge panels.

Enemy cards must show:
- numeric target ID (#1, #2, ...);
- name;
- race;
- level;
- front/back position;
- exact current/max HP;
- HP bar.

When the player changes row, the player's unit card must physically move between the ally front/back sections.

Below the battlefield, keep compact areas for:
- authoritative system roll/result log;
- current-turn information.

### Right-side combat column

From top to bottom:

1. AI combat narration
2. Player status
3. Up to 6 equipped active-skill buttons
4. Basic command controls

On a normal desktop/laptop viewport, the player should not need to scroll down just to reach the basic combat commands.

### Basic commands

Always provide:

- Attack
- Defend
- Bag
- Party
- Position
- Run

These are separate from the six equipped active-skill slots.

Interaction:
- opening Bag does not consume a turn;
- actually using an item does;
- opening Party does not consume a turn;
- Party lets the player inspect companions and set high-level semi-autonomous combat behavior;
- Position changes front/back row and consumes the main action only when an actual move happens;
- Run uses the authoritative escape rule;
- Defend reduces damage, but use the canonical document / unresolved config for the exact reduction instead of copying the Prototype's temporary 30%.

### Skills

Show up to six equipped active skills.

Clearly communicate:
- name;
- MP cost where relevant;
- cooldown/unavailable status.

Unavailable buttons should visibly disable rather than failing only after click.

### AoE

Do not implement a grid.

AoE chooses:
- enemy front row, or
- enemy back row.

Then resolve attack/evasion per target according to `combat_system.md`.

## 6. Combat pacing

Non-player combatants must not take all actions instantaneously.

When a companion or enemy acts:
1. highlight them in turn order and battlefield;
2. give a short perceptible pause;
3. resolve authoritative mechanics;
4. show the narration/result;
5. pause briefly again;
6. animate/move their order chip to the back;
7. continue to the next actor.

Make timing configurable rather than embedding it as a gameplay rule.

The purpose is readability: the player should be able to understand one action at a time instead of receiving many lines at once.

## 7. Companion control

Companions are **semi-autonomous**.

The player does not manually choose every companion's action every turn.

The player can set high-level combat preferences/tactics, while the system chooses the actual action from available abilities and current state.

Do not assume the temporary Prototype labels are final canon unless an existing canonical document later defines them.

Design this so tactic presets can be changed or expanded without rewriting combat logic.

## 8. Visual direction

The desired visual language is:

> original dark-fantasy RPG / dark ARPG HUD

Aim for:
- blackened iron;
- charcoal/near-black surfaces;
- muted dark crimson;
- aged gold/bronze accents;
- restrained leather/parchment texture cues;
- subtle medieval/gothic typography;
- compact information density;
- thin ornamental/metal borders;
- understated hover/active animations.

Avoid:
- generic modern SaaS dashboard appearance;
- bright neon gaming UI;
- giant cards with excessive whitespace;
- direct copies of Diablo UI;
- copyrighted game assets.

You are encouraged to make it more polished than the prototype.

Do not use `ASHEN CHRONICLE` as the actual game title unless that name is independently present in the real project; it was prototype filler text.

## 9. Mobile requirements

The real website must work as a normal mobile webpage in current Safari and Chrome.

Do not simply scale the desktop layout down.

Use a responsive layout.

On narrow screens:
- compact/sticky top header is acceptable;
- action-order chips should support horizontal scrolling;
- battlefield unit cards can use a compact two-column layout;
- narration, player status, skills and commands should preserve a clear hierarchy;
- the six basic commands should remain touch-friendly (for example a 3×2 grid);
- modals/panels must fit the viewport;
- avoid fixed desktop heights that clip characters or make controls inaccessible.

Do not design around iOS Quick Look/file preview. The production target is an actual served webpage.

## 10. Outside combat

Do not turn the entire game into the combat HUD.

Outside combat, preserve the text-first AI TRPG experience and existing functional game panels.

Apply the same dark-fantasy visual system consistently, but do not invent new screen layouts or game mechanics that are not defined by the project.

The long-term product is:
- story / AI narration;
- player text input and contextual choices;
- real character state;
- inventory;
- skills;
- NPC relationships;
- events/quests;
- memory/state;
- combat.

## 11. Engineering requirements

Keep responsibilities separated, for example:
- domain/game rules;
- authoritative combat engine;
- combat state;
- UI components;
- animation/pacing state;
- LLM narration adapter;
- persistence/API layer.

Do not make React/UI components the authority for combat rules if the existing architecture has or should have an engine/domain layer.

Do not let the LLM emit arbitrary direct state mutations that bypass validation.

Prefer typed data contracts and deterministic testable rule functions.

## 12. Development process

Follow `AGENTS.md`.

In particular:
- split the rewrite into small sequential phases;
- before each implementation phase, explain in very simple language what will change and what I can manually test afterward;
- I perform gameplay/acceptance testing;
- you may run appropriate build, lint, static checks and directly relevant automated engineering tests, but do not claim gameplay acceptance on my behalf;
- do not silently redesign world lore.

Start by inspecting the repository and identifying:
- current frontend stack;
- combat-related code;
- existing API/state contracts;
- components that can be kept;
- components that should be replaced;
- risk areas.

Then produce the smallest sensible rewrite phases and begin implementation within the authorized scope.

## 13. Definition of success

The rewrite succeeds when:

- the website still behaves as an AI TRPG rather than a static mockup;
- combat is system-authoritative;
- combat layout matches `combat_ui.md`;
- action order visibly rotates after each action;
- NPC/companion actions are readable one at a time;
- desktop primary combat controls fit without constant vertical scrolling;
- mobile Safari/Chrome layouts are usable;
- player row changes are visually reflected on the battlefield;
- enemy target information is clear;
- the UI feels like an original dark fantasy RPG instead of a generic dashboard;
- unresolved game rules remain explicitly unresolved rather than being invented.
