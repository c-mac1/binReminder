# Architecture

## Overview

A serverless scheduled reminder. Once a week, AWS invokes a Lambda function that calls the council's bin collection API and sends a formatted message to a Telegram group.

```
EventBridge Scheduler (Sunday 19:00 Europe/London)
        │
        ▼
AWS Lambda (Node.js 22)
        │
        ├──▶ Ards & North Down Council API  →  next collection date + bins
        │
        └──▶ Telegram Bot API  →  message delivered to group
```

No database. No server. No persistent state. The entire system is a scheduled function call.

---

## AWS Services

### Lambda
The compute layer. A Lambda is a function AWS runs on demand — no server provisioning, no idle cost. You upload code, define a trigger, and AWS handles the rest.

This function runs for roughly one second, once per week. Cost is negligible.

**Why Lambda over a server:** A server running 24/7 to execute one second of work per week is wasteful. Lambda charges per invocation and per millisecond of execution.

### EventBridge Scheduler
The trigger. EventBridge Scheduler fires the Lambda on a defined schedule using cron syntax.

**Why Scheduler over EventBridge Rules:** EventBridge Rules (the older service) only support UTC cron expressions. EventBridge Scheduler supports `scheduleExpressionTimezone`, which means the 19:00 trigger automatically adjusts for GMT/BST without any manual offset calculation.

**Schedule expression:** `cron(0 19 ? * SUN *)` — every Sunday at 19:00 in the configured timezone.

### IAM
Controls permissions. EventBridge Scheduler needs explicit permission to invoke the Lambda — it cannot do so by default.

A dedicated IAM Role is created for the scheduler with a single policy:
```
Allow: lambda:InvokeFunction
Resource: <this Lambda's ARN only>
```

This is least-privilege — the role can only do the one thing it needs to do, on the one resource it needs to do it on.

### AWS CDK
Infrastructure as code. The Lambda, EventBridge schedule, and IAM role are all defined in TypeScript in `lib/bin_reminder-stack.ts`. Running `cdk deploy` synthesises this into a CloudFormation template and applies it to AWS.

**Why CDK over clicking in the console:** Console changes aren't version-controlled, can't be reviewed, and can't be shared. CDK means the infrastructure is reproducible — anyone can clone the repo and deploy an identical stack to their own AWS account.

**Why CDK over raw CloudFormation:** CloudFormation is verbose YAML/JSON. CDK is TypeScript with type checking, IDE autocomplete, and reusable constructs.

### CloudFormation
The underlying AWS service that CDK deploys to. CDK generates a CloudFormation template; CloudFormation creates and manages the actual resources. On subsequent deploys, CloudFormation diffs the new template against the existing stack and only updates what changed.

---

## Application Code

### `src/lambda/types.ts`
All shared TypeScript interfaces. Defines two sets of types:

- **`ApiResponse` / `ApiCollectionDate` / `ApiBin`** — the exact shape of the council API response
- **`Collection` / `Bin` / `BinColour`** — clean internal types used throughout the rest of the app

Keeping API types separate from internal types means the rest of the app is insulated from the API's naming conventions. If the API changes a field name, only the parsing layer changes.

`BinColour` is a union type: `'Blue' | 'Grey' | 'Brown' | 'Yellow'`. TypeScript enforces that only these four values are ever used — a typo or invalid colour is a compile error, not a runtime bug.

### `src/lambda/services/council-api.ts`
Encapsulates all communication with the council API. One class, one responsibility.

The API returns a single object with three keys — `lastWeek`, `thisWeek`, `nextWeek` — each containing an array of collection dates. Since the Lambda runs Sunday evening, `nextWeek[0]` is the Monday collection being reminded about. `thisWeek[0]` is a fallback in case `nextWeek` is empty.

Each bin in the response has a `colour` field (`"Blue"`, `"Brown"`, `"Yellow"`, `"Grey"`) which is mapped to the `BinColour` union type.

**Why a class:** The UPRN is injected via the constructor, which makes the service easy to test — pass a fake UPRN in tests, never touch the real API.

### `src/lambda/services/telegram.ts`
Encapsulates all communication with the Telegram Bot API. One class, one responsibility.

Sending a message is a single HTTP POST:
```
POST https://api.telegram.org/bot{TOKEN}/sendMessage
{ chat_id: "...", text: "...", parse_mode: "HTML" }
```

`parse_mode: 'HTML'` allows optional rich formatting (`<b>`, `<i>`) in future without any code changes.

### `src/lambda/handler.ts`
The Lambda entrypoint. AWS invokes the exported `handler` function directly.

Responsibilities:
1. Read `UPRN`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` from environment variables
2. Fail immediately if any are missing
3. Call `CouncilApiService` to get the next collection
4. Call `formatMessage` to build the message string
5. Call `TelegramService` to send it

`formatMessage` is a pure function (exported separately) so it can be unit tested without any network calls or AWS dependencies.

### `lib/bin_reminder-stack.ts`
The CDK stack. Defines all AWS resources in TypeScript.

Three constructs:
- **`NodejsFunction`** — creates the Lambda and uses esbuild to bundle `handler.ts` and all its imports into a single `index.js` at deploy time. No manual compilation step.
- **`Role`** — the IAM role for EventBridge Scheduler.
- **`CfnSchedule`** — the EventBridge Scheduler schedule. `CfnSchedule` is an L1 construct (direct CloudFormation mapping) used here because the higher-level L2 constructs don't yet expose `scheduleExpressionTimezone`.

Environment variables are read from `process.env` at deploy time and baked into the Lambda's configuration. Locally they come from `.env` via dotenv; in CI they come from GitHub Secrets.

### `bin/bin_reminder.ts`
The CDK app entrypoint. Loads `dotenv/config` (reads `.env` into `process.env`), then instantiates the stack. CDK runs this file directly via `ts-node` — no compilation step needed.

---

## Compilation

Three tools are involved, each with a distinct role:

| Tool | Role | When it runs |
|---|---|---|
| `ts-node` | Runs `bin/bin_reminder.ts` directly during deploy | `cdk deploy` |
| `esbuild` | Bundles Lambda TypeScript into a single `index.js` | `cdk deploy` (via `NodejsFunction`) |
| `tsc` | Type-checks the entire codebase — no output (`noEmit: true`) | `npm run build` |

`tsc` never writes files. It exists purely to catch type errors before they reach production.

---

## Configuration & Secrets

All secrets flow through environment variables. They are never hardcoded.

| Context | Source |
|---|---|
| Local development | `.env` file, loaded by `dotenv` in `bin/bin_reminder.ts` |
| GitHub Actions | GitHub repository Secrets, injected as env vars by the workflow |

In both cases, CDK reads the values from `process.env` at deploy time and sets them as Lambda environment variables. The Lambda reads them at runtime.

**Required variables:**

| Variable | Description |
|---|---|
| `UPRN` | Unique Property Reference Number — identifies your address to the council API |
| `TELEGRAM_BOT_TOKEN` | Bot token from BotFather |
| `TELEGRAM_CHAT_ID` | ID of the Telegram chat or group to send messages to |

---

## CI/CD

Two GitHub Actions workflows:

### `ci.yml`
Runs on pull requests and when called by `deploy.yml`. Installs dependencies, runs tests, and type-checks the codebase. Acts as a gate — nothing broken can reach `main`.

Uses `npm ci` (not `npm install`) — installs exact versions from `package-lock.json` without modifying it.

### `deploy.yml`
Runs on push to `main`. Calls `ci.yml` first via `workflow_call`. If CI passes, configures AWS credentials from GitHub Secrets and runs `cdk deploy`.

**Why `workflow_call` instead of duplicating the CI steps:** `ci.yml` needs to run standalone on PRs and also be called as a prerequisite in `deploy.yml`. `workflow_call` makes a workflow reusable — without it, the only option is to duplicate the steps.

---

## Testing

Unit tests cover two areas:

**`handler.test.ts`** — tests `formatMessage` with different bin combinations and dates. Pure function, no mocking needed.

**`council-api.test.ts`** — tests `CouncilApiService` with mocked `fetch`. `jest.spyOn(global, 'fetch')` intercepts HTTP calls and returns controlled responses. This allows testing the happy path, the `thisWeek` fallback, API error handling, and all four colour mappings — with no network dependency.
