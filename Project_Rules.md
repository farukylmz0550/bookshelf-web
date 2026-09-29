# Bookshelf Project Rules

## Purpose

This document defines the project-level rules that should be followed when modifying, extending, refactoring, or redesigning Bookshelf.

These rules complement:

- `CONTRIBUTING.md` for development and coding rules
- `Architecture_Principles.md` for architectural responsibilities and boundaries
- `UI_Design_Language.md` for the visual and interaction language

The purpose of this document is to preserve the integrity of the existing project while allowing Bookshelf to evolve in a controlled and maintainable way.

**Git integrity rule:** every commit and tag must be signed (SSH or GPG; see
`CONTRIBUTING.md → Commit Signing`). Unsigned commits and unsigned release
tags are not accepted into `main`.

**Docker image rule:** release Docker images are **always built locally** and
pushed to GHCR from the developer machine (`docker build` + `docker push`).
CI/CD must not build or publish images — the `Docker Publish` workflow was
removed (v3.11.0) because local builds are the single source of truth.
Publishing flow:

```bash
docker build -t ghcr.io/farukylmz0550/bookshelf:{version} -t ghcr.io/farukylmz0550/bookshelf:latest .
docker push ghcr.io/farukylmz0550/bookshelf:{version}
docker push ghcr.io/farukylmz0550/bookshelf:latest
```

Both the version tag and `latest` are pushed; `docker-compose.yml` pulls from
GHCR and `build: .` stays only as a source-build fallback.

**Push → delete rule:** as soon as a locally built image is pushed to GHCR,
the local image copy is **deleted** (`docker rmi`). GHCR is the single source
of truth for release images — the local Docker store never keeps image
backups after publishing. Verification happens against GHCR
(`docker manifest inspect`) before the local copy is removed.

---

## 1. Respect the Existing Technology Stack

The existing Bookshelf technology stack is the baseline.

Do not replace or migrate the framework, programming language, build system, ORM, database, or major dependencies unless there is an explicit requirement or a clearly demonstrated technical need.

A technology must not be replaced merely because it is:

- newer
- more popular
- personally preferred
- fashionable

Existing technical decisions should be understood before they are replaced.

---

## 2. Preserve Existing Functionality

Existing working functionality must be preserved during refactoring, redesign, and feature development unless a change has been explicitly requested.

Do not:

- remove working features without justification
- disable functionality to simplify implementation
- silently change established behavior
- replace working behavior with an incomplete approximation

A visual redesign must not accidentally become a product rewrite.

---

## 3. Understand Before Modifying

Before modifying an existing system:

1. Inspect the relevant implementation.
2. Understand its current responsibility.
3. Identify its dependencies.
4. Identify related features.
5. Determine which behavior must remain unchanged.
6. Only then implement the requested change.

Do not rewrite unfamiliar code based on assumptions.

---

## 4. Follow Existing Project Conventions

When the repository already defines a convention, follow it.

`CONTRIBUTING.md`, `tsconfig.json`, ESLint configuration, Prettier configuration, test configuration, package configuration, and other authoritative project files take precedence over newly invented conventions.

Do not create competing standards for the same concern.

---

## 5. Do Not Replace Existing Architecture Without a Problem

A different architecture is not automatically a better architecture.

Before replacing an existing structure, identify the concrete problem that the replacement solves.

Valid reasons for architectural change may include:

- responsibility boundaries
- maintainability
- correctness
- security
- testability
- performance
- scalability
- developer experience

“Cleaner to me” is not sufficient justification.

---

## 6. Improve the Existing Architecture

When architectural improvements are needed, prefer improving the existing project structure rather than creating an unrelated architecture beside it.

The existing areas of the project should remain conceptually meaningful, including:

```text
src/app/
src/components/
src/lib/
src/i18n/
src/types/
```

New boundaries may be introduced when they solve a real responsibility or dependency problem.

Do not reorganize files solely to make the directory tree look cleaner.

---

## 7. Respect Module Responsibilities

Each file or module should have a clear responsibility.

For example:

```text
UI module
→ presents information and handles UI interaction

Domain logic
→ implements application rules

Data access
→ retrieves and persists data

Integration
→ communicates with external systems

Platform layer
→ handles platform-specific behavior
```

A module should not gradually become responsible for unrelated concerns.

---

## 8. Do Not Duplicate Existing Systems

Before creating a new implementation, check whether Bookshelf already has an appropriate solution.

Do not unnecessarily create duplicate:

- validation systems
- localization systems
- theme systems
- data-access layers
- state mechanisms
- notification systems
- UI primitives
- utilities
- authentication logic

Existing mechanisms should be reused when they are appropriate.

---

## 9. Avoid Premature Abstraction

Do not introduce generic abstractions based only on hypothetical future reuse.

A solution should first be clear and correct.

When genuine repetition or a shared responsibility emerges, extract the common behavior.

Do not turn simple code into a framework inside the framework.

---

## 10. Avoid Under-Engineering as Well as Over-Engineering

Bookshelf should not be artificially simplified merely because it is developed by a small number of people.

Likewise, it should not be burdened with enterprise-scale architecture that solves problems the project does not actually have.

The goal is:

> **A robust architecture appropriate to Bookshelf's real scope without unnecessary complexity.**

Complexity should be justified by requirements, not by assumptions about project size.

---

## 11. Preserve Feature Boundaries

Major functional areas such as:

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

should remain logically understandable and should not become unnecessarily coupled.

Features may communicate when required, but their internal implementations should remain independent where practical.

---

## 12. Keep Business Logic Independent From Presentation

Business rules must not depend on how the UI is visually implemented.

For example:

- lending rules
- permission rules
- achievement rules
- validation
- imported data interpretation
- book-related rules

should not change merely because the presentation changes from cards to lists or from desktop to mobile.

> Business logic defines what the application does. Presentation defines how that behavior is shown.

---

## 13. Keep Data Access Separate From UI

UI code should not contain unnecessary knowledge of database structure or external service implementation.

Data-access logic should not contain visual decisions.

The interface between UI and data should remain explicit and understandable.

---

## 14. Protect Security Boundaries

Existing security mechanisms must not be weakened for convenience.

Do not bypass or remove:

- authentication
- authorization
- approval checks
- server-side validation
- mutation boundaries
- rate limiting
- input validation
- established security controls

A hidden UI element is not authorization.

Security decisions must remain enforced at the appropriate trusted boundary.

---

## 15. Preserve Localization

Bookshelf's localization system is a core part of the project.

New functionality must integrate with the existing localization mechanism.

Do not introduce feature-specific translation systems or hard-code user-facing strings unnecessarily.

A feature is not complete if its implementation silently breaks the supported language set.

---

## 16. Preserve Theme Architecture

The existing theme system should remain the single source of truth for application theming.

New UI must support both established light and dark visual languages.

Do not introduce isolated hard-coded colors for individual components when an appropriate design token already exists.

Visual exceptions must be deliberate and justified.

---

## 17. Mobile and Desktop Are Different Experiences

Responsive behavior should not simply scale desktop UI downward.

The established navigation model is:

```text
Landscape Desktop / Tablet
→ Collapsible Sidebar

Portrait Tablet / Mobile
→ Bottom Navigation
```

Touch-specific interactions such as:

- long press
- haptic feedback
- gesture interactions

may enhance the experience.

However, essential functionality must remain discoverable without requiring a hidden gesture.

---

## 18. Preserve Accessibility

Accessibility is part of feature correctness.

Changes should preserve appropriate:

- keyboard navigation
- focus states
- touch target sizes
- semantic labels
- contrast
- reduced-motion behavior
- interaction discoverability

Do not sacrifice accessibility merely to achieve a visual effect.

---

## 19. UI Must Follow the Design Language

New or modified UI should follow `UI_Design_Language.md`.

Do not introduce isolated visual styles because they look attractive in one component.

Bookshelf should feel like one product.

The following should remain consistent:

- typography
- color semantics
- spacing
- geometry
- interaction states
- responsive behavior
- component behavior

---

## 20. Every Change Must Have a Reason

Before changing an existing behavior, component, architecture, or dependency, be able to answer:

> **What problem does this change solve?**

Possible valid reasons include:

- a requested feature
- a bug
- a security problem
- an architectural responsibility problem
- a performance issue
- an accessibility issue
- a maintainability issue

Change for the sake of change should be avoided.

---

## 21. Prefer Minimal, Focused Changes

The preferred implementation is the smallest change that correctly satisfies the requirement while preserving existing behavior.

This does not mean:

> “Always change the fewest lines.”

It means:

> **Do not modify unrelated parts of the system.**

If a task requires substantial restructuring, the restructuring should still be scoped to a clear purpose.

---

## 22. Refactoring Is Not Product Redesign

Refactoring may improve code structure without changing product behavior.

A code-quality problem does not automatically justify:

- removing a feature
- changing a user flow
- changing stored data
- changing business rules
- changing API behavior

Architectural improvement and product redesign are separate decisions.

---

## 23. Do Not Hide Problems

Never conceal a failing state merely to make the project appear healthy.

Do not suppress:

- type errors
- lint errors
- failed tests
- runtime errors
- warnings that indicate real problems

Do not replace an error with a silent fallback unless that fallback is an intentional product behavior.

---

## 24. Changes Must Be Verifiable

Meaningful changes should be verified using the project's existing tooling.

Depending on the change, this may include:

```text
type checking
linting
format checking
unit tests
E2E tests
build verification
manual UI verification
```

Do not treat an unverified implementation as complete.

---

## 25. Keep Changes Reversible

Changes should be structured so that mistakes can be isolated and reverted without requiring unrelated parts of the project to be reconstructed.

Prefer focused changes and focused commits.

A large rewrite should not make it impossible to identify which architectural decision caused a regression.

---

## 26. Preserve Existing Data and Contracts

Changes involving storage, APIs, schemas, or persistent data must consider compatibility with existing data and consumers.

Do not casually rename, delete, or reinterpret established fields.

When a breaking change is genuinely required, it must be deliberate and documented.

---

## 27. Do Not Introduce Hidden Coupling

Avoid dependencies that exist only because they are convenient.

Examples of undesirable coupling include:

```text
UI component
→ secretly modifies unrelated global state

Feature A
→ imports Feature B's internal implementation

Utility
→ depends on a specific page

Data layer
→ depends on UI-specific types
```

Dependencies should reflect actual responsibility.

---

## 28. Keep Shared Code Truly Shared

A shared module should contain behavior that is genuinely shared.

Do not move unrelated code into a shared location simply because multiple modules happen to import it.

Shared code becomes part of the project's internal API and should therefore have a clear purpose.

---

## 29. Platform-Specific Features Should Not Leak Everywhere

Features such as:

- haptic feedback
- browser/PWA behavior
- touch gestures
- desktop-specific interaction
- mobile-specific navigation

should be isolated wherever practical.

Core product logic should remain usable independently from platform-specific implementation.

---

## 30. Do Not Assume a Rewrite Is Automatically an Improvement

A rewrite should be evaluated against the existing implementation.

A new implementation is better only if it provides a real improvement in relevant areas such as:

- maintainability
- clarity
- correctness
- performance
- security
- usability
- architectural boundaries

More code, newer libraries, or a different folder structure are not improvements by themselves.

---

# Decision Priority

When multiple rules appear to conflict, use this priority:

1. Explicit user requirement
2. Security and correctness
3. Existing product behavior
4. Existing repository rules and configuration
5. `Architecture_Principles.md`
6. `UI_Design_Language.md`
7. Implementation preference

Existing conventions should not be overridden merely because another approach appears more modern or elegant.

---

# Core Philosophy

The purpose of these rules is not to freeze Bookshelf.

Bookshelf should evolve.

The goal is to make change deliberate rather than accidental.

> **Understand the existing system before changing it.**

> **Preserve what works.**

> **Improve what genuinely needs improvement.**

> **Keep responsibilities clear.**

> **Avoid both unnecessary simplicity and unnecessary complexity.**

> **Do not add complexity without a reason.**

> **Do not remove structure without understanding what it protects.**

> **Make every architectural and product change intentional.**

---

# Final Principle

> **Bookshelf's quality is not measured by how many files it has, how sophisticated its architecture looks, or how much code it contains. It is measured by whether every part of the system has a clear purpose, behaves predictably, and can evolve without unnecessarily breaking the rest of the product.**
