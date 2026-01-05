# Shochan AI - Web UI

Next.js-based frontend for Shochan AI task management chat interface.

## Tech Stack

- **Next.js** 16.1.1 (App Router)
- **React** 19.2.3
- **TypeScript** 5.x
- **Tailwind CSS** 4.x
- **ESLint** 9.x

## Getting Started

Install dependencies (if not already installed):

```bash
pnpm install
```

Set up environment variables:

```bash
cp .env.example .env.local
# Edit .env.local with your backend API URL
```

Run the development server:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser.

## Available Scripts

- `pnpm dev` - Start development server
- `pnpm build` - Build for production
- `pnpm start` - Start production server
- `pnpm lint` - Run ESLint

## Project Structure

```
packages/web-ui/
├── app/                 # Next.js App Router pages
│   ├── layout.tsx      # Root layout
│   ├── page.tsx        # Home page
│   └── globals.css     # Global styles
├── public/             # Static assets
├── .env.local          # Environment variables (not committed)
├── .env.example        # Environment variable template
└── tsconfig.json       # TypeScript configuration
```

## Environment Variables

- `NEXT_PUBLIC_API_URL` - Express API base URL (client-side exposed, defaults to `http://localhost:3001`)
- `NEXT_PUBLIC_STREAM_URL` - SSE streaming endpoint URL (client-side exposed)

Note: Since the backend API has CORS enabled, we call it directly from the client-side. No BFF (Backend for Frontend) pattern is needed.
