# Bookshelf UI Design Language

## Purpose

Redesign the Bookshelf interface as a cohesive, intuitive, warm, and timeless personal library application.

This document is the source of truth for the visual language, UX principles, responsive layout, and interaction model. Do not introduce a new visual direction unless explicitly requested.

---

## 1. Product Character

Bookshelf should feel like a **personal digital library**, not a generic SaaS dashboard or an enterprise administration panel.

### Core character

- Classic
- Academic
- Cozy Library
- Personal Collection
- Warm
- Calm
- Personal
- Refined
- Timeless
- Clearly related to books and libraries

The product should feel comfortable enough for long periods of use while remaining serious and organized.

Do not make it childish, overly playful, corporate, futuristic, or artificially “premium”.

### Emotional goal

The user should feel:

> “This is my library, and I like being here.”

---

## 2. UX Philosophy

### Intuitiveness comes first

A user should understand what an element does without needing to learn the interface.

Visual hierarchy must communicate function.

### One Place, One Purpose

Every screen has one clear primary purpose.

Supporting functionality is allowed only when it directly contributes to that purpose.

This does **not** mean that information may exist on only one screen. For example, `Total Books` may appear on both Books and Stats when it serves different contextual purposes.

### Every Element Earns Its Place

Every UI element must have a functional, navigational, or informational purpose.

Do not add cards, illustrations, buttons, statistics, decorations, or empty components simply because space is available.

### Clarity Before Decoration

Visual character must never reduce discoverability, readability, hierarchy, or usability.

### Consistency

A component that communicates a specific meaning should behave and look consistently throughout the application.

---

## 3. Typography

Use the Noto family for broad multilingual coverage and visual consistency across writing systems.

### Primary fonts

- **Noto Serif**: display text, major headings, book titles, literary/brand moments
- **Noto Sans**: navigation, controls, labels, metadata, dense UI text
- **Noto Sans Mono**: technical values when a monospace treatment is actually useful

Do not use unrelated font families unless explicitly requested.

Serif is intentional. It is part of Bookshelf’s character and should not be removed just to make the interface look more generic.

---

## 4. Color Themes

Bookshelf has two themes that belong to the same visual family.

## 4.1 Light Theme: Fine Porcelain × Burnt Ochre

| Variable | Hex |
|---|---|
| Background | `#FAF0E1` |
| Surface | `#F2EDEC` |
| Surface Elevated | `#FFFFFF` |
| Primary Text | `#2B2727` |
| Secondary Text | `#6F6666` |
| Muted Text | `#8A8584` |
| Text On Accent | `#FFFFFF` |
| Border | `#DED8D2` |
| Border Strong | `#C4BDB5` |
| Focus Ring | `#BB4F35` |
| Accent | `#BB4F35` |
| Accent Hover | `#A5442D` |
| Accent Active | `#8F3A26` |
| Accent Soft | `#F3E1E3` |
| Success | `#93907E` |
| Success Soft | `#E7E5DA` |
| Success Text | `#5F5D4E` |
| Warning | `#CB9D06` |
| Warning Soft | `#F2E8C8` |
| Warning Text | `#6E5403` |
| Error | `#B9484E` |
| Error Soft | `#F3D9DA` |
| Error Text | `#8C363B` |
| Info | `#8093A4` |
| Info Soft | `#E2E8ED` |
| Info Text | `#4D6072` |
| Selection | `#E9C9CC` |
| Selection Text | `#3A2927` |
| Disabled Surface | `#E3DDD6` |
| Disabled Text | `#968E8B` |

### Light theme character

Warm, literary, soft, personal, and welcoming.

---

## 4.2 Dark Theme: Ink & Copper

| Variable | Hex |
|---|---|
| Background | `#1D2020` |
| Surface | `#272A29` |
| Surface Elevated | `#333735` |
| Primary Text | `#F2EEE8` |
| Secondary Text | `#C1BCB4` |
| Muted Text | `#8F8B84` |
| Text On Accent | `#FFFFFF` |
| Border | `#444845` |
| Border Strong | `#5B605B` |
| Focus Ring | `#D08B6D` |
| Accent | `#C17A5E` |
| Accent Hover | `#D08B6D` |
| Accent Active | `#A7624B` |
| Accent Soft | `#473029` |
| Success | `#789873` |
| Success Soft | `#304238` |
| Success Text | `#A8C8A2` |
| Warning | `#C09A57` |
| Warning Soft | `#473D2B` |
| Warning Text | `#D9BC80` |
| Error | `#C2756D` |
| Error Soft | `#49312F` |
| Error Text | `#E19A92` |
| Info | `#7EA0B1` |
| Info Soft | `#293B45` |
| Info Text | `#A9CAD8` |
| Selection | `#5A4038` |
| Selection Text | `#F6ECE7` |
| Disabled Surface | `#303432` |
| Disabled Text | `#777C79` |

### Dark theme character

Warm, deep, quiet, sophisticated, and distinctly literary.

Dark mode is **not** a black-and-white inversion of light mode. Maintain a clear hierarchy between Background, Surface, and Surface Elevated.

---

## 5. Visual Surfaces

The three primary surface layers must remain visually distinguishable.

```text
Background
    ↓
Surface
    ↓
Surface Elevated
```

Do not make Surface and Surface Elevated visually indistinguishable.

Elevation may be communicated through a combination of:

- tonal contrast
- subtle border contrast
- restrained shadow

Do not rely on heavy shadows.

---

## 6. Layout Architecture

Use a **Responsive Hybrid Shell**.

The application shell is shared across the product, but the internal workspace is allowed to change depending on the page’s purpose.

### Desktop

- Collapsible left sidebar
- Expanded state: icon + label
- Collapsed state: icon rail
- Main workspace uses the remaining horizontal space
- Sidebar state should persist as a user preference

### Landscape tablet

Treat as the desktop paradigm.

- Collapsible sidebar
- Same workspace model as desktop

### Portrait tablet

Treat as the mobile paradigm.

- No permanent sidebar
- Bottom navigation
- Touch-first interaction

### Mobile

- Bottom navigation
- No permanent left sidebar
- Content is recomposed for a narrow viewport rather than merely shrunk

### Navigation principle

Desktop and landscape tablet use a sidebar.
Portrait tablet and mobile use bottom navigation.

Do not introduce a third unrelated navigation paradigm.

---

## 7. Bottom Navigation

The mobile navigation should remain focused on primary destinations.

Base navigation:

- Books
- Lending
- Stats
- More

`More` contains secondary destinations such as Achievements, Leaderboard, Goals, Profile, Settings, and similar lower-frequency areas.

The bottom navigation is for **navigation**, not for stuffing page actions into the navigation bar.

For example, `Add Book` belongs to the Books workspace, not to the bottom navigation.

Bottom navigation must respect device safe areas and must not overlap content.

---

## 8. Desktop Sidebar

The sidebar is collapsible, not permanently fixed in its expanded form.

Suggested conceptual states:

```text
Expanded
icon + label

Collapsed
icon only
```

The active destination must be immediately recognizable.

The collapse/expand control must itself be obvious and discoverable.

Do not create duplicate navigation systems that compete with the sidebar.

---

## 9. Page Layout Philosophy

Every page can have a different internal workspace while sharing the same application shell.

Examples:

### Books

Primary purpose: manage and browse the personal library.

The collection is the visual center.

### Lending

Primary purpose: manage lending activity.

Keep lending actions and lending information together.

### Stats

Primary purpose: understand the collection through metrics and analysis.

This page may use a wider analytical layout.

### Achievements

Primary purpose: show progress and achievements.

A grid-based composition is appropriate when useful.

### Leaderboard

Primary purpose: show rankings.

A compact ranking-oriented layout is appropriate.

Do not force every page into the same dashboard template.

---

## 10. Page Header

Page headers should establish context quickly.

Typical structure:

- page title
- optional supporting description/context
- primary page action when needed

Do not force a primary action into every page if the page does not need one.

Primary actions should be visually clear without dominating the screen.

---

## 11. Book Collection Presentation

Books should be represented as **equal-sized physical-card-like objects**.

The inspiration is the spatial organization of a group of playing cards such as UNO, not the visual style of UNO.

### Core rule

> Every book card has identical dimensions and geometry.

Do not vary card width, height, angle, or shape between books.

### Book card principles

- Identical width
- Identical height
- Identical radius
- Identical internal spacing
- Fixed cover area
- Fixed metadata area
- Book content changes, not card geometry

### Card content

The card should primarily communicate:

- book cover
- title
- author
- one small relevant status/metadata item when useful

Do not overload the card with ISBN, publisher, page count, language, and other detailed metadata.

Those details belong to a detail view.

### Card interaction

Desktop:

- Click → open book/detail view
- Hover → subtle elevation/border response
- Contextual actions may appear on hover

Touch:

- Tap → open book/detail view
- Long press → contextual actions
- Haptic feedback may reinforce meaningful interactions

### Important constraint

Do **not** implement drag-and-drop as part of the book card system.

The cards should feel physical through their consistent geometry, spacing, surface treatment, and depth, not through unnecessary physical simulation.

---

## 12. Books View Modes

Default view:

> **Cards**

An optional secondary view may provide a denser:

> **List / Catalog**

The card view is the primary expression of the Personal Collection concept.

The list view exists for users who need higher information density when managing large libraries.

---

## 13. Responsive Book Cards

Card geometry remains consistent within a given layout system.

The number of columns changes with available width.

Conceptually:

- Desktop: more cards per row
- Landscape tablet: fewer cards per row
- Portrait tablet: compact grid
- Mobile: typically two-column grid when practical

Do not make the cards vertically fluid merely to fill space.

Mobile may reorganize information inside a card, but should preserve the core card identity.

---

## 14. Interaction Model

Bookshelf should support touch-friendly interaction where applicable.

### Tap

Primary interaction.

### Long press

Contextual action shortcut for touch devices, such as:

- Edit
- Delete
- Lend
- Other context-specific actions

Long press must never be the only way to access a core function.

### Haptic feedback

Use haptics selectively for meaningful touch interactions.

Do not add vibration to every tap.

### Gestures

Gestures may accelerate workflows but should not be required to discover or access core functionality.

---

## 15. Density and Whitespace

The interface should be **balanced**.

Avoid both extremes:

- overly sparse screens with giant empty areas
- compressed interfaces where everything competes for attention

Whitespace should be intentional and functional.

Do not add UI elements just because the screen looks empty.

---

## 16. Visual Hierarchy

The visual hierarchy should usually communicate this sequence:

> Where am I? → What is here? → What can I do? → What else can I do?

Primary actions should be more visible than secondary actions.

Secondary actions should remain discoverable without visually competing with the main task.

---

## 17. Shape and Depth

Keep geometry restrained and coherent.

Suggested radius family:

- Small: 4 px
- Medium: 8 px
- Large: 12 px
- Full: 9999 px

Do not use large rounded corners everywhere.

Shadows should primarily communicate hierarchy and elevation, not decoration.

Avoid:

- excessive shadow
- excessive glass effects
- excessive blur
- floating-card overload
- decorative neumorphism

---

## 18. States

Important UI components should have clearly distinguishable states:

- Default
- Hover
- Active
- Focus
- Selected
- Disabled
- Loading
- Error

State changes must be understandable without relying on color alone.

---

## 19. Accessibility

The visual language must support practical accessibility.

Priorities include:

- readable text
- strong enough contrast
- obvious focus states
- usable touch targets
- keyboard navigation where applicable
- semantic labels
- reduced motion support
- color not being the sole signal for important states

---

## 20. What to Avoid

Do not turn Bookshelf into:

- a generic SaaS dashboard
- a corporate admin panel
- an e-commerce bookstore
- a futuristic AI interface
- a GNOME clone
- a vintage skeuomorphic library simulator
- a glassmorphism showcase
- a gradient-heavy “modern” template
- an interface filled with unnecessary cards

Avoid introducing trends merely because they are fashionable.

The design should still feel appropriate years from now.

---

## 21. GNOME Influence

Use GNOME primarily as a source of **interaction and usability principles**, not as Bookshelf’s visual identity.

Borrow principles such as:

- consistency
- discoverability
- keyboard accessibility
- predictable interactions
- clear states
- sensible responsive behavior
- restrained complexity

Do not copy GNOME’s visual styling wholesale.

---

## 22. Core Design Summary

Bookshelf should be:

> **A warm, calm, timeless personal digital library that combines classical academic character with modern, highly intuitive interaction.**

The key visual idea is:

> **Cozy Library + Personal Collection**

The key UX idea is:

> **Clarity before decoration.**

The key structural idea is:

> **One shared responsive shell, with page-specific workspaces.**

The key collection idea is:

> **Books are equal-sized cards in a curated field, not database rows by default.**
