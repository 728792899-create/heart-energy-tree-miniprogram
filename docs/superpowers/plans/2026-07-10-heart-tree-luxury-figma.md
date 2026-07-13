# Jardin des Vœux Full Figma Design Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a production-oriented Figma design file containing the complete Jardin des Vœux design system, all 21 mini-program pages, role variants, dialogs, states, responsive checks, motion annotations, and clickable prototype flows.

**Architecture:** Use the single approved Figma Design file with 3 physical pages (the Starter-plan maximum) and 11 named Sections that preserve the full approved information architecture, plus local variables, styles, and component sets. A local MCP bridge invokes the authenticated Figma plugin tools without exposing OAuth credentials; each Figma write is stored as a small reproducible JavaScript script and its returned node IDs are recorded in a state ledger for validation and recovery. Do not create another file to bypass plan limits.

**Tech Stack:** Figma Plugin API through the authenticated Figma MCP server, Python 3 MCP bridge, JavaScript generation scripts, Markdown specifications, JSON state ledger.


## Current Execution Status — 2026-07-10

- Specification confirmed: `Jardin des Vœux｜心愿花园高级定制` is locked as the final direction.
- Figma file: `cRXdU1LkyMBt8V0RjrEIgo` (the only approved file).
- Starter-plan adaptation complete: 3 physical pages + 11 semantic Sections; no content scope was removed.
- Foundations complete: 5 variable collections, 8 text styles, 3 effect styles, and 5 documentation boards.
- Component library complete: 83 reusable component roots across four catalog boards plus production mobile primitives.
- Core girlfriend flow generated: 4 / 22 core screens.
- Current blocker confirmed on 2026-07-10: a fresh read-only `get_metadata` probe reached Figma and was rejected by the Starter-plan MCP tool-call limit. No writes were attempted after the probe.
- Offline continuation complete: scripts `03`–`11` compile, the Figma automation contract passes 3/3, the credential-safe bridge regression suite passes 2/2, and the complete project suite passes 104/104.
- Transport hardening complete: `mcp_bridge.py` now constrains HTTPS to TLS 1.2 and retries one pre-request handshake EOF; OAuth credentials remain in macOS Keychain and are never printed.
- Safe continuation: wait for MCP quota recovery or upgrade the existing team plan, then resume serial scripts `04`–`11` in the only approved Figma file.

---

## File Map

- Create: `design/figma/mcp_bridge.py` — authenticated MCP JSON-RPC bridge with safe tool calls and redacted logging.
- Create: `design/figma/state.json` — file key, URL, page IDs, component IDs, frame IDs, and verification state.
- Create: `design/figma/scripts/01-foundations.js` — Figma pages, color/spacing/radius variables, text/effect styles, cover, and foundation boards.
- Create: `design/figma/scripts/02-components.js` — reusable navigation, buttons, fields, chips, cards, status, lists, dialogs, and state components.
- Create: `design/figma/scripts/03-core-girlfriend.js` — bind, girlfriend home, check-in, history, and base weekly recap views.
- Create: `design/figma/scripts/04-rewards-garden.js` — map, wallet, shop, reward detail, and redemptions.
- Create: `design/figma/scripts/05-core-boyfriend.js` — boyfriend home and sponsor companion views.
- Create: `design/figma/scripts/06-sponsor-operations.js` — review, payouts, rules, and admin reward screens.
- Create: `design/figma/scripts/07-profile-recap.js` — profile, profile edit, and final weekly recap states.
- Create: `design/figma/scripts/08-dialogs-states.js` — eight dialogs and eight state boards.
- Create: `design/figma/scripts/09-responsive-motion.js` — 375/390/430 responsive boards, motion storyboards, and reduced-motion guidance.
- Create: `design/figma/scripts/10-prototype-handoff.js` — prototype links, annotations, page index, and implementation notes.
- Create: `design/figma/scripts/11-validate.js` — inventory and structural validation.
- Create: `outputs/figma/2026-07-10/` — screenshots, validation JSON, and final delivery report.
- Modify: `docs/superpowers/plans/2026-07-10-heart-tree-luxury-figma.md` — mark completed checkboxes during execution.

Git commits are intentionally omitted because `/Users/wangwentong/Documents/Codex/2026-07-08/wo` is not a Git repository and the user explicitly prohibited `git init`.

### Task 1: Establish Safe Figma Automation

- [x] **Step 1: Create the bridge**

Create `design/figma/mcp_bridge.py` with commands `whoami`, `create-file`, `call`, and `tools`. It must read the `Codex MCP Credentials` item for Figma from macOS Keychain, initialize a Streamable HTTP MCP session, call one tool, emit only the returned result, and never print access or refresh tokens.

- [x] **Step 2: Verify account and plan availability**

Run:

```bash
python3 design/figma/mcp_bridge.py whoami
```

Expected: authenticated user metadata and one or more plan entries, with no OAuth token in output.

- [x] **Step 3: Create the new Figma file**

Run `create_new_file` only after loading `figma-create-new-file`. Use the sole plan automatically; if multiple plans exist, stop before file creation. File name:

```text
Jardin des Vœux｜心动能量树私人版 V2｜全量高保真
```

Expected: a design `file_key` and `file_url`; save both to `design/figma/state.json`.

- [x] **Step 4: Inspect the blank file and search libraries**

Call `use_figma` with `skillNames: "figma-use,figma-generate-library"` to list current pages, variables, styles, and components. Call `search_design_system` for `mobile button card input navigation`. Record whether reusable assets exist; do not depend on remote assets unless they fit the approved visual system.

### Task 2: Build Foundations and Documentation

- [x] **Step 1: Create the Starter-compatible page/Section structure**

Create and order the following 11 semantic Sections across 3 physical pages (`00 — System & Library`, `01 — Product Screens`, `02 — Delivery & Motion`):

```text
00 — Cover & Index
01 — Foundations
02 — Components
03 — Core / Girlfriend
04 — Core / Boyfriend
05 — Rewards & Garden
06 — Sponsor Operations
07 — Profile & Weekly Recap
08 — Dialogs & States
09 — Responsive & Motion
10 — Handoff Notes
```

- [x] **Step 2: Create variables and styles**

Create collections `Primitives`, `Semantic Color`, `Spacing`, `Radius`, and `Motion`. Bind colors, padding, gaps, radii, and strokes where the Plugin API permits. Create typography styles for Display, H1, H2, H3, Body, Body Small, Caption, and Amount XL; create Card and Overlay shadow styles.

- [x] **Step 3: Build cover and foundations boards**

Create a luxury cover, color swatches, typography specimen, spacing/radius examples, illustration principles, performance budget, accessibility guidance, and usage/do-not-use samples.

- [x] **Step 4: Validate foundations**

Validate from the creation result and state ledger. Expected: 3 physical pages, 11 semantic Sections, 5 variable collections, 8 text styles, at least 2 effect styles, and no duplicate foundation board names. Current result: 3 / 11 / 5 / 8 / 3.

### Task 3: Build the Shared Component Library

- [x] **Step 1: Create navigation and interaction primitives**

Create TopBar, TabBar, WeekSwitcher, Button, IconButton, Input, Textarea, Stepper, Switch, SegmentedControl, FilterChip, and Toast components with approved variants and at least 44×44 px hit areas.

- [x] **Step 2: Create content components**

Create Garden, Pearl, Midnight Ceremony, Amount, Milestone, Weekly Recap, Check-in, Reward, Redemption, Badge, Ledger Row, Timeline Row, Rule Row, Encouragement Editor, Garden Map Node, and Couple Crest components.

- [x] **Step 3: Create state and feedback components**

Create Loading Skeleton, Empty, Error, Offline, Permission Limited, Status Stamp, Love Confirm Dialog, Inline Notice, and Celebration Layer components.

- [x] **Step 4: Document the component catalog**

Arrange component sets on `02 — Components` with variant labels, usage notes, and performance/reduced-motion notes.

- [x] **Step 5: Validate components**

Expected: at least 30 reusable component/component-set roots, no variant matrix above 30 combinations, no overlapping variants, and no unbound repeated raw colors in core components.

### Task 4: Create Core Girlfriend Screens

- [x] **Step 1: Build `bind`**

Create the private garden invitation default screen and bind confirmation entry state at 390 px.

- [x] **Step 2: Build girlfriend `home`**

Create the hero, asset summary, today check-in CTA, encouragement, milestone, weekly recap, and four-item TabBar.

- [x] **Step 3: Build `checkin`**

Create form fields, duration controls, photo placeholder, privacy copy, submit state, and status summary.

- [x] **Step 4: Build `history`**

Create pressed botanical timeline groups and the cloud-photo permission-limited row.

- [ ] **Step 5: Perform visual check**

Capture each frame at maxDimension 1600. Verify hierarchy, Chinese typography, no overlapping, and no child outside the 390 px frame.

### Task 5: Create Rewards and Garden Screens

- [ ] **Step 1: Build `adventure-map`**

Create a vertically scrollable manor path with locked, current, completed, milestone, and final ceremony nodes.

- [ ] **Step 2: Build `wallet`**

Create three amount cards, withdrawal application form, non-payment notice, and transaction ledger.

- [ ] **Step 3: Build `shop`**

Create boutique header, balance summary, filters, and reward card grid with graceful one-column fallback.

- [ ] **Step 4: Build `reward-detail`**

Create gift story, redemption conditions, inventory, fulfillment copy, and bottom safe-area CTA.

- [ ] **Step 5: Build `redemptions`**

Create pending, redeemed, and canceled/refunded fulfillment cards.

- [ ] **Step 6: Perform visual check**

Capture all five frames and verify restraint of gold, list readability, and realistic content length.

### Task 6: Create Boyfriend Companion Screens

- [ ] **Step 1: Build boyfriend `home`**

Create growth summary, pending actions, encouragement CTA, and weekly recap entry without a check-in action.

- [ ] **Step 2: Build `sponsor-companion`**

Create metrics, encouragement editor, assets, profile links, and pending work summary.

- [ ] **Step 3: Build companion history, badges, ledgers, and redemptions**

Create four read-only screens with collection, club ledger, and fulfillment visual language.

- [ ] **Step 4: Perform visual check**

Verify role boundaries, warm supportive copy, long-list performance treatment, and consistent status semantics.

### Task 7: Create Sponsor Operations Screens

- [ ] **Step 1: Build `sponsor-review`**

Create pending review cards, compliment input, return reason, approve primary action, and photo limitation notice.

- [ ] **Step 2: Build `sponsor-payouts`**

Create grouped wish-fund applications and manual fulfillment controls without platform-payment imagery.

- [ ] **Step 3: Build `sponsor-rules`**

Create contract sections for base reward, daily cap, monthly fund, streak rewards, and map rewards.

- [ ] **Step 4: Build `admin-rewards`**

Create reward catalog management, edit state, separate publish switch, ordering, and destructive confirmation entry.

- [ ] **Step 5: Perform visual check**

Verify destructive actions are secondary, limits are legible, and controls do not resemble real financial payment UI.

### Task 8: Create Profile and Weekly Recap Screens

- [ ] **Step 1: Build `profile`**

Create Couple Crest, two identities, relationship state, role permissions, weekly recap, sound, edit profile, and role-aware entries.

- [ ] **Step 2: Build `profile-edit`**

Create image upload, nickname input, privacy guidance, dirty-state save, uploading, failure, and retry affordances.

- [ ] **Step 3: Build `weekly-recap`**

Create midnight cover, ivory content sections, best moment, metrics, encouragement, navigation, and role-aware opening copy.

- [ ] **Step 4: Perform visual check**

Verify the deep-blue surface remains an accent, personal data placeholders are generic, and the empty week remains emotionally safe.

### Task 9: Create Dialogs and Cross-Page States

- [ ] **Step 1: Create eight dialogs**

Create binding, check-in submit, review approve, review return, gift redemption, redemption cancellation/refund, wish-fund fulfillment, and milestone/gift/map celebration dialogs.

- [ ] **Step 2: Create eight state boards**

Create home skeleton, home offline, returned check-in, empty history, empty shop, empty review queue, empty weekly recap, and photo-permission-limited boards.

- [ ] **Step 3: Validate copy and action hierarchy**

Expected: every destructive or balance-changing dialog states the impact; every state provides either a recovery action or an explicit no-action explanation.

### Task 10: Add Responsive, Motion, and Prototype Handoff

- [ ] **Step 1: Create six responsive boards**

Create girlfriend home and sponsor review at 375, 390, and 430 px using the same component instances and constraints.

- [ ] **Step 2: Create two motion storyboard boards**

Document micro-interaction, content feedback, page enter, and ceremony motion with durations, easing, standard, low-performance, and reduce-motion variants.

- [ ] **Step 3: Link five prototype flows**

Link onboarding, girlfriend growth/reward, boyfriend support, weekly recap, and profile/settings flows. Use instant or 220–280 ms smart-animate transitions; ceremony transitions may use 600–900 ms and must stop.

- [ ] **Step 4: Build handoff index**

Add the 46-frame count, page map, component references, semantic tokens, performance budget, content constraints, and mini-program implementation notes to `10 — Handoff Notes`.

### Task 11: Validate and Deliver

- [ ] **Step 1: Run structural inventory**

Expected:

```text
3 physical Figma pages
11 named semantic Sections
46 named business frames
22 core screen frames
8 dialog frames
8 state frames
6 responsive frames
2 motion frames
>=30 reusable component/component-set roots
```

- [ ] **Step 2: Run overflow and text checks**

Find any visible node outside its parent screen bounds, clipped primary text, text smaller than 12 px, tap target below 44 px, or duplicate screen names. Fix each finding and rerun.

- [ ] **Step 3: Capture representative screenshots**

Save cover, foundations, components, girlfriend home, map, shop, boyfriend home, review, profile, weekly recap, dialogs, states, responsive, and motion previews under `outputs/figma/2026-07-10/`.

- [ ] **Step 4: Write the delivery report**

Create `outputs/figma/2026-07-10/delivery.md` with the Figma URL, file key, page/frame inventory, validation results, implementation notes, and any accepted Figma API limitations.

- [ ] **Step 5: Final verification**

Confirm the Figma URL opens, representative screenshots render, the structural validator passes, and no credentials or personal identifiers appear in local output.
