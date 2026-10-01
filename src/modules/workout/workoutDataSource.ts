import { getSessionsByDateRange } from '../../db/workoutRepository';
import { WorkoutDataSource } from '../contracts';

export const workoutDataSource: WorkoutDataSource = {
  getSessions: getSessionsByDateRange,
};
