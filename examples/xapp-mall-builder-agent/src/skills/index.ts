import { xappBuildSkill } from './xapp-build.js';
import type { Skill } from '@agent-creator/core';

export const skills: Skill[] = [
  // agent-creator:skill-imports
  xappBuildSkill,
];

export const enabledSkillNames = [
  // agent-creator:skill-exports
  'xapp.build',
];
