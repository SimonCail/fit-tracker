export type ExerciseSet = {
  id: string
  reps: number
  weight: number
}

export type Exercise = {
  id: string
  name: string
  sets: ExerciseSet[]
}

export type Session = {
  id: string
  date: string
  notes: string | null
  createdAt: number
  exercises: Exercise[]
}

export type WeighSlot = 'morning' | 'evening'

export type WeighIn = {
  id: string
  date: string
  weight: number
  note: string | null
  slot: WeighSlot | null
  createdAt: number
}
