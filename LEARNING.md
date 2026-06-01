# How This App Works — A Learning Guide

## The One-Line Summary

Every Sunday at 7pm, AWS wakes up a small Node.js function, asks the council API when the bins are next collected, formats a message, and fires it to a Telegram group.

---

## The Full Flow

```
Every Sunday 19:00 (Europe/London)
        │
        ▼
┌───────────────────┐
│ EventBridge       │  AWS's scheduler service. Like a cron job,
│ Scheduler         │  but managed, serverless, and timezone-aware.
└────────┬──────────┘
         │ invokes
         ▼
┌───────────────────┐
│ AWS Lambda        │  A function that runs on demand — no server
│ (Node.js 22)      │  running 24/7, no cost when idle.
└────────┬──────────┘
         │
         ├──── calls ────▶ Council API (Azure)
         │                 Returns next bin collection dates
         │
         └──── calls ────▶ Telegram Bot API
                           Sends message to your group
```

---

## AWS Services — What Each One Does

### AWS Lambda
A Lambda function is just a function that AWS runs for you. You don't manage a server — AWS handles provisioning, scaling, and OS patching. You only pay for the milliseconds it runs.

In this project the function runs for ~1 second once a week. The cost is effectively zero.

**Key idea:** Lambda needs a trigger. On its own it just sits there. EventBridge is the trigger.

### EventBridge Scheduler
EventBridge Scheduler is AWS's managed cron service. You give it a schedule expression and a target (our Lambda), and it fires the target on that schedule.

We used `CfnSchedule` (the raw CloudFormation construct) instead of the higher-level CDK EventBridge constructs because only `CfnSchedule` supports `scheduleExpressionTimezone`. Without this, we'd have to hardcode UTC and manually account for BST/GMT shifts.

**Our schedule:** `cron(0 19 ? * SUN *)` — at minute 0, hour 19, any day-of-month, every month, on Sundays.

### IAM (Identity and Access Management)
IAM controls *who can do what* in AWS. EventBridge Scheduler can't just invoke your Lambda — it needs explicit permission.

We created a **Role** for the scheduler with one policy:
```
Allow: lambda:InvokeFunction
Resource: arn of our specific Lambda only
```

This is **least privilege** — the role can only do exactly what it needs, nothing more.

### AWS CDK (Cloud Development Kit)
CDK lets you define AWS infrastructure in TypeScript instead of writing raw CloudFormation YAML/JSON. You write code, CDK compiles it down to a CloudFormation template, and CloudFormation creates the real resources in AWS.

```
Your TypeScript (lib/bin_reminder-stack.ts)
        │
        ▼  cdk deploy
CloudFormation template (JSON)
        │
        ▼  CloudFormation
Real AWS resources (Lambda, EventBridge schedule, IAM role)
```

**`NodejsFunction`** is a CDK construct that does something clever — instead of making you compile your TypeScript manually, it uses **esbuild** to bundle `src/lambda/handler.ts` and all its imports into a single minified `index.js` file, then uploads that to Lambda automatically.

---

## The Code — File by File

### `src/lambda/types.ts`
Defines the shape of all data in the app as TypeScript interfaces.

- `ApiResponse` / `ApiCollectionDate` / `ApiBin` — mirrors exactly what the council API returns
- `Collection` / `Bin` — our clean internal types, used after we've parsed the raw response
- `BinColour` — a union type (`'Blue' | 'Grey' | 'Brown' | 'Yellow'`). TypeScript enforces these are the only four values ever used.

The point of having two sets of types (Api* and internal) is separation: if the council API changes its field names, we only update the parsing layer, not the whole app.

### `src/lambda/services/council-api.ts`
One class, one job: call the council API and return a clean `Collection` object.

The API returns:
```json
{
  "lastWeek":  [ ...last Monday's collection ],
  "thisWeek":  [ ...this Monday's collection ],
  "nextWeek":  [ ...next Monday's collection ]
}
```

Since the Lambda runs Sunday evening, `nextWeek[0]` is Monday's collection — the one we're reminding about. We fall back to `thisWeek[0]` in case `nextWeek` is empty.

The `parseBinColour` function maps the API's colour string (`"Blue"`, `"Brown"`, etc.) to our `BinColour` union type.

### `src/lambda/services/telegram.ts`
One class, one job: send a message via the Telegram Bot API.

The Telegram Bot API is just HTTP. To send a message you POST to:
```
https://api.telegram.org/bot{TOKEN}/sendMessage
```
with a JSON body containing the `chat_id` and `text`.

`parse_mode: 'HTML'` is set so you can use `<b>bold</b>` or `<i>italic</i>` in messages later if you want.

### `src/lambda/handler.ts`
The Lambda entrypoint — AWS calls the exported `handler` function directly.

It:
1. Reads `UPRN`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` from environment variables
2. Throws immediately if any are missing (fail fast — better a clear error than a confusing one)
3. Instantiates `CouncilApiService` and `TelegramService`
4. Calls the council API
5. Calls `formatMessage` to build the text
6. Sends via Telegram

`formatMessage` is exported separately so it can be unit tested without needing AWS or real credentials.

### `lib/bin_reminder-stack.ts`
The CDK stack — defines all AWS infrastructure as TypeScript code.

Three things get created:
1. **`NodejsFunction`** — the Lambda, pointed at `handler.ts`. CDK/esbuild handles bundling.
2. **`Role`** — an IAM role for EventBridge Scheduler to use.
3. **`CfnSchedule`** — the EventBridge schedule with timezone support.

Environment variables (`UPRN`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`) are read from `process.env` at *deploy time* and baked into the Lambda's configuration. This is how CI/CD secrets flow into the running function.

### `bin/bin_reminder.ts`
The CDK app entrypoint. Instantiates the stack and sets the AWS account/region. CDK uses `ts-node` to run this directly — no compilation needed.

---

## Key Concepts

### Why no server?
Traditional apps run on a server 24/7. This app only needs to do something once a week for about 1 second. Running a server for that would be wasteful and expensive. Serverless (Lambda + EventBridge) means you pay for exactly what you use — in this case, almost nothing.

### Why TypeScript?
TypeScript is JavaScript with types. The types catch bugs before the code runs. For example, if you accidentally pass a `string` where a `Bin` object is expected, TypeScript errors at compile time instead of crashing in production at 7pm on a Sunday.

### Why CDK instead of clicking in the AWS Console?
If you click around the AWS Console to create resources, there's no record of what you did, no way to recreate it, and no way to share it. CDK means your infrastructure is version-controlled, repeatable, and sharable — anyone can clone this repo and deploy an identical setup in their own AWS account with `cdk deploy`.

### What is `cdk bootstrap`?
Before CDK can deploy, it needs a place to store assets (like the bundled Lambda zip file). `cdk bootstrap` creates an S3 bucket and some IAM roles in your AWS account for this purpose. You only run it once per account/region.

### Environment variables
Secrets (Telegram token, UPRN) are never hardcoded. They flow in from:
- **Locally:** your `.env` file, loaded into the shell before `cdk deploy`
- **CI/CD:** GitHub Secrets, injected as env vars in the deploy workflow

Either way, CDK reads them from `process.env` and sets them as Lambda environment variables. The Lambda then reads them with `process.env` at runtime.

---

## The GitHub Actions Workflows

### `ci.yml`
Runs on every push and pull request. Runs `npm ci`, `npm test`, and `npm run build`. Acts as a gate — broken code is caught before it reaches `main`.

### `deploy.yml`
Runs only when code is pushed to `main`. Waits for CI to pass first (`needs: ci`), configures AWS credentials from GitHub Secrets, then runs `cdk deploy`. The `UPRN`, `TELEGRAM_BOT_TOKEN`, and `TELEGRAM_CHAT_ID` secrets are passed as environment variables so CDK can bake them into the Lambda.

---

## What Happens When You Run `cdk deploy`

1. `ts-node` executes `bin/bin_reminder.ts`
2. CDK synthesises your stack into a CloudFormation JSON template
3. esbuild bundles `src/lambda/handler.ts` into a single `index.js`
4. CDK uploads the bundle to the S3 bootstrap bucket
5. CDK sends the CloudFormation template to AWS
6. CloudFormation creates or updates the Lambda, IAM role, and EventBridge schedule
7. Done — the infrastructure now exists in AWS

On subsequent deploys, CloudFormation compares the new template to the existing stack and only changes what's different.
