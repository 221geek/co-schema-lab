# CoSchemaLab v1.0.0

**Collaborative Database Schema Designer**

Design database schemas with your team in real time. Create tables, define relationships, and export to SQL or JSON with generated test data.

---

## Highlights

- **Schema designer** – Tables with columns (UUID, String, Money, Enum, Relation), relationships (1:1, 1:N, M:N), inline editing, and relationship badges
- **Real-time collaboration** – Live sync via Firestore, presence, and remote cursors
- **Import** – SQL scripts or JSON (paste or drag & drop)
- **Export** – SQL, JSON, Prisma, TypeORM, with optional fake data via Faker.js
- **Templates** – Pre-built schemas (e.g. E-commerce, Blog) with auto-layout
- **Multi-select** – Ctrl+click and marquee selection to move several tables at once
- **Zoom & pan** – Navigate large schemas (Ctrl/Cmd + scroll)
- **Undo** – Ctrl/Cmd + Z
- **Auth** – Firebase (login, signup) and link sharing for collaborators

---

## Try it

**[co-schema-lab.abdoulazizdione.dev](https://co-schema-lab.abdoulazizdione.dev)**

---

## Tech stack

- **Angular 20** – Framework
- **Firebase** – Auth, Firestore, presence
- **Tailwind CSS** – Styling
- **Faker.js** – Data generation
- **Angular CDK** – Drag & drop

---

*First public release. MIT licensed. Contributions welcome.*
