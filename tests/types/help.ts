import type { DdocBotElement } from '../../src/index.js';
declare const bot: DdocBotElement;
bot.helpButton = true;
const enabled: boolean = bot.helpButton;
void enabled;
// @ts-expect-error helpButton is boolean
bot.helpButton = 'yes';
const nudged: boolean = bot.nudge();
void nudged;
