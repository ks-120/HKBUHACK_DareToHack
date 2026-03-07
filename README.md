# 🎓 BuddyUp — HKBU Campus Companion

> **Connect. Study. Belong.**  
> A smart campus social platform built for HKBU students — find compatible study partners, discover events, chat in real time, and get instant answers about campus life from an AI assistant.

Built at **BUHack 2026** by team **DareToHack**.

🌐 **Live app:** [https://daretohack.web.app](https://daretohack.web.app)

---

## 🔍 Problem Statement

Starting university — especially in a new city or country — can be isolating. Students at HKBU often struggle to:

- Find study partners with compatible schedules and working styles
- Discover what's happening on campus beyond official announcements
- Connect with peers who share the same interests and goals
- Get quick answers about campus facilities, admin processes, and services

Existing solutions (WhatsApp group chats, notice boards, Facebook groups) are fragmented, noisy, and rely entirely on luck. There is no structured way for students to find *the right* people.

**BuddyUp solves this** by combining a data-driven compatibility engine, real-time messaging, a social feed, campus event discovery, and an AI chatbot — all in one app built specifically for the HKBU community.

---

## ✨ Key Features

### 🤝 Smart Buddy Matching
Fill in your profile once and get ranked compatibility matches with other students. The algorithm scores across four weighted dimensions — **interests (35%), personality (25%), buddy goals (20%), and study style (20%)** — using cosine vector similarity and a collaborative-filtering re-ranker. Each match card shows a transparent breakdown so you can see exactly *why* someone is a good fit, then jump straight into a chat.

### 💬 Real-time 1-on-1 Chat
Direct messaging with your matches, powered by Firestore. Messages sync instantly, and unread counts are tracked per conversation.

### 📬 Inbox
All active conversations in one place — unread badges, latest message previews, and one-tap access to jump back into any chat.

### 🎉 Campus Events
Two tabs: **Official** HKBU events (auto-scraped from the university website via a Python script) and **Student-created** events. Any logged-in student can post an event with a title, date, time, location, and emoji. RSVP tracking is built in; event creators can edit or delete their own posts.

### 📰 Social Feed & Communities
A Reddit-style community board for sharing updates, tips, and questions. Supports post tags (Study, Event, Housing, Food, etc.), upvotes/downvotes, comments, and sortable feeds. Community rooms give student groups their own dedicated space.

### 🤖 HKBUChat AI Assistant
A full-page AI chat interface (plus a floating widget) powered by the **HKBU GenAI Platform (GPT-4.1)**. Pre-trained context covers campus facilities, canteens, the library, health centre, counselling, course registration, exam schedules — the things you'd normally spend 20 minutes hunting for.

### 👤 Profile & Settings
Upload a profile photo (Firebase Storage), set a nickname, pick interests, describe study habits, configure personality traits via sliders, and set buddy preferences. Everything feeds into the match algorithm. Supports **light / dark mode** with persistent user preference.

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript + Vite |
| Routing | React Router v6 |
| Auth | Firebase Authentication (email/password) |
| Database | Firebase Firestore (real-time) |
| File Storage | Firebase Storage (profile photos) |
| Hosting | Firebase Hosting |
| AI Chatbot | HKBU GenAI Platform — GPT-4.1 |
| Event Scraping | Python 3 (`requests` + `beautifulsoup4` + `firebase-admin`) |
| Styling | CSS Modules (dark/light theme via CSS custom properties) |
| Backend Functions | Cloudflare Worker (`cf-worker/`) · Firebase Functions (`functions/`) |

---

## 📁 Project Structure

```
BUHACK-DareToHack/
├── hkbu-web/                  # Main frontend application
│   ├── index.html
│   ├── vite.config.ts
│   ├── firebase.json          # Firebase Hosting config
│   ├── .firebaserc            # Firebase project aliases
│   └── src/
│       ├── App.tsx            # Root router + auth guard + theme toggle
│       ├── index.css          # Global CSS custom properties (light/dark)
│       ├── components/
│       │   ├── AppLayout.tsx       # Sidebar shell wrapping all protected routes
│       │   ├── Sidebar.tsx         # Navigation sidebar
│       │   ├── HKBUChatBot.tsx     # Floating + sidebar AI chat widget
│       │   └── AvatarUpload.tsx    # Profile photo uploader
│       ├── pages/
│       │   ├── WelcomePage.tsx     # Landing / onboarding splash
│       │   ├── SignUpPage.tsx      # Multi-step sign-up wizard
│       │   ├── LoginPage.tsx       # Email/password login
│       │   ├── MainPage.tsx        # Home dashboard
│       │   ├── MatchPage.tsx       # Buddy matching results
│       │   ├── EventsPage.tsx      # Campus events (official + student)
│       │   ├── FeedPage.tsx        # Social feed + community browser
│       │   ├── CommunityRoomPage.tsx # Per-community discussion room
│       │   ├── InboxPage.tsx       # Conversations list
│       │   ├── ChatPage.tsx        # 1-on-1 real-time chat
│       │   ├── AIChatPage.tsx      # Full-page AI assistant
│       │   ├── ProfilePage.tsx     # View / edit profile
│       │   └── SettingsPage.tsx    # App settings
│       ├── config/
│       │   └── firebaseConfig.ts   # Firebase initialisation
│       ├── utils/
│       │   └── matchAlgorithm.ts   # Cosine similarity + CF re-ranker
│       └── types/
│           └── index.ts            # Shared TypeScript interfaces
│
├── scripts/
│   └── scrape_events.py       # Scrapes HKBU website → writes to Firestore
│
├── functions/
│   └── index.js               # Firebase Cloud Functions
│
└── cf-worker/
    └── index.js               # Cloudflare Worker (AI proxy)
```

---

## 🚀 Setup & Run Instructions

### Prerequisites

- **Node.js** 18+ and **npm**
- **Python** 3.9+ (for event scraping only)
- A **Firebase project** with the following enabled:
  - Authentication (Email/Password provider)
  - Firestore Database
  - Storage
- An **HKBU GenAI Platform** API key (for the AI chatbot)

---

### 1. Clone the repository

```bash
git clone https://github.com/ks-120/HKBUHACK_DareToHack.git
cd BUHACK-DareToHack/hkbu-web
```

### 2. Install dependencies

```bash
npm install
```

### 3. API Setup

#### 🔥 Firebase
1. Go to [https://console.firebase.google.com](https://console.firebase.google.com) and create a new project
2. Enable **Authentication** → Sign-in method → **Email/Password**
3. Enable **Firestore Database** → Start in production mode
4. Enable **Storage** → Start in production mode
5. Go to **Project Settings** → **Your Apps** → click **Web app** (`</>`)
6. Register the app and copy the config values — you will need:
   - `apiKey`, `authDomain`, `projectId`, `storageBucket`, `messagingSenderId`, `appId`, `measurementId`

#### 🤖 HKBU GenAI Platform
1. Go to [https://genai.hkbu.edu.hk](https://genai.hkbu.edu.hk) and log in with your HKBU account
2. Navigate to **API Keys** and generate a new key
3. Copy the key — this is your `VITE_HKBU_GENAI_API_KEY`
4. Recommended model: `gpt-4.1`

---

### 4. Configure environment variables

Create a `.env` file in `hkbu-web/`:

```bash
cp .env.example .env
```

Then fill in your values:

```env
# Firebase (from Firebase Console → Project Settings → Your Apps)
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id

# HKBU GenAI Platform (from https://genai.hkbu.edu.hk)
VITE_HKBU_GENAI_API_KEY=your_genai_key
VITE_HKBU_GENAI_MODEL=gpt-4.1
```

### 5. Start the development server

```bash
npm run dev
```

The app will be available at `http://localhost:5173`.

### 6. Build for production

```bash
npm run build
```

### 7. Deploy to Firebase Hosting

```bash
npm run deploy
```

This runs `tsc && vite build` then deploys the `dist/` folder to Firebase Hosting automatically.

---

### (Optional) Scrape Official HKBU Events

1. Go to [Firebase Console](https://console.firebase.google.com) → **Project Settings** → **Service accounts** → **Generate new private key**
2. Save the downloaded JSON file as `scripts/serviceAccountKey.json`
3. Run the scraper:

```bash
cd scripts
pip install -r requirements.txt
python scrape_events.py
```

This pulls events from the HKBU website and writes them into the `events` Firestore collection with `source: "official"`.

---

## 🧠 How the Match Algorithm Works

Each user profile stores: interests, study styles, buddy goals, and four personality sliders (introvert–extrovert, planned–spontaneous, deep talks–small talk, optimistic–realistic).

When you open the Match page the app:

1. **Fetches all other user profiles** from Firestore.
2. **Computes a content-based score** per candidate using weighted cosine similarity across the four dimensions (interests 35%, personality 25%, buddy goals 20%, study style 20%).
3. **Applies a must-have multiplier** (±40%) if the user specified hard requirements like "same faculty" or "shared hobbies".
4. **Builds a full feature matrix** (all users × all dimensions) and computes a **collaborative-filtering score** — finding users whose overall feature vector is nearest to yours in the full space.
5. **Blends** content score (70%) and CF score (30%), then **min-max normalises** the final scores so the output always spans [0 → 1].
6. Filters out matches below 30% and **sorts highest-to-lowest**.

The score breakdown is shown on every match card so it never feels like a black box.

---

## 👥 Team
**DareToHack** @ BUHack 2026  
Chung Ka Shing — HKBU
Wong Tsin Tsin — HKBU
Ma Hiu Kei — HKBU
Ng Yat Long — HKBU
Chan Tung Shing — HKBU

---

## 📄 License

MIT

## 🤖 AI Declaration

This project was built primarily by the team, with minimal AI assistance. We declare the following:

- **GitHub Copilot** was occasionally used for boilerplate code suggestions (e.g. repetitive CSS and TypeScript type definitions), all of which were manually reviewed and rewritten to fit our needs.
- **HKBU GenAI Platform (GPT-4.1)** is integrated as a **product feature** (the HKBUChat assistant) — it was not used as a development tool for writing the application code. 

No AI tool was used to generate the project idea.
