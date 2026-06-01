import * as path from 'path';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import { Role, ServicePrincipal, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { CfnSchedule } from 'aws-cdk-lib/aws-scheduler';

export class BinReminderStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // NodejsFunction uses esbuild to bundle handler.ts and all its imports
    // into a single JS file — no manual tsc compile step needed for Lambda.
    const fn = new NodejsFunction(this, 'BinReminderFunction', {
      entry: path.join(__dirname, '../src/lambda/handler.ts'),
      handler: 'handler',
      runtime: Runtime.NODEJS_22_X,
      timeout: cdk.Duration.seconds(30),
      environment: {
        UPRN: process.env.UPRN ?? '',
        TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN ?? '',
        TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID ?? '',
      },
    });

    // EventBridge Scheduler needs its own IAM role to be allowed to invoke
    // our Lambda. Without this, the schedule fires but Lambda rejects the call.
    const schedulerRole = new Role(this, 'SchedulerRole', {
      assumedBy: new ServicePrincipal('scheduler.amazonaws.com'),
    });

    schedulerRole.addToPolicy(
      new PolicyStatement({
        actions: ['lambda:InvokeFunction'],
        resources: [fn.functionArn],
      }),
    );

    // CfnSchedule is the L1 (raw CloudFormation) CDK construct for EventBridge
    // Scheduler. We use it because the higher-level L2 constructs don't yet
    // support scheduleExpressionTimezone — so this is the right tool for timezone-
    // aware cron triggers.
    new CfnSchedule(this, 'BinReminderSchedule', {
      scheduleExpression: 'cron(0 19 ? * SUN *)',
      scheduleExpressionTimezone: 'Europe/London',
      flexibleTimeWindow: { mode: 'OFF' },
      target: {
        arn: fn.functionArn,
        roleArn: schedulerRole.roleArn,
      },
    });
  }
}
