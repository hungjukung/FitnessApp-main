import { DietDataSource } from '../contracts';
import { getDailySummaries } from './dietRepository';

export const dietDataSource: DietDataSource = {
  getDailySummaries,
};
