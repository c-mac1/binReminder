#!/usr/bin/env node
import 'dotenv/config';
import * as cdk from 'aws-cdk-lib';
import { BinReminderStack } from '../lib/bin_reminder-stack';

const app = new cdk.App();
new BinReminderStack(app, 'BinReminderStack');