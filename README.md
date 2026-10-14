<div align="center">

# 🤖 TTPT Reminder Bot

**Automated Process Management, Homework Tracking, and Vocabulary Assistant for Telegram Groups**

[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare_Workers-F38020?style=for-the-badge&logo=cloudflare&logoColor=white)](https://workers.cloudflare.com/)
[![Telegram Bot API](https://img.shields.io/badge/Telegram_Bot_API-24A1DE?style=for-the-badge&logo=telegram&logoColor=white)](https://core.telegram.org/bots/api)
[![JavaScript](https://img.shields.io/badge/JavaScript-ES6+-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)

[Web Dashboard Direct Link](#-web-dashboard) • [Key Features](#-key-features) • [Deployment Setup](#-deployment--environment-setup) • [Bot Commands](#-bot-commands)

</div>

---

## 📌 Overview

**TTPT Reminder Bot** is a high-performance, serverless Telegram bot built on top of **Cloudflare Workers** and **Cloudflare KV Storage**. Designed specifically for study groups, classrooms, and project teams, it automates daily scheduled process reminders, weekly homework tracking, AI-powered English vocabulary lookups, and text-to-speech pronunciation generation.

It also features an embedded **Neumorphic Web Application** dashboard integrated with the Telegram Web App SDK for easy process management directly inside or outside Telegram.

---

## ✨ Key Features

- ⏰ **Multi-Process Cron Scheduler:** Configure automated scheduled reminders for target exam dates or project deadlines with daily countdowns (`Left Time`).
- 📚 **Weekly Homework Tracker:** Keep track of weekly subject assignments with automated weekly resets every Monday at 00:00 (Asia/Yangon time).
- 🎨 **Neumorphic Web Dashboard:** Manage all processes, dates, reminder times, and homework items via a clean, mobile-responsive web interface (`/web`).
- 📖 **AI Vocabulary Lookup:** Instant English word details (parts of speech, Myanmar translations, synonyms, and context sentences) powered by Coze AI.
- 🔊 **Text-To-Speech Pronunciation:** Listen to natural English audio pronunciation directly in group chats via `/listen [word]`.
- 🌍 **Timezone Aware:** Accurate execution synchronized with Myanmar Local Time (`Asia/Yangon` / UTC+6:30).

---

## 🛠️ Bot Commands

| Command | Description |
| :--- | :--- |
| `/start` | Welcome message and direct link to the Web Dashboard. |
| `/menu` | Displays all active processes, target date countdowns, and homework lists. |
| `/web` | Opens the Neumorphic Web Dashboard URL for managing group settings. |
| `/listen <word>` | Generates a voice message with the English pronunciation of the requested word or phrase. |
| `/vocab <word>` | Looks up deep linguistic breakdown and Myanmar translations for an English word. |
| `@bot_username <word>` | Mentioning the bot in a group chat triggers an automatic vocabulary lookup. |

---

## 📱 Web Dashboard

The built-in web dashboard provides a seamless UI for managing active processes in real time:

- **Neumorphic Design:** Modern soft-shadow UI optimized for dark/light contrast.
- **Dynamic Input Fields:** Update target dates, custom alert times (`07:00, 13:00, 19:00`), and weekly subjects on the fly.
- **Direct Telegram Sync:** Save changes straight into Cloudflare KV storage.

---

## 🚀 Deployment & Environment Setup

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/)
- A Telegram Bot Token from [@BotFather](https://t.me/BotFather)

### 1. Repository Setup

```bash
# Clone the repository
git clone [https://github.com/your-username/ttpt-reminder-bot.git](https://github.com/your-username/ttpt-reminder-bot.git)
cd ttpt-reminder-bot
```

### create by khantdev 
- tg acc - @ failedatkhant
- gmail - retriling123@gmail.com
