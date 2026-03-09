import { Question, SectorQuestionConfig } from '../types';
import { Sector } from '@/shared/types/brandLead';
import { buildQuestions } from './buildQuestions';
import { gastronomyConfig } from './sectors/gastronomi';
import { retailConfig } from './sectors/retail';
import { corporateConfig } from './sectors/corporate';
import { techConfig } from './sectors/tech';
import { healthConfig } from './sectors/health';
import { educationConfig } from './sectors/education';
import { fmcgConfig } from './sectors/fmcg';
import { showroomConfig } from './sectors/showroom';
import { hospitalityConfig } from './sectors/hospitality';

const sectorConfigs: Record<string, SectorQuestionConfig> = {
  gastronomi: gastronomyConfig,
  retail: retailConfig,
  corporate: corporateConfig,
  tech: techConfig,
  health: healthConfig,
  education: educationConfig,
  fmcg: fmcgConfig,
  showroom: showroomConfig,
  hospitality: hospitalityConfig,
};

export function getQuestionsForSector(sector: Sector): Question[] {
  const config = sectorConfigs[sector] || sectorConfigs.gastronomi;
  return buildQuestions(config);
}
