# Bookshelf UI Improvement Plan

## Purpose

This document defines the planned UI improvements for Bookshelf.

The goal is not to redesign Bookshelf from scratch or remove existing functionality. The goal is to bring the current interface closer to the project's design language:

> A warm, calm, timeless personal digital library that combines classical academic character with modern, highly intuitive interaction.

The main direction is:

**Library Management UI → Personal Digital Library**

Existing functionality should remain available. The primary change should be how much visual and cognitive priority each feature receives.

---

## 1. Make the Books Page Feel Like a Collection

The Books page currently gives several management features similar visual importance:

- Page title and book count
- Add book section
- Excel actions
- Page logging
- Filters
- View switching
- Book grid
- Advanced actions

Individually these features make sense, but together they make the page feel more like an administration interface than a personal library.

### Desired hierarchy

The page should communicate information in this order:

1. Where am I?
2. What is in my library?
3. How can I find something?
4. What can I do with it?

The books themselves should remain the dominant visual element.

### Changes

- Keep the page title simple.
- Keep the book count close to the title.
- Move advanced management actions away from the main visual flow.
- Make adding a book a clear but secondary action.
- Keep Excel import/export available, but do not make it visually dominant.
- Keep page logging available, but move it toward contextual actions.
- Let the collection occupy most of the page.

The user should feel like they are opening their library, not opening a database management panel.

---

## 2. Reduce the Visual Weight of Book Management

### Current problem

`BooksAddSection` is visually large and appears directly in the main collection flow.

This gives the impression that adding and managing books is the primary purpose of the page.

### Desired behavior

Use a primary `+ Add Book` action that opens a modal, drawer, or dedicated workspace.

The main Books page should then become:

```text
Books
142 books

[ Search... ] [ Filters ] [ Sort ]

[ Book ] [ Book ] [ Book ] [ Book ]
[ Book ] [ Book ] [ Book ] [ Book ]
[ Book ] [ Book ] [ Book ] [ Book ]
```

Advanced actions such as:

- Detailed book entry
- Excel import
- Excel export

can remain available from the add-book workflow or a secondary menu.

### Important

This is a hierarchy change, not a feature removal.

All existing functionality should remain accessible.

---

## 3. Simplify the Filter Bar

The current filter interface exposes a large amount of functionality at once.

Advanced filters are useful, but they should not dominate the collection.

### Primary toolbar

The default toolbar should focus on:

- Search
- Filters
- Sort
- View mode

For example:

```text
[ Search books... ]   [ Filters ]   [ Sort ]   [ Grid/List ]
```

### Advanced filters

The following can remain inside the Filters panel:

- Rating
- Status
- Signed
- Lending
- Tag
- Group
- Sort direction
- Other advanced criteria

The user should only see these when they intentionally open the filter controls.

### Goal

Searching for a book should feel like browsing a library, not configuring a query.

---

## 4. Simplify Book Cards

The current book cards contain many pieces of information and actions:

- Cover
- Loan status
- Signed status
- Title
- Author
- Groups
- Rating
- Reading status
- Remaining pages
- Page logging
- Reread action
- Status-changing interactions

This makes the card useful, but visually overloaded.

The design language already defines a simpler principle:

> The card primarily shows the cover, title, author, and one small relevant status or metadata item.

### Desired card hierarchy

```text
┌─────────────────────┐
│                     │
│       COVER         │
│                     │
│                     │
├─────────────────────┤
│ Book Title          │
│ Author Name         │
│                     │
│ ● Reading           │
└─────────────────────┘
```

The cover should remain the dominant element.

### Keep

- Cover
- Title
- Author
- One small status or metadata indicator
- Important contextual indicators such as lending when necessary

### Move out of the permanent card layout

Actions such as:

- Log pages
- Reread
- Change status
- Other detailed operations

should preferably be available through:

- Book detail view
- Context menu
- Secondary action menu

This keeps the card visually calm without removing functionality.

---

## 5. Preserve the Physical Card Concept

The book cards should continue to feel like physical objects in a personal collection.

The visual metaphor should come from:

- Consistent dimensions
- Consistent cover proportions
- Equal spacing
- Subtle borders
- Controlled elevation
- A curated collection layout

It should **not** come from:

- Excessive shadows
- Heavy skeuomorphism
- Fake paper textures
- Decorative effects
- Overly rounded containers

The goal is a digital interpretation of a carefully organized bookshelf, not a literal simulation of paper cards.

---

## 6. Simplify Sidebar Hierarchy

The current sidebar contains many navigation destinations with relatively similar visual importance.

This creates a large amount of navigation noise.

### Suggested hierarchy

```text
LIBRARY

Books
Groups
Lending
Stats


EXPLORE

Series
Authors


MORE

Achievements
Challenges
Leaderboard


ACCOUNT

Profile
Settings


ADMIN

Admin
```

The exact grouping can change depending on future information architecture, but the principle should remain:

> Frequently used destinations should be visually and structurally separated from secondary features.

### Profile and Settings

Profile and Settings should not feel like part of content discovery.

They belong to the user's account rather than the library itself.

### Admin

Admin functionality should remain clearly separated from the personal library.

The normal user should not feel like they are navigating an administration panel.

---

## 7. Make Active Navigation Quieter

The current active navigation state uses a strong accent background.

This makes the selected item visually dominant.

For Bookshelf's visual language, navigation should support the content rather than compete with it.

### Preferred direction

Use a subtle active state such as:

- Soft accent background
- Accent-colored icon
- Accent-colored text
- Small indicator

Avoid making the entire navigation item look like a large primary button.

The active state should still be immediately recognizable.

---

## 8. Unify the Accent Color

The design language defines the main accent as:

```text
#BB4F35
```

However, the current implementation contains multiple accent-like colors, including:

```text
#BB4F35
#B56F76
```

This can make the interface feel visually inconsistent.

### Recommendation

Use:

```text
#BB4F35
```

as the primary accent throughout the interface.

Other colors should have clearly defined roles rather than becoming competing accent colors.

### Light theme

Primary accent:

```text
#BB4F35
```

Hover:

```text
#A5442D
```

Active/pressed:

```text
#8F3A26
```

### Dark theme

Use the existing warm dark-theme accent while maintaining the same semantic role.

The important part is that the interface should feel like one visual system.

---

## 9. Reduce Excessive Corner Rounding

The design language uses a controlled radius family:

```text
4px
8px
12px
9999px
```

The current base radius is larger than this family suggests.

Large rounded corners on every component can push the interface toward a generic modern SaaS aesthetic.

### Recommended usage

```text
4px   → small controls and subtle elements
8px   → standard buttons, inputs, navigation items
12px  → larger surfaces and important containers
9999px → pills and fully circular elements
```

Not every element needs to be rounded.

Borders and spacing should do more of the structural work.

---

## 10. Reduce Dashboard-Like Surface Layers

Bookshelf currently uses several surfaces, borders, and containers.

These are useful for hierarchy, but too many nested containers create the visual language of an admin dashboard.

### Desired principle

Use surfaces when they communicate a meaningful structural relationship.

Do not place every section inside a bordered rounded rectangle simply because the component library makes it easy.

For example, prefer:

```text
Books

[ Search ] [ Filters ]

Book  Book  Book  Book
Book  Book  Book  Book
```

over:

```text
┌──────────────────────────────┐
│ ┌──────────────────────────┐ │
│ │ Search / Filters         │ │
│ └──────────────────────────┘ │
│                              │
│ ┌──────┐ ┌──────┐ ┌──────┐ │
│ │ Book │ │ Book │ │ Book │ │
│ └──────┘ └──────┘ └──────┘ │
└──────────────────────────────┘
```

The content should create the structure naturally.

---

## 11. Improve Mobile Navigation Discoverability

The current mobile bottom navigation primarily uses icons.

This is compact, but icon-only navigation can reduce discoverability.

### Preferred direction

Consider using:

- Icon + label for primary destinations
- Or icon-only navigation with a clearly labeled active destination

Primary destinations remain:

```text
Books
Lending
Stats
More
```

The navigation should remain visually quiet while still being understandable without memorizing icons.

---

## 12. Keep Page-Specific Workspaces

Not every page should be forced into the same dashboard layout.

The existing design language explicitly favors page-specific workspaces.

For example:

### Books

Collection-focused workspace.

### Lending

Transaction/activity-focused workspace.

### Stats

Data visualization-focused workspace.

### Settings

Configuration-focused workspace.

These pages can have different internal layouts while sharing:

- Typography
- Colors
- Spacing
- Navigation
- Interaction patterns
- Component behavior

Consistency should come from the design system, not from forcing every page into the same template.

---

## 13. Keep the Interface Information-Dense, But Not Crowded

Bookshelf should not become an extremely minimal interface.

A personal library naturally contains information.

The goal is:

> Balanced density.

Avoid both extremes:

### Too sparse

```text
        Books

        142 books

        [ Search ]

        Book
```

### Too dense

```text
Books · 142
ISBN · Publisher · Pages · Language · Edition · Rating · Status · Group
[15 filters] [8 actions] [6 menus]
```

### Desired

Enough information to understand the collection at a glance, while secondary information remains accessible when needed.

---

## 14. Preserve Accessibility

Visual simplification must not reduce accessibility.

Every redesign should preserve:

- Keyboard navigation
- Visible focus states
- Adequate contrast
- Touch-friendly target sizes
- Semantic labels
- Screen-reader support
- Reduced-motion behavior
- Clear disabled states
- Loading states
- Error states

Color must never be the only way to communicate status.

For example:

```text
● Reading
✓ Finished
↗ On loan
```

can provide a combination of text and visual indicators rather than relying only on color.

---

## 15. Avoid These Visual Directions

The redesign should explicitly avoid:

- Generic SaaS dashboards
- Corporate administration panels
- E-commerce bookstore interfaces
- Futuristic AI interfaces
- Glassmorphism
- Excessive gradients
- Neumorphism
- Excessive shadows
- Excessive pill-shaped components
- Vintage skeuomorphic interfaces
- Literal physical-book simulations
- A direct GNOME visual clone

GNOME HIG should influence interaction quality and usability, not turn Bookshelf into GNOME Web with a database attached.

---

## 16. Preserve the Existing Feature Set

The redesign should not be treated as a feature-removal project.

Existing functionality such as:

- Book importing
- Excel import/export
- Page logging
- Lending
- Groups
- Tags
- Ratings
- Reading status
- Signed-book tracking
- Series
- Authors
- Achievements
- Challenges
- Leaderboard
- People
- Profile
- Settings
- Administration

should remain available.

The goal is to change their hierarchy and presentation.

### Principle

**Less visible does not mean less available.**

Advanced functionality should appear when it is relevant.

---

## 17. Implementation Priority

The changes should be implemented incrementally.

### Phase 1: Visual consistency

- Unify accent colors
- Adjust radius system
- Review spacing
- Review active navigation state
- Remove unnecessary visual competition between surfaces

### Phase 2: Books page hierarchy

- Reduce the visual size of the add-book section
- Move advanced add/import functionality behind secondary actions
- Give the collection more visual space

### Phase 3: Book cards

- Reduce permanent metadata
- Move secondary actions into contextual interactions
- Make cover/title/author the primary focus

### Phase 4: Navigation

- Simplify sidebar grouping
- Separate account functionality
- Separate administration
- Improve mobile navigation discoverability
- Reduce active-state visual weight

### Phase 5: Page-specific refinement

Review each major workspace independently:

- Books
- Lending
- Groups
- Stats
- Series
- Authors
- Achievements
- Challenges
- Leaderboard
- Profile
- Settings
- Admin

Each page should follow the same design language while retaining an appropriate workspace structure.

---

## 18. Success Criteria

The redesign should satisfy the following questions.

### Identity

Does the interface immediately feel like a personal digital library?

### Hierarchy

Are books more visually important than management tools?

### Clarity

Can a new user understand the primary navigation without learning the application first?

### Restraint

Are advanced features available without permanently occupying visual space?

### Consistency

Do colors, spacing, radii, typography, and interaction states feel like one system?

### Character

Does the interface retain its warm, academic, timeless personality?

### Accessibility

Can the interface be comfortably used with keyboard navigation, touch interaction, and assistive technologies?

### Responsiveness

Does the same design language remain coherent across desktop, tablet, mobile?

---

## 19. Core Design Principle

The most important change is not a specific component, color, or CSS value.

It is the relationship between the user and the interface.

Bookshelf should feel like:

> "This is my library."

Not:

> "This is the management interface for my library."

The application can contain complex functionality internally. The interface should reveal that complexity progressively instead of presenting all of it at once.

The collection should be the protagonist.

Everything else should support it.
