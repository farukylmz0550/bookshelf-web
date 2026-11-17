# Bookshelf Architecture Principles

## Purpose

This document defines the architectural principles for Bookshelf.

Its purpose is not to force a specific framework architecture, directory structure, or abstraction pattern. Its purpose is to keep the codebase understandable, maintainable, predictable, and internally consistent as the project evolves.

Bookshelf currently uses TypeScript for the application and Rust for selected
native processing. New backend and server-side processing should prefer Rust
whenever technically practical, while TypeScript remains appropriate for UI,
framework integration, and cases where a Rust implementation would reduce
maintainability or platform support. This policy is incremental and does not
authorize an unscoped rewrite of working backend code.

These principles are written around responsibilities and boundaries rather
than around a particular frontend framework or backend language.

---

## 1. Single Responsibility

Every file, module, component, function, and service should have one clear primary responsibility.

A file should not gradually become a general-purpose container for unrelated behavior simply because it is convenient.

This does **not** mean that every small piece of code must have its own file. Splitting code is justified when responsibilities, reasons for change, or ownership genuinely differ.

> One unit should have one clear reason to change.

---

## 2. Separation of Concerns

Different concerns should remain separate when they have different responsibilities.

In particular, keep these concerns distinct where practical:

- UI presentation
- user interaction
- application logic
- domain rules
- data access
- external integrations
- authentication and authorization
- localization
- platform-specific behavior
- persistent storage

A UI component should not become a database client. A data-access module should not know how the UI looks.

---

## 3. One File Should Not Do Another File's Job

A module should perform its own responsibility instead of silently taking over responsibilities belonging elsewhere.

For example:

```text
Book Card
→ presents a book and handles book-related UI interaction

Book Logic
→ handles rules and operations related to books

Data Access
→ retrieves and persists book data

Haptics
→ provides platform-specific haptic feedback
```

A book card should not parse Excel files.

A haptics module should not contain lending rules.

A data-access module should not render UI.

Clear boundaries make the code easier to understand and safer to change.

---

## 4. Preserve the Existing Project Architecture

Bookshelf already has an established project structure and working feature set.

New work should build on that structure instead of replacing it without a clear reason.

Do not introduce a completely different architecture merely because another pattern is fashionable, familiar, or technically interesting.

Before restructuring an existing area:

1. Understand why the current structure exists.
2. Identify the actual problem.
3. Make the smallest architectural change that solves that problem.
4. Preserve unrelated working behavior.

---

## 5. Architecture Should Follow the Project, Not the Other Way Around

Architecture exists to serve Bookshelf.

The project should not become unnecessarily complicated just to satisfy an abstract architectural pattern.

Avoid adding:

- unnecessary layers
- unnecessary factories
- unnecessary providers
- unnecessary managers
- unnecessary generic abstractions
- unnecessary state systems
- unnecessary dependencies

unless there is a concrete problem they solve.

> Architecture should reduce complexity, not rename it.

---

## 6. Avoid Premature Abstraction

Do not create a generic abstraction merely because something *might* be reusable in the future.

Prefer a clear, concrete implementation until a genuine shared need exists.

When duplication becomes real and meaningful, extract the common behavior.

Do not optimize for hypothetical reuse at the cost of present-day readability.

---

## 7. Reuse Real Shared Logic

When multiple parts of the application genuinely depend on the same rule or behavior, keep that logic in one authoritative place.

Examples include:

- validation rules
- data transformations
- formatting rules
- permission checks
- shared domain logic
- common platform behavior

Do not copy the same rule into several components and hope they remain synchronized.

> One rule should have one authoritative implementation.

---

## 8. Keep Feature Boundaries Clear

Major features should be as independent as reasonably possible.

Examples include:

```text
Books
Lending
Statistics
Achievements
Leaderboard
Goals
Profiles
Administration
```

A change inside the internal implementation of one feature should not require unrelated changes throughout the application.

Features may communicate when necessary, but their dependencies should be explicit and justified.

---

## 9. Use Explicit Interfaces Between Responsibilities

When one module needs another module, the relationship should be visible and understandable.

Avoid hidden dependencies and accidental coupling.

Prefer:

```text
Module A
   ↓
clear interface / function / contract
   ↓
Module B
```

over:

```text
Module A
   ↓
reaches into Module B's internal implementation
```

Internal implementation details should remain internal.

---

## 10. Keep Data Logic Separate From UI Logic

UI code should focus on presenting information and responding to user actions.

Data-related code should handle things such as:

- fetching
- storing
- transforming
- validating external data
- communicating with APIs or persistence layers

The UI should not need to know the implementation details of storage or external services.

Likewise, data-access code should not contain visual decisions.

---

## 11. Keep Platform-Specific Behavior Isolated

Bookshelf supports behavior that may differ depending on device or platform.

Examples include:

- haptic feedback
- touch gestures
- long-press behavior
- responsive navigation
- keyboard interaction
- installation or PWA behavior

Platform-specific details should be isolated behind clear boundaries whenever practical.

The rest of the application should not need to know the low-level implementation details of those behaviors.

---

## 12. Gestures Are Enhancements, Not Requirements

Touch gestures can improve the experience, but essential functionality must not depend exclusively on hidden gestures.

For example:

```text
Desktop:
Hover → contextual actions

Touch:
Long press → contextual actions
```

A long press may be a convenient shortcut, but important actions such as editing or deleting should remain discoverable through visible UI as well.

> A shortcut may be hidden. A required action should not be.

---

## 13. Preserve Existing Behavior During Refactoring

Refactoring and architectural cleanup should preserve existing product behavior unless a behavior change is intentional.

Existing functionality should not disappear merely because the code implementing it is being reorganized.

Before removing or changing behavior, determine:

- whether it is currently used
- whether another feature depends on it
- whether it is part of the expected product behavior
- whether the change is actually required

---

## 14. Refactoring Is Not Automatically Redesign

A code rewrite is not permission to redesign unrelated parts of the product.

Separate these questions:

> Is the implementation poorly structured?

and:

> Should the product behavior change?

They are not the same question.

A cleaner implementation should still preserve intended product behavior unless a change has been deliberately decided.

---

## 15. Keep Dependencies Minimal

A new dependency should have a concrete reason to exist.

Before adding one, ask:

> Can the existing platform or current project dependencies solve this adequately?

Avoid adding libraries for trivial tasks that can be handled cleanly with the existing stack.

Fewer dependencies generally mean fewer moving parts, but dependency count should never be reduced at the expense of clear, reliable code.

---

## 16. Prefer Readability Over Cleverness

Readable code is more valuable than code that is merely short, clever, or impressive.

Prefer:

```text
clear naming
straightforward control flow
small focused functions
predictable behavior
```

over:

```text
dense one-liners
hidden side effects
unnecessary metaprogramming
clever indirection
```

The code should be understandable by someone returning to it months later.

---

## 17. Make Assumptions Explicit

Modules should not silently rely on assumptions that can become invalid.

Validate data at appropriate boundaries.

Examples:

- API responses
- user input
- imported files
- persisted data
- route parameters
- optional configuration

Do not spread unchecked assumptions throughout the application.

---

## 18. Error Handling Should Respect Boundaries

The place where an error occurs and the place where it is presented to the user do not necessarily have the same responsibility.

For example:

```text
Data layer
→ detects and reports a failed operation

Application layer
→ decides what the failure means

UI
→ communicates the problem clearly to the user
```

Error messages shown to users should be understandable and contextual rather than raw implementation details.

---

## 19. Do Not Create a Global "Everything" Module

Avoid files such as:

```text
utils.ts
helpers.ts
manager.ts
common.ts
misc.ts
```

becoming dumping grounds for unrelated functionality.

A shared module should have a clear reason to exist and a clearly defined scope.

If a file contains unrelated logic simply because several places can import it, its responsibilities should be reconsidered.

---

## 20. Do Not Split Files Merely Because They Are Large

File size alone is not enough justification for splitting a file.

A large file may still represent one coherent responsibility.

Split it when:

- responsibilities are genuinely different
- parts change for different reasons
- ownership becomes unclear
- independent reuse is useful
- testing becomes meaningfully easier

The goal is clear responsibility, not a large file count.

---

## 21. Do Not Merge Files Merely Because They Are Related

Related code does not automatically belong in the same file.

Two pieces of code may operate on the same feature while still having different responsibilities and reasons for change.

A useful question is:

> Would these two pieces normally need to change for the same reason?

If not, separation may be appropriate.

---

## 22. Avoid Unnecessary Global State

Global state should exist only when information genuinely needs application-wide ownership.

Do not make data global simply because global access is convenient.

Prefer local ownership when possible.

When state must be shared, the ownership and update path should remain clear.

---

## 23. Keep Security and Permissions Near Their Source of Truth

Authentication, authorization, and permission decisions should not be duplicated arbitrarily throughout the UI.

The UI may reflect permissions, but security-critical decisions must be enforced at the appropriate application or server boundary.

Do not treat a hidden button as authorization.

---

## 24. Localization Must Remain a First-Class Concern

Bookshelf supports multiple languages.

User-facing strings should not be scattered through the codebase in a way that makes translation inconsistent or difficult.

New features should follow the existing localization mechanism instead of inventing feature-specific translation systems.

Do not move product text into code constants merely for convenience when it should remain translatable.

---

## 25. Accessibility Is Part of Correctness

Accessibility is not a visual polish step added at the end.

Interactive functionality should account for:

- keyboard access
- focus visibility
- appropriate touch target sizes
- semantic labeling
- sufficient contrast
- reduced-motion preferences where relevant

A feature that works only for one input method is incomplete.

---

## 26. Performance Should Be Evidence-Driven

Do not add complexity for performance without evidence that the complexity is necessary.

Prefer:

```text
correctness
→ clear architecture
→ measurement
→ targeted optimization
```

Avoid speculative caching, premature memoization, unnecessary abstraction, or complicated state systems without a demonstrated need.

---

## 27. Keep Business Rules Independent From Presentation

Business rules should remain valid even if the visual presentation changes.

For example:

- whether a book may be lent
- how a lending operation is validated
- how permissions are determined
- how imported data is interpreted

should not depend on whether the user is viewing a card, table, mobile layout, or desktop layout.

> Business rules describe what the application does, not what the interface looks like.

---

## 28. Make Changes Incrementally

Prefer small, understandable changes over massive rewrites when the existing implementation is already functional.

When a larger rewrite is genuinely needed:

1. Identify the existing responsibilities.
2. Preserve working behavior.
3. Move one responsibility at a time.
4. Verify the result.
5. Continue only after the previous boundary is stable.

This makes regressions easier to identify and easier to fix.

---

## 29. Remove Dead Code Instead of Preserving It Forever

When a feature or implementation is genuinely obsolete, remove it rather than leaving unused layers behind "just in case."

However, code should only be considered dead after its usage and dependencies have been verified.

Do not delete code based on appearance alone.

---

## 30. Favor the Simplest Correct Architecture

When several architectures can solve the same problem, prefer the one that:

- has fewer unnecessary moving parts
- has clearer responsibilities
- is easier to understand
- is easier to test
- is easier to change
- fits the existing Bookshelf structure

The goal is not the most sophisticated architecture.

The goal is an architecture that remains understandable as Bookshelf grows.

---

# Core Philosophy

All principles in this document can be reduced to one idea:

> **Every part of Bookshelf should do its own job as well as possible without unnecessarily doing another part's job.**

And two supporting rules:

> **Architecture should reduce complexity, not disguise it.**

> **The project should serve the architecture, not the other way around.**

When making an architectural decision, prefer the solution that keeps responsibilities clear, dependencies understandable, and the overall system as simple as the project's real requirements allow.
