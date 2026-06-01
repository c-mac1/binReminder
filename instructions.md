Project Goal

A serverless AWS application that:

Runs every Sunday at 7pm.
Calls the council API.
Determines the next collection.
Sends a Telegram message.
Can be self-hosted by anyone in their own AWS account.
Tech Stack
AWS CDK (Typescript)
AWS Lambda (Node.js 22)
Amazon EventBridge
Telegram Bot API
GitHub Actions

Avoid DynamoDB initially. You don't need it.

Project Structure
bin-reminder/

├── src/
│ ├── lambda/
│ │ ├── handler.ts
│ │ ├── services/
│ │ │ ├── council-api.ts
│ │ │ └── telegram.ts
│ │ └── types.ts
│
├── infra/
│ ├── bin-reminder-stack.ts
│ └── app.ts
│
├── .github/workflows/
│ └── deploy.yml
│
├── README.md
├── package.json
└── cdk.json
Step 1 - Create Telegram Bot

Message for Claude:

Create instructions for creating a Telegram Bot using BotFather.

The output should explain:

1. Creating a bot
2. Obtaining the bot token
3. Finding a chat ID
4. Sending a test message using curl

Assume no prior Telegram knowledge.

Store:

BOT_TOKEN
CHAT_ID
Step 2 - Build Council API Service

Endpoint:

https://ardsandnorthdownbincalendar.azurewebsites.net/api/collectiondates/{UPRN}

Message for Claude:

Create a TypeScript service called CouncilApiService.

Requirements:

- Use fetch
- Accept a UPRN
- Return the next collection date and bins
- Strongly typed interfaces
- Throw meaningful errors
- Follow clean architecture principles

Example response:
[paste API response]

Expected output:

const collection = await councilApi.getNextCollection();
Step 3 - Build Telegram Service

Message for Claude:

Create a TelegramService class.

Requirements:

- Send messages using Telegram Bot API
- Use fetch
- Typescript
- Dependency injection friendly
- Throw meaningful errors

Usage:

await telegram.sendMessage(message);
Step 4 - Lambda Handler

Message for Claude:

Create a Lambda handler.

Requirements:

1. Read UPRN from environment variable
2. Call CouncilApiService
3. Format a Telegram message

Example:

♻️ Bin Reminder

Collection tomorrow:

🔵 Recycling Bin

Date:
Monday 8 June

4. Send through TelegramService

5. Log useful information

6. Handle errors correctly
   Step 5 - CDK Infrastructure

Message for Claude:

Create an AWS CDK stack in Typescript.

Resources:

1. Lambda Function
2. EventBridge Schedule

Schedule:
Every Sunday at 19:00 Europe/London

Lambda environment variables:

UPRN
TELEGRAM_BOT_TOKEN
TELEGRAM_CHAT_ID

Use NodejsFunction from aws-lambda-nodejs.

Use least privilege IAM.

Node 22 runtime.
Step 6 - Nice Formatting

Map colours to emojis:

Blue -> 🔵
Grey -> ⚫
Brown -> 🟤
Yellow -> 🟡

Message:

♻️ Bin Reminder

Collection tomorrow:

🔵 Recycling Bin

Date:
Monday 8 June

If multiple bins:

♻️ Bin Reminder

Collection tomorrow:

⚫ General Waste
🟤 Garden Waste
🟡 Glass Container

Date:
Monday 1 June
Step 7 - GitHub Actions

Message for Claude:

Create a GitHub Actions workflow.

Requirements:

- npm ci
- npm run test
- npm run build

Separate deployment workflow:

- Configure AWS credentials
- cdk deploy
  Step 8 - Make it Open Source Friendly

Configuration should come from environment variables:

UPRN
TELEGRAM_BOT_TOKEN
TELEGRAM_CHAT_ID

No hardcoded values.

Users should only need:

npm install
cdk deploy
Future Enhancements (Don't Build Yet)

Keep these as GitHub issues:

[ ] Multiple Telegram recipients
[ ] Multiple council providers
[ ] Slack notifications
[ ] Email notifications
[ ] SMS notifications
[ ] WhatsApp notifications
[ ] Web dashboard
[ ] DynamoDB user management

For version 1, focus on:

Council API

- Telegram
- Lambda
- EventBridge
- CDK

That's enough to have a genuinely useful project that demonstrates AWS, TypeScript, serverless architecture, infrastructure-as-code, scheduled workloads, third-party API integration, and CI/CD without becoming over-engineered.
