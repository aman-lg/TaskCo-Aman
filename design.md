# UXL Exam LMS — Design System

The single binding reference for every visual decision in the UXL Exam LMS. The app is a CFA/FRM study platform for finance students. The experience must feel **trustworthy, focused, and professional** — not consumer-app flashy. Every component earns its place.

Architecture: a base token layer (`tokens.css`) plus a brand override layer (`tokens-ab.css`, loaded **after** the base). Components are React + Babel inline JSX in `src/`, each with a paired CSS file.

---

## 1. Fonts

```html
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Montserrat:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400&family=Instrument+Serif:ital@0;1&display=swap"/>
```

| Token | Family | Use |
|---|---|---|
| `--sans` / `--display` | **Montserrat** | Everything: headings, body, UI, numbers |
| `--serif` / `--editorial` | **Instrument Serif** | Italic accent only — a name, one italic word in a headline, a quote |

**Rules**
- Montserrat carries the entire interface. Weights 400–800 available.
- Instrument Serif is a **spice, never** body text or whole headings. Use it italic, for emphasis on a single word or a proper name.
- Never use Inter, Roboto, Arial, Georgia (as primary), or Fraunces.

---

## 2. Color tokens

Use **only** `var(--*)` names below. Never raw hex in components. Never guess a token name — an unresolved `var()` falls back silently to the browser default.

### Brand / accent
| Token | Value | Use |
|---|---|---|
| `--navy` | `#10125A` | Primary brand; CTAs, AI, active nav, structural accents |
| `--navy-d` / `--navy-700` | `#0C0E4A` | Navy hover / gradient end |
| `--navy-50` | `#EAEBF4` | Navy tint background (icon chips, focus rings) |
| `--navy-l` | `rgba(16,18,90,.08)` | Faint navy wash |
| `--accent` / `--orange` | `#CE7E37` | Energy / action: primary CTAs, active markers, progress fills |
| `--accent-d` | `#B85808` | Accent text on light bg, hover, serif italic accent color |
| `--accent-m` | `#CF6516` | Mid accent |
| `--accent-bg` / `--orange-50` | `#FBF1E7` | Accent tint surface |
| `--accent-bd` | `#F2D9BD` | Accent border |
| `--accent-l` | `rgba(232,165,109,.12)` | Faint accent wash |

### Surfaces & lines
| Token | Value | Use |
|---|---|---|
| `--shell-bg` | `#FFFFFF` | App shell backdrop |
| `--bg` | `#F6F7F9` | Page / inset background |
| `--panel-bg` | `#F7F8FA` | Inner scroll panels |
| `--surface` / `--card` | `#FFFFFF` | Cards, panels, inputs |
| `--sidebar-bg` | `#FFFFFF` | Sidebar (matches shell) |
| `--line` | `#E4E7EE` | Default borders |
| `--line-soft` | `#EDF0F5` | Subtle dividers, track backgrounds |

### Text
| Token | Value | Use |
|---|---|---|
| `--ink` / `--tp` | `#2A2E36` | Primary text, headings |
| `--ts` | `#4B5568` | Secondary / body |
| `--tm` | `#718096` | Muted labels, captions |
| `--tph` | `#A0AEC0` | Placeholders |
| `--muted` | `#64748B` | De-emphasized metadata |
| `--muted-2` | `#94A3B8` | Very muted, fine print |

### Status (each has a `-bg` tint)
| Token | Value | Meaning |
|---|---|---|
| `--green` / `--green-bg` | `#16A34A` / `#EDF7ED` | On track, complete, high confidence |
| `--amber` / `--amber-bg` | `#D97706` / `#FFF4E5` | Caution, partial progress, mid confidence |
| `--red` / `--red-bg` | `#DC2626` / `#FDE8E8` | Behind, weak confidence, errors |
| `--blue` / `--blue-bg` | `#10125A` / `#E8E9F3` | Categorical accent |
| `--violet` / `--violet-bg` | `#7C3AED` / `#F3E8FF` | Categorical accent |

**Rules**
- **Orange = action. Navy = brand. Status = meaning.** Never use a status color decoratively.
- Need a new shade? Derive it in `oklch()` from an existing token. Never introduce a fresh hex.

### Dark mode
`[data-theme="dark"]` remaps every token (e.g. `--bg: #131720`, `--surface: #1A1F2E`, `--navy: #4044B8`, `--accent: #F9A05A`, `--ink: #E8ECF4`). Components must read tokens — never hardcode light values — so dark mode works automatically.

---

## 3. Typography scale

| Role | Spec |
|---|---|
| Dashboard greeting | Montserrat 800, 36px, `-0.025em`, `text-wrap: balance` |
| Page title (`.h1`) | Montserrat 700, 28px, `-0.02em` |
| Section title (`.h2`) | Montserrat 700, 20px, `-0.01em` |
| Card title (`.h3`) | Montserrat 700, 15px, `-0.01em` |
| Eyebrow (`.eyebrow`) | Montserrat 800, 10.5px, `letter-spacing 1.4px`, uppercase, `--muted` (orange variant: `--accent-d`) |
| Body | Montserrat 500, 13–14.5px, line-height 1.5–1.6, `text-wrap: pretty` |
| Stat number | Montserrat 800, 28–36px, `-0.03em`, `font-variant-numeric: tabular-nums` |
| Serif italic accent | Instrument Serif italic 400, `--accent-d` — a name, one emphasized word |

**Numbers that are compared always use** `font-variant-numeric: tabular-nums`.

---

## 4. Spacing, radius, shadow

### Radius
- `--r-chip: 4px` — chips, smallest inner elements
- `--r-sm: 6px` — small chips
- `--r-md: 8px` — inputs, small buttons
- `--r-lg: 12px` — cards, larger buttons
- `--r-mobile-card: 12px` — mobile cards
- `--r-pill: 999px` — pills, toggles, CTAs

### Shadow (navy-tinted, used sparingly)
- `--shadow-card` — resting card
- `--shadow-elev` — popovers, modals, elevated panels
- `--shadow-soft` — soft lift
- `--shadow-needle` — orange glow, **only** for active/CTA states
- **Static content cards carry no shadow** (Notion-flat principle).

### Layout rhythm
- Page padding: 22–28px sides
- Section gap: 18–26px
- Card padding: 14–22px
- **Always use flex/grid + `gap:`** for spacing between siblings. Never bare margins between inline siblings.

---

## 5. Components

### Buttons (`.btn`)
| Role | Style |
|---|---|
| Primary (`.btn-primary`) | Orange fill, white text, soft orange shadow. Pill radius for CTAs |
| Navy (`.btn-navy`) | Navy fill, white text. "Ask Vidya", "View Tracker" |
| Ghost (`.btn-ghost`) | White bg, `--line` border → navy border on hover |
| Pill toggle / segmented | Track + active segment = `--ink` fill, white text |

### Cards (`.card`)
White, `--line` border, `--r-md`/`--r-lg`. **Static cards do not lift on hover.** Interactive (navigating) cards hover-lift `translateY(-2px)` and shift border to `--navy`.

### Inputs
- Border `1.5px solid --line` resting → `--navy` on focus
- Focus ring `box-shadow: 0 0 0 3px --navy-50`
- Background `--surface` (white), never `--bg` grey
- Floating-label pattern: label lifts on focus/fill
- Placeholder color `--tph`

### Pills & chips (`.pill`, `.chip`)
`.pill` — navy tint default, with `.orange`, `.green`, `.amber`, `.red`, `.violet`, `.ghost` status variants. `.chip` — bordered toggle; `.chip.active` fills navy.

### Rails / progress (`.rail` + `.rail-fill`)
6px track on `--line-soft`; fill variants `.rail-green/.amber/.red/.orange/.navy`, width transitions 400ms.

### Ratings
Numbers 1–5 in a tinted pill: green ≥4, orange =3, red ≤2, em-dash unrated. **Never dots or stars.**

### Checkboxes (OMR-style)
Orange `--accent-bd` outline by default. On check: **no tick** — box fills light orange `#F8C99B`. **Not green.**

### Notes affordance
Pencil/doc icon → opens a **floating popover editor** (title + roomy textarea + Save/Cancel/Delete). Never a cramped inline cell input.

### Overlays / modals
Scrim `rgba(15,23,42,.42)` + `blur(4px)`. Entrance `cubic-bezier(.32,1.4,.4,1)`.
**Engine caveat:** CSS `transition/animation` on `transform` can trap in the preview runtime. Drive slide-in panels from React inline style, not CSS `transition`. Opacity transitions are fine.

### Focus
`:focus-visible` → 2px orange outline, 2px offset. ≥44px touch targets.

---

## 6. App shell

- **Sidebar** — fixed 240px, collapses to 72px <1180px, hidden <640px (replaced by a mobile bottom bar). Background matches the container (`--sidebar-bg`). Active nav item: orange fill, white text + white icon, **no** icon background chip.
- **Mobile bottom bar** — contextual (Swiggy/Instamart model): the bar swaps when entering a section (Study → Study sub-items); a back arrow returns to the top level.
- **Topbar** — sticky 60px bar. In detail/sub-views the course dropdown is replaced by a breadcrumb; Ask Vidya / dark toggle / notifications hide.

---

## 7. The AI persona

- **Avatar** — rounded square, orange gradient, white **italic serif** initial.
- **Voice** — the persona's name always renders in italic serif `--accent-d` (`<span class="pt-italic">…</span>`).
- **Surfaces** — plan-setup onboarding, "How it works" walkthrough, Progress AI insight.
- AI badges use a small **navy "AI" pill**.

---

## 8. Section conventions

### Dashboard
- Notion-flat rhythm: minimal shadows, thin dividers, whitespace groups content.
- Stat cards: conic-gradient border-progress ring, tinted icon, tabular number, trend arrow.
- Section headings: single eyebrow + title — never eyebrow + title + subtitle stacked.

### Course Overview
- One flat container; sections separated by **whitespace + thin dividers only** — no cards/borders/shadows.
- Collapsible sections (expand for detail) to manage density.
- Module CTAs woven in-between to drive navigation into Lectures / Practice / Mock.

### Performance Tracker — Input
- Accordion groups: flat list in one panel, divider rows, no per-group boxes.
- Current week: left `--accent-d` accent bar + faint tint + orange "Current week" pill.
- Activities: OMR checkboxes. Confidence: single gradient meter bar (pale→deep orange).
- Filter modal: multi-select dropdowns (Subject/Topic/LOS) with search + status pills.

### Performance Tracker — Progress
Order: slim timeline strip → AI insight → stat cards → week carousel → subject heatmap → detailed analysis. Subject chip rail scopes all charts to one subject.

### Lecture Guide
- Multi-select dropdowns with checkbox options, search in long lists, count badge on button.
- List view (horizontal thumbnail + content) and 4-col grid view (auto-fill, never scrolls).
- Grid card: colored top accent bar by type — navy=Class, orange=Practice, blue=Revision, violet=Mentoring. Subject name is navy text, no chip.

### Help & Support
- Three-level FAQ (Category → Subcategory → Q&A) with breadcrumb.
- AI-first ticketing chat: greeting → topic chips → describe → suggested FAQ → raise ticket (ID + TAT) → conversation thread with pinned reply box.

### Session/Event pages (standalone)
Section rhythm: Hero (dark) → Stats (white) → Problem (dark) → Pillars (white) → Testimonials (grey) → Gallery (white) → Mentor (grey) → Quote (dark, last) → Footer. **Never two dark sections adjacent.** Form: 2-step with floating labels, white inputs, navy focus glow.

---

## 9. Principles

1. **Brand tokens only.** Never raw hex; never a `var()` name outside the documented set.
2. **Serif is a spice.** Italic Instrument Serif for accents only.
3. **Orange = action. Navy = brand. Status = meaning.** No status colors as decoration.
4. **Tabular numbers everywhere** they're compared.
5. **Flex/grid + `gap`** for all grouping.
6. **Less is more.** No filler stats, no decorative gradients, no emoji.
7. **Honest interactivity.** No hover/pointer on static elements.
8. **Accessible.** 2px orange focus ring, ≥44px touch targets, status never encoded by color alone.
9. **Mobile-first sizing.** Nav items 8px padding, icons 24px, compact inputs.
10. **Canonical HTML.** Close every non-void element, double-quote attributes, never self-close non-void elements.
