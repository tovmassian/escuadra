#!/usr/bin/env node
// Entry point. No TypeScript loader is registered: package.json pins
// node >=24.3.0 and Node strips types natively, so oclif's own glob picks up
// the .ts command files and imports them directly.
import { execute } from '@oclif/core';

await execute({ development: true, dir: import.meta.url });
