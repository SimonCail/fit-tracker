import { normalizeExerciseName } from './exerciseName'

export const MUSCLE_GROUPS = ['Pectoraux', 'Dos', 'Épaules', 'Biceps', 'Triceps', 'Jambes', 'Abdos'] as const
export type MuscleGroup = (typeof MUSCLE_GROUPS)[number] | 'Autres'

/**
 * Guess the main muscle group from an exercise name (French and English).
 * Order matters: the first rule that matches wins, so "leg curl" is legs before
 * "curl" can claim it for biceps, and "développé militaire" is shoulders before
 * "développé" claims it for chest.
 */
const RULES: [MuscleGroup, string[]][] = [
  ['Jambes', ['squat', 'leg ', 'leg-', 'legpress', 'presse', 'fente', 'lunge', 'mollet', 'calf', 'hip thrust', 'roumain', 'rdl', 'ischio', 'quadri', 'adduct', 'abduct', 'fessier', 'glute', 'step up', 'good morning', 'souleve de terre jambes tendues']],
  ['Abdos', ['abdo', 'crunch', 'gainage', 'plank', 'releve de jambes', 'russian twist', 'ab wheel', 'roulette', 'obliques']],
  ['Épaules', ['militaire', 'overhead', 'ohp', 'epaule', 'shoulder', 'elevation lat', 'elevations lat', 'lateral', 'oiseau', 'face pull', 'arnold', 'push press', 'tirage menton', 'upright']],
  ['Triceps', ['triceps', 'dips', 'dip ', 'barre au front', 'skull', 'kickback', 'extension']],
  ['Biceps', ['curl', 'biceps', 'marteau', 'hammer']],
  ['Pectoraux', ['developpe', 'bench', 'pec', 'pompe', 'push-up', 'pushup', 'push up', 'ecarte', 'butterfly', 'chest', 'fly']],
  ['Dos', ['traction', 'tirage', 'rowing', 'row', 'pull', 'lat ', 'dorsa', 'souleve de terre', 'deadlift', 'pullover', 'shrug', 'haussement', 'lombaire']],
]

export function muscleGroupOf(name: string): MuscleGroup {
  const n = ` ${normalizeExerciseName(name)} `
  for (const [group, words] of RULES) if (words.some(w => n.includes(w))) return group
  return 'Autres'
}