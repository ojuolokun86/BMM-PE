# Development Notes

## Project: BMM DEV V2 - WhatsApp Multi-Instance Bot

### Backend

- **User Authentication**
  - Registration and login endpoints using Express and Supabase.
  - Passwords are hashed with bcrypt.
  - Unique 6-digit `auth_id` generated for each user.
  - Duplicate email registration is handled gracefully.

- **Bot Deployment**
  - `/api/deploy-bot` endpoint accepts `authId`, `phoneNumber`, `country`, and `pairingMethod`.
  - Registration and deployment logic separated into `deployment.js`.
  - Registration flow emits QR code or pairing code to the frontend via **Socket.IO** (migrated from native WebSocket).
  - After successful registration, `startBmmBot` is called to start the user’s WhatsApp session.
  - Each user session is isolated and managed for performance and low memory usage.
  - Session directories are structured as `/sessions/{authId}/{phoneNumber}` to support multiple bots per user.

- **Socket.IO Integration**
  - Dedicated `socket.js` handles Socket.IO server setup and user/bot-specific event emission.
  - Live QR code, pairing code, and status updates are sent to the correct user/bot in real time.
  - Frontend registers each bot session with `{authId, phoneNumber}` for targeted event delivery.

- **Session Management**
  - Each user’s WhatsApp session uses its own folder for credentials.
  - On disconnect:
    - If reason is `badSession`, `loggedOut`, or `Failure`, the session is deleted and not restarted.
    - For other reasons (e.g., `connectionClosed`, `restartRequired`), the bot is automatically restarted.
  - Cleanup and error handling ensure unused sessions are closed and memory is freed.
  - On server startup, all existing sessions in the `/sessions` directory are auto-started.

### Frontend

- **Modern UI**
  - All pages use a unified, mobile-friendly, modern card-based design (`style.css`).
  - Responsive layouts for dashboard, login, register, and deploy pages.

- **Authentication**
  - Login and registration forms use email and password.
  - Session info (`authId`, `email`) is stored in `sessionStorage` for dashboard and deployment use.

- **Bot Deployment Page**
  - Custom country dropdown with flag, search, and code, populated from API or local JSON.
  - Phone number input is validated and formatted for WhatsApp (E.164, no `+`).
  - Pairing method selection (QR code or pairing code).
  - On deploy, the frontend connects to the backend via **Socket.IO** to receive live QR or pairing code and status updates.
  - Pairing code display is now styled with a glowing/shining effect and clear instructions for the user.

- **Socket.IO Client**
  - Each user connects to the backend Socket.IO server and registers their bot session.
  - UI updates in real time as registration progresses, showing QR or pairing code and status.

---

**All code is modular:**  
- CSS in `style.css`  
- JS per page (e.g., `deploy.js`)  
- Backend logic split by responsibility (auth, deployment, Socket.IO, bot session)

**Focus:**  
- Fast, scalable, and memory-efficient multi-user, multi-bot WhatsApp automation.

# Development Notes (Latest Updates - 2025-09-12)

## Version 2.4.3 Updates

### Backend Improvements
- **Package Updates**
  - Upgraded to `@whiskeysockets/baileys@6.7.19` for improved stability
  - Updated `@supabase/supabase-js` to v2.57.2 with enhanced error handling
  - Added `moment-timezone` for better timezone management

- **Session Management**
  - Enhanced session restoration with better error recovery
  - Improved cleanup of stale sessions
  - Added support for multiple bot instances per user with isolated sessions

- **Deployment**
  - Added GitHub Actions workflow for automated deployment to Azure
  - Improved environment variable handling with `.env` validation
  - Added version tracking in `package.json`

### Frontend Updates
- **UI/UX**
  - Added loading states for bot deployment
  - Improved error messages and user feedback
  - Enhanced mobile responsiveness

- **Authentication**
  - Added session timeout handling
  - Improved security with token refresh mechanism
  - Better error handling for expired sessions

### New Features
- **Bot Management**
  - Added ability to restart individual bot instances
  - Improved bot status monitoring
  - Added detailed logging for debugging

- **Command System**
  - New settings command with detailed bot information
  - Improved error handling for commands
  - Added rate limiting for commands

### Bug Fixes
- Fixed memory leaks in long-running sessions
- Resolved issues with session restoration after disconnection
- Fixed command parsing for special characters
- Addressed security vulnerabilities in dependencies

---

# Development Notes (Day 2)

## Project: BMM DEV V2 - WhatsApp Multi-Instance Bot

---

### Backend

- **Session Persistence**
  - Switched from file-based sessions to a single SQLite database (`sessions.db`) using `better-sqlite3`.
  - All WhatsApp session credentials and keys are stored and loaded from the database.
  - On startup, all sessions in the database are loaded and bots are started automatically.

- **Bot Lifecycle**
  - `startBmmBot` loads session from SQLite and starts a Baileys socket for each bot.
  - Robust disconnect handling:
    - If disconnect reason is `badSession`, `loggedOut`, `Failure`, or custom code `405`, the session is deleted from SQLite and not restarted.
    - For other disconnect reasons (`connectionClosed`, `restartRequired`, etc.), the bot is automatically restarted.
  - Each bot instance is tracked in a `sessions` map for fast access and cleanup.
  - `deleteBmmBot` and `stopBmmBot` handle session removal and cleanup.

- **Message Handling**
  - All incoming messages are routed through a central `handleMessage` function.
  - Features include anti-link detection (`antiLink.js`) and command handling (`commandHandler.js`).
  - Commands like `.ping` and `.echo` are supported.

- **Bot Manager**
  - `botManager.js` tracks all active bot instances by phone number for easy management.

- **Startup Logic**
  - On server start, the app ensures the `database` directory exists, then loads all sessions from SQLite and starts bots for each.

---

### Frontend

- **Modern UI**
  - Stylish, mobile-friendly input fields for login and registration.
  - Consistent card-based design across all pages.
  - Pairing code display is glowing and easy to read.

- **Authentication**
  - Login and registration forms use email and password.
  - Session info (`authId`, `email`) is stored in `sessionStorage` for dashboard and deployment use.

- **Bot Deployment**
  - Users can deploy bots by providing phone number and pairing method (QR or pairing code).
  - Frontend receives live QR or pairing code and status updates via Socket.IO.

---

### Infrastructure

- **Socket.IO**
  - Real-time communication for registration, QR/pairing code, and status updates.
  - CORS is configured for both REST and Socket.IO endpoints.

- **Docker/Deployment**
  - `.env` and Dockerfile setup for environment variables and deployment.
  - Ensures database directory exists before SQLite is used.

---

**Summary:**  
- All session data is now in SQLite for reliability and speed.
- Bots auto-load from the database on startup.
- Codebase is modular, robust, and ready for multi-user, multi-bot scaling.

# Development Notes (Day 3)

## What We Have Done (Not Yet in Dev Note)

---

### BMM Manager (Load Manager Layer)

- **Built a BMM Manager (middleware/proxy) between frontend and backend bot servers.**
  - Proxies all REST API and Socket.IO traffic.
  - Handles room-based event routing for QR and pairing codes.
  - Caches last QR/pairing code per session for reliable delivery.
  - Health monitoring for backend bot servers (HTTP and Socket.IO checks).
  - Load balancing logic for assigning users/bots to backend servers.

- **Socket.IO Event Delivery**
  - Ensures frontend joins the correct session room (`authId:phoneNumber`) before deployment.
  - LM receives backend events (`backend-event`) and emits to the correct frontend room.
  - Added detailed logging for all event flows (backend → LM → frontend).
  - Fixed race condition where frontend missed events by joining room before deploy.

- **Frontend Improvements**
  - Dashboard lists all bots for the logged-in user, each clickable to view details.
  - Added `bot.html` and `bot.js` for per-bot info display.
  - Improved error handling and user feedback for deploy and registration flows.
  - Ensured session info (`authId`, `email`) is always stored and used for API calls and Socket.IO.

- **Backend Improvements**
  - All backend event emissions (`emitToBot`) now include both `authId` and `phoneNumber` for precise routing.
  - Unified event naming and payload structure for QR, pairing code, and status.
  - Added logs for every emission and event received by LM.

- **Reliability**
  - Fixed all issues where QR/pairing code was not delivered to frontend.
  - Ensured frontend always joins the room before backend emits events.
  - Added caching and replay of last QR/pairing code on reconnect.

---

### Summary

- **BMM Manager** now reliably proxies and delivers all bot events to the correct frontend session.
- **Frontend** and **backend** are fully decoupled and communicate only via the manager.
- **All event delivery is robust, race-condition free, and logged for debugging.**
- **User experience:** Bots are listed, deploy is reliable, and QR/pairing code always displays correctly.

# Development Notes (Day 4+)

## Recent Updates (Not Yet in Dev Note)

---

### Admin Features

- **Admin Dashboard**
  - Admin can view all registered users, including their email, auth ID, subscription level, and days left.
  - Clicking a user shows all bots associated with that user's auth ID.
  - Admin can restart or delete any bot for any user directly from the admin interface.
  - All admin API routes are now separated into `adminApi.js` for better structure.

- **Admin Bot Management**
  - `/api/admin/bots/:authId` returns all bots for a given user.
  - Admin can restart or delete individual bots for any user from the UI.
  - Actions are proxied through the manager and routed to the correct backend server.

---

### User & Bot Management

- **Per-Bot Actions**
  - Users and admins can restart or delete any bot instance.
  - Deleting a bot removes all related session info from SQLite, Supabase, and the users table.
  - Restarting a bot sends a WhatsApp message indicating if the restart was user-initiated (from web) or automatic.

- **Subscription Enforcement**
  - Bot deployment checks subscription level and days left (from Supabase) before allowing deploy.
  - Enforces per-subscription bot limits and subscription expiration.
  - User receives clear error/status messages if limits are reached or subscription is expired.

---

### UI/UX Improvements

- **Mobile-First Responsive Design**
  - All pages (dashboard, deploy, admin, user list, bot info) are now highly mobile-friendly.
  - Improved button, card, and modal layouts for small screens.
  - Table and list views adapt to mobile with better spacing and font sizes.

- **Bot Info Page**
  - Each bot has a dedicated info/settings page (`bot.html`), with restart and delete actions.
  - Settings (mode, prefix) can be edited per bot.

- **Admin User Info Page**
  - Admin can see all bots for a user and perform actions per bot.

---

### Backend & Infrastructure

- **API Gateway/Manager**
  - All admin routes moved to `adminApi.js`.
  - User and bot routes remain in `api.js`.
  - Manager proxies all REST and Socket.IO traffic, including admin actions.

- **Session Management**
  - All session and bot actions are routed through the manager for multi-server support.
  - SQLite remains the source of truth for sessions, with regular sync to Supabase.

- **Antilink & Group Features**
  - Antilink settings and warnings are stored in SQLite for persistence.
  - Admins can configure anti-link protection, warn limits, and admin bypass per group.

---

### Miscellaneous

- **Menu Command**
  - New, emoji-rich, modern menu for all commands, grouped by category.
  - Usage instructions and owner-only command notes included.

- **Error Handling**
  - Improved error messages and defensive checks throughout backend and frontend.
  - All unhandled promise rejections and exceptions are logged.

---

# Development Notes (Recent Features)

## WhatsApp Bot Features (BMM DEV V2)

### New Features & Improvements

- **Status View Automation**
  - Per-user status view mode: Off, View Only, View & React.
  - Bot auto-views and reacts to statuses with random emoji.
  - Settings saved in user table and configurable via `.status` command.

- **Welcome/Goodbye Messages**
  - Per-group welcome/goodbye settings.
  - Rich, customizable welcome and goodbye messages.
  - Settings stored in `welcome_settings` table, configurable via `.welcome` command.

- **View-Once Media Repost**
  - Detects and reposts view-once media (image, video, audio, document, voice).
  - `.vv` command reposts to current chat; `.view` sends to owner's DM.
  - Deep sender detection ensures correct user is mentioned.

- **Antidelete & Antilink**
  - Per-group and per-bot settings for antidelete and antilink.
  - Owner-only configuration menus.
  - Warn, remove, and restore logic for deleted messages and links.

- **Menu Command**
  - Modern, emoji-rich menu with numeric and command mapping.
  - All features accessible via reply or command name.

- **Settings Command**
  - Shows all bot, group, and feature settings in a readable format.
  - Includes status view, welcome/goodbye, antilink, antidelete, and owner info.

- **Multi-Instance & Subscription**
  - SQLite and Supabase session sync for multi-bot, multi-user support.
  - Subscription enforcement and bot limits per user.

- **Admin Dashboard**
  - Admin can view, restart, and delete any bot.
  - All actions routed through Socket.IO and manager layer.

---

**Summary:**  
All features are modular, persistent, and owner-configurable.  
Bot supports advanced automation, group management, and media handling for WhatsApp....

# Development Notes

## Project: BMM DEV V2 - WhatsApp Multi-Instance Bot

---

### Backend

- **User Authentication**
  - Registration and login endpoints using Express and Supabase.
  - Passwords are hashed with bcrypt.
  - Unique 6-digit `auth_id` generated for each user.
  - Duplicate email registration is handled gracefully.

- **Bot Deployment & Session Management**
  - `/api/deploy-bot` endpoint accepts `authId`, `phoneNumber`, `country`, and `pairingMethod`.
  - Registration and deployment logic separated into `deployment.js`.
  - Registration flow emits QR code or pairing code to the frontend via **Socket.IO**.
  - Each user session is isolated and managed for performance and low memory usage.
  - Session directories: `/sessions/{authId}/{phoneNumber}` to support multiple bots per user.
  - On disconnect:
    - If reason is `badSession`, `loggedOut`, or `Failure`, the session is deleted and not restarted.
    - For other reasons (e.g., `connectionClosed`, `restartRequired`), the bot is automatically restarted.
  - Session persistence with SQLite (local) and Supabase (cloud).

- **Socket.IO Integration**
  - Dedicated `socket.js` handles Socket.IO server setup and user/bot-specific event emission.
  - Live QR code, pairing code, and status updates are sent to the correct user/bot in real time.
  - Frontend registers each bot session with `{authId, phoneNumber}` for targeted event delivery.

---

### Command System & Menu

- **Modular Command Handlers**
  - All commands are modularized in [/handler/command/](cci:7://file:///e:/Bot%20development/BOT%20V2/BMM%20DEV%20V2/src/handler/command:0:0-0:0).
  - Dynamic menu and help system with reply-number mapping for WhatsApp-friendly UX.
  - Commands are grouped: Core, Moderation, Group Controls, Fun & Media.
  - Command aliases and subcommands supported (e.g. `.group stats`, `.group revoke`).

- **Menu & Help**
  - WhatsApp-friendly menu with emoji, reply numbers, and clear grouping.
  - `.menu` and `.help` commands show all commands and their descriptions.
  - One-to-one mapping between reply numbers and commands for quick access.

- **Emoji Reactions**
  - Centralized emoji mapping in [features/commandEmoji.js](cci:7://file:///e:/Bot%20development/BOT%20V2/BMM%20DEV%20V2/src/handler/features/commandEmoji.js:0:0-0:0) for all commands.
  - Bot reacts with the correct emoji for known commands, and a random fun emoji for unknown/undefined commands.
  - Emoji reactions are used both in menu/help and as feedback to user commands.

- **Error Handling & UX**
  - Consistent user feedback for all command actions (success, error, permission).
  - Permission checks for admin/owner commands (e.g., group desc, pic, link, revoke).
  - Fallback/random emoji reactions for unknown commands to enhance UX.

---

### Group & Stats Features

- **Group Management**
  - Group subcommands: `.group stats`, `.group revoke`, `.group desc`, `.group pic`, etc.
  - Group stats command provides detailed 30-day activity, top members, and owner/group info.
  - Group invite link revoke and refresh via `.group revoke`.
  - Improved admin checks for sensitive group actions.

---

### Frontend & Management

- **Web Dashboard**
  - Shows live bot status, group stats, and command usage.
  - Real-time updates for QR/pairing, session status, and group events via Socket.IO.
  - User-friendly menu and help documentation accessible from WhatsApp and the dashboard.

---

### Deployment & Architecture

- **Tech Stack**
  - Node.js backend with modular handlers.
  - SQLite for local, Supabase for cloud session/data.
  - Socket.IO for real-time frontend/backend sync.
  - Docker and Fly.io deployment ready.

---

### Miscellaneous

- **Consistent Code Organization**
  - All utility functions in `/utils/`.
  - Database operations in `/database/`.
  - Feature handlers in `/handler/features/`.

- **Extensibility**
  - Easy to add new commands, features, and integrations due to modular design.

---

_Last updated: 2025-07-30_