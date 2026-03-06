# 🎓 HKBU BuddyUp

> A campus social app built for HKBU students — find study partners, discover events, and actually enjoy uni life.

Built at **Dare to Hack 2026** by a team of HKBU students who were tired of feeling lost on campus and wanted to do something about it.

---

## What is this?

BuddyUp is a web app that helps HKBU students connect with each other based on real compatibility — not just who happens to sit next to you in lecture. You fill out your profile once (interests, study style, personality, faculty, goals), and the app quietly does the work of finding people you'd actually get along with.

On top of matching, there's a shared events board, a real-time chat, a social feed, and an AI assistant that knows HKBU campus life inside out.

---

## Features

### 🤝 Smart Buddy Matching
Fill in your profile and get ranked matches with other students. The algorithm scores compatibility across six dimensions — shared interests, study style, personality type, buddy goals, location preference, and faculty. Each match card shows a breakdown so you can see exactly *why* someone is a good fit, then jump straight into a chat with them.

### 💬 Real-time Chat
One-on-one messaging with your matches. Messages sync instantly via Firebase, and unread counts are tracked per conversation so nothing slips through the cracks.

### 📬 Inbox
See all your active conversations in one place. Unread badges, latest message previews, and quick access to jump back into any chat.

### 🎉 Campus Events
Two tabs — official HKBU events (scraped automatically from the university website) and student-created events. Any logged-in student can post their own event with a title, date, time, location, and emoji. RSVP tracking is built in. Event creators can edit or delete their own posts.

### 📰 Social Feed
A simple community board where students can share updates, tips, or just say hi. Think of it as a lightweight campus notice board.

### 🤖 HKBUChat AI Assistant
A floating chat widget powered by the HKBU GenAI Platform (GPT-4.1). It knows about campus facilities, canteens, the library, health centre, counselling services, course registration, exam schedules — the things you'd normally have to hunt down yourself.

### 👤 Profile & Settings
Upload a profile photo, set your nickname, pick your interests, describe your study habits, and configure what kind of buddy you're looking for. Everything feeds into the match algorithm.

---

## Tech Stack

| Layer | What we used |
|---|---|
| Frontend | React 18 + TypeScript + Vite |
| Routing | React Router v6 |
| Backend / DB | Firebase (Auth, Firestore, Storage) |
| AI Chatbot | HKBU GenAI Platform (GPT-4.1) |
| Event Scraping | Python (`scripts/scrape_events.py`) |
| Styling | CSS Modules |

---

## Project Structure

```
hkbu-web/
├── src/
│   ├── components/      # Sidebar, AppLayout, ChatBot, AvatarUpload
│   ├── pages/           # One file per route (Match, Events, Feed, Chat…)
│   ├── config/          # Firebase setup
│   ├── utils/           # Match scoring algorithm
│   └── types/           # Shared TypeScript types
scripts/
└── scrape_events.py     # Pulls official HKBU events into Firestore
```

---

## Getting Started

### Prerequisites
- Node.js 18+
- A Firebase project with Auth, Firestore, and Storage enabled
- An HKBU GenAI Platform API key (for the chatbot)

### Setup

```bash
# 1. Install dependencies
cd hkbu-web
npm install

# 2. Create your environment file
cp .env.example .env
# Then fill in your Firebase and HKBU GenAI keys

# 3. Start the dev server
npm run dev
```

### Environment Variables

```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...

VITE_HKBU_GENAI_API_KEY=...
VITE_HKBU_GENAI_MODEL=gpt-4.1
```

### Scraping Official Events

```bash
cd scripts
pip install firebase-admin requests beautifulsoup4
python scrape_events.py
```

This pulls events from the HKBU website and writes them into the `events` Firestore collection with `source: "official"`.

---

## How the Match Algorithm Works

Each user profile has fields for interests, study styles, personality tags, buddy goals, preferred location, and faculty. When you open the Match page, the app fetches all other user profiles and scores each one against yours using weighted partial matching across those six dimensions. The scores are combined into a single percentage and users are sorted highest-to-lowest.

The breakdown is shown on each match card so it never feels like a black box.

---

## Team

Made with way too much caffeine during Dare to Hack 2026 at HKBU. 🧃

---

## License

MIT