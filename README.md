# 🗑️ Bin Reminder

A serverless AWS app that sends you a Telegram message every Sunday evening reminding you which bins to put out the next morning.

Built for **Ards & North Down Borough Council** but the architecture is easy to adapt for any council with an API.

```
Every Sunday 19:00 (Europe/London)
  → AWS Lambda runs
  → Calls council API
  → Sends Telegram message to your group
```

**Example message:**
```
♻️ Bin Reminder

Collection tomorrow:

🔵 Recycling bin

Date:
Monday 8 June
```

---

## What You Need

- An [AWS account](https://aws.amazon.com/free) (free tier is fine)
- [Node.js 22](https://nodejs.org) and npm
- [AWS CDK](https://docs.aws.amazon.com/cdk/latest/guide/getting_started.html): `npm install -g aws-cdk`
- [AWS CLI](https://aws.amazon.com/cli/) configured with your credentials
- A Telegram account

---

## Setup

### 1. Clone the repo

```bash
git clone https://github.com/c-mac1/binReminder.git
cd binReminder
npm install
```

### 2. Create a Telegram Bot

1. Open Telegram and message **@BotFather**
2. Send `/newbot` and follow the prompts
3. Copy the **bot token** you receive

Then find your **chat ID**:
1. Start a chat with your new bot and send it any message
2. Visit: `https://api.telegram.org/bot<YOUR_TOKEN>/getUpdates`
3. Find `"chat" → "id"` in the response

> **Tip:** Want multiple people to receive the message? Create a Telegram group, add your bot to it, send a message in the group, then use the group's chat ID (it will be a negative number).

### 3. Find Your UPRN

Your UPRN (Unique Property Reference Number) identifies your address in the council's system.

Find yours at [uprn.uk](https://uprn.uk) — search by postcode and select your address.

### 4. Configure Environment Variables

Create a `.env` file in the project root:

```
UPRN=your_uprn_here
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_CHAT_ID=your_chat_id_here
```

> `.env` is gitignored and will never be committed.

### 5. Bootstrap CDK (first time only)

```bash
cdk bootstrap
```

This creates the AWS resources CDK needs to deploy (S3 bucket for assets, IAM roles). Only needed once per AWS account/region.

### 6. Deploy

```bash
cdk deploy
```

### 7. Test It

Go to **AWS Console → Lambda**, find `BinReminderStack-BinReminderFunction`, open the **Test** tab, use `{}` as the event, and click **Test**. You should receive a Telegram message within a few seconds.

---

## CI/CD with GitHub Actions

The repo includes two workflows:

| Workflow | Trigger | What it does |
|---|---|---|
| `ci.yml` | Every push / PR | Runs tests and type checks |
| `deploy.yml` | Push to `main` | Deploys to AWS automatically |

To enable automatic deploys, add these secrets to your GitHub repo (Settings → Secrets and variables → Actions):

| Secret | Description |
|---|---|
| `AWS_ACCESS_KEY_ID` | Your AWS access key |
| `AWS_SECRET_ACCESS_KEY` | Your AWS secret key |
| `UPRN` | Your property UPRN |
| `TELEGRAM_BOT_TOKEN` | Your bot token from BotFather |
| `TELEGRAM_CHAT_ID` | Your Telegram chat or group ID |

---

## Schedule

The reminder fires every **Sunday at 19:00 Europe/London** (automatically handles GMT/BST). To change the schedule, edit `scheduleExpression` in [lib/bin_reminder-stack.ts](lib/bin_reminder-stack.ts).

Cron format: `cron(minute hour day-of-month month day-of-week year)`

---

## Tech Stack

| Technology | Purpose |
|---|---|
| AWS Lambda (Node.js 22) | Runs the reminder function |
| Amazon EventBridge Scheduler | Triggers Lambda on a schedule |
| AWS CDK (TypeScript) | Infrastructure as code |
| Telegram Bot API | Sends the notification |
| GitHub Actions | CI/CD |

---

## Project Structure

```
bin/                  CDK app entrypoint
lib/                  CDK stack (AWS infrastructure)
src/lambda/
  handler.ts          Lambda entrypoint
  types.ts            Shared TypeScript interfaces
  services/
    council-api.ts    Calls the council API
    telegram.ts       Sends Telegram messages
.github/workflows/    CI and deploy pipelines
```
