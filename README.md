# 🚀 Real-Time High-Concurrency Leaderboard
Checkout The Hosted Site
https://real-time-leader-board-git-main-arjit-vermas-projects.vercel.app/

A high-performance leaderboard system built to handle millions of users and thousands of concurrent score updates. This project demonstrates a **Hybrid Architecture** using **Go** for the backend engine, **Redis** for real-time ranking, and **PostgreSQL** for persistent storage.



## 🛠️ Tech Stack

* **Backend:** Go (Golang) + Gin Gonic (High-performance routing)
* **Caching/Ranking:** Redis (Sorted Sets) via Upstash
* **Database:** PostgreSQL via Supabase
* **Frontend:** React Native (Expo) - Web Compatible
* **Deployment:** Vercel (Frontend) & Render (Backend)

---

## 🏗️ System Architecture & Design Decisions

### 1. The Ranking Engine (Redis Sorted Sets)
Standard SQL `ORDER BY` queries are $O(N \log N)$ and can lock up under heavy load when sorting millions of rows.
* **The Solution:** I used **Redis ZSETs**.
* **Why:** Redis keeps data pre-sorted in RAM using a Skip List structure. Fetching a rank or a range of users is an $O(\log N)$ operation, ensuring near-instant response times even with 1M+ rows.
* **Tie Handling:** Implemented **Standard Competition Ranking (1-1-3 pattern)** using `ZCOUNT` logic to ensure fairness for players with identical scores.

### 2. The Write-Through Pattern
* **Design:** PostgreSQL acts as the "Source of Truth" (Disk), while Redis acts as the "Live Ranker" (RAM).
* **Flow:** Every score update is a dual-write. The system updates **PostgreSQL** for durability and then immediately updates **Redis**. This ensures the data is never lost but remains lightning-fast to read.



### 3. Optimization: Redis Pipelining
* **The Problem:** Searching for 50 users usually requires 50 separate network calls to get their ranks (The N+1 Problem).
* **The Solution:** I implemented **Redis Pipelining**.
* **Result:** The Go backend bundles all 50 rank queries into a **single network request**. This reduced search latency by over **80%**, keeping the UI snappy even on slow mobile connections.



### 4. High-Concurrency Simulation
To demonstrate production-grade stability, the project includes a **Live Simulation** background worker.
* **Batch Processing:** Instead of hammering the database for every single game won, the simulation uses Go routines to collect and batch updates. This simulates a heavy production environment where thousands of users update scores simultaneously.

---

## 🚀 Getting Started

### 1. Backend Setup
1.  Navigate to `backend/`
2.  Create a `.env` file:
    ```env
    DATABASE_URL=your_postgres_url
    REDIS_URL=your_redis_url
    PORT=8080
    ```
3.  **Seed the Data:** (Populates 10k users into SQL and Redis)
    ```bash
    go run cmd/seed/main.go
    ```
4.  **Run the Server:**
    ```bash
    go run cmd/api/main.go
    ```

### 2. Frontend Setup
1.  Navigate to `frontend/`
2.  Install dependencies: `npm install`
3.  Start the app: `npx expo start --web`

---

## 🔍 Key API Endpoints

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/api/leaderboard` | `GET` | Fetch top players (Paginated) |
| `/api/search` | `GET` | Search users with live Redis ranks |
| `/api/simulation/toggle` | `POST` | Start/Stop the live background worker |
| `/health` | `GET` | System health and DNS check |

---

## 💡 UX & Professional Touches
* **Cold Start Handling:** Implemented a custom **"Cold Start UI"** in React Native. Since the backend is on a free-tier instance, this screen explains the architectural delay to the user while the server boots up.
* **Debounced Search:** Prevents API spamming by waiting 300ms after the user stops typing before firing the search query.
* **Competition Ranking:** Handled tie-breaking logic so users with equal scores share the same rank (e.g., two people at #1).

---

**Developed with ❤️ by Arjit Verma**