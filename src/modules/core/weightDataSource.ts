import { getWeightLogsByRange } from '../../db/weightRepository';
import { WeightDataSource } from '../contracts';

export const weightDataSource: WeightDataSource = {
  getWeightLogs: getWeightLogsByRange,
};
