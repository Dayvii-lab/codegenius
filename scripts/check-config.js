#!/usr/bin/env node
'use strict';

require('dotenv').config();

const required = [
  ['AI_API_KEY', 'Chat, code generation, and image analysis'],
  ['AI_BASE_URL', 'AI provider base URL'],
  ['AI_MODEL', 'AI model name'],
];

const optional = [
  ['AI_VISION_MODEL', 'Vision-capable model name (for image analysis)'],
  ['SEARCH_API_KEY', 'Web search (research mode)'],
  ['SEARCH_API_URL', 'Web search endpoint'],
  ['DATABASE_URL', 'PostgreSQL connection string (persistent storage)'],
  ['SESSION_SECRET', 'Session signing secret'],
];

function status(name, present) {
  return `${present ? '✅' : '❌'} ${name}`;
}

console.log('\nCodePilot AI — Configuration Check\n');
console.log('Required:');
let allRequired = true;
for (const [key, why] of required) {
  const ok = Boolean(process.env[key]);
  if (!ok) allRequired = false;
  console.log(`  ${status(key, ok)}  — ${why}`);
}
console.log('\nOptional:');
for (const [key, why] of optional) {
  console.log(`  ${status(key, Boolean(process.env[key]))}  — ${why}`);
}
console.log(
  allRequired
    ? '\n✅ Core configuration looks good.\n'
    : '\n⚠️  Some required variables are missing. The server will run in limited mode.\n'
);
process.exit(0);
