# CoSchemaLab

Collaborative web application for designing database schemas in real time. Create tables, define relationships (1:1, 1:N, M:N), and export your schema to SQL or JSON with generated test data.

**[Try it live](https://co-schema-lab.abdoulazizdione.dev)** · [Report a bug](https://github.com/your-username/CoSchemaLab_front/issues) · [Request a feature](https://github.com/your-username/CoSchemaLab_front/issues)

![Angular](https://img.shields.io/badge/Angular-20-DD0031?logo=angular)
![Firebase](https://img.shields.io/badge/Firebase-Firestore%20%7C%20Auth-FFCA28?logo=firebase)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-38B2AC?logo=tailwindcss)

---

> **Design your database schemas together, in real time.**  
> No more specs stuck in docs: draw together, share the link, and export in one click. From schema to SQL or JSON with test data — without leaving the browser.

---

## Features

### Schema designer
- **Tables**: Create tables with columns (UUID, String, Money, Enum, Relation)
- **Relationships**: Connect tables with connection points on each side
- **Cardinalities**: One-to-One (1:1), One-to-Many (1:N), Many-to-Many (M:N)
- **Direction**: Visualization of relationship direction (arrows + badges)
- **Inline editing**: Edit type and direction directly from the badge on the line

### Real-time collaboration
- Instant sync via Firestore
- Presence of connected collaborators
- Remote cursors on the canvas

### Export
- **SQL**: `CREATE TABLE` script + optional `INSERT` statements with data
- **JSON**: Schema (tables, relationships) + optional data
- **Fake data**: Generated via [Faker.js](https://fakerjs.dev/) (emails, names, prices, etc.)
- Configurable row count per table

### Other
- Zoom and pan on the canvas
- Undo (Ctrl/Cmd + Z)
- Link sharing to invite collaborators
- Firebase authentication (login, signup)

## Prerequisites

- Node.js 18+
- Firebase account

## Installation

```bash
# Clone the repository
git clone <repo-url>
cd CoSchemaLab_front

# Install dependencies
npm install --include=dev

# Configure Firebase (see section below)
```

## Firebase configuration

1. Create a project on [Firebase Console](https://console.firebase.google.com/)
2. Enable **Authentication** (Email/Password)
3. Create a **Firestore** database
4. Copy the configuration into `src/environments/environment.ts`:

```ts
export const environment = {
  production: false,
  firebase: {
    apiKey: '...',
    authDomain: '...',
    projectId: '...',
    storageBucket: '...',
    messagingSenderId: '...',
    appId: '...',
    measurementId: '...'
  }
};
```

5. Deploy Firestore rules: `firebase deploy --only firestore`

## Development

```bash
npm start
```

Opens [http://localhost:4200](http://localhost:4200).

## Build

```bash
npm run build
```

Output is generated in `dist/CoSchemaLab_front/`.

## Project structure

```
src/
├── app/
│   ├── models/          # Models (Table, Field, Relationship)
│   ├── pages/
│   │   ├── login/       # Login
│   │   ├── signup/      # Sign up
│   │   ├── boards/      # Board list
│   │   └── designer/    # Schema editor
│   └── services/
│       ├── auth.service.ts
│       └── board.service.ts  # Firestore, presence
├── environments/        # Firebase config
└── styles.scss
```

## Shortcuts

| Shortcut | Action |
|----------|--------|
| Ctrl/Cmd + Z | Undo |
| Escape | Cancel relationship creation |
| Scroll + Ctrl/Cmd | Zoom |

## Technologies

- **Angular 20** – Framework
- **Firebase** – Auth, Firestore, presence
- **Tailwind CSS** – Styling
- **@faker-js/faker** – Data generation
- **Angular CDK** – Drag & drop

## Contributing

Contributions are welcome! This is an open source project and we're looking for contributors. Feel free to:

- Open an [issue](https://github.com/your-username/CoSchemaLab_front/issues) for bugs or feature requests
- Submit a pull request
- Improve documentation

## License

MIT © [Abdoul Aziz Dione](https://abdoulazizdione.dev)

See [LICENSE](LICENSE) for details.
