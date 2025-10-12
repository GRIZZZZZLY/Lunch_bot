/**
 * Feature Flags Configuration
 * Управление включением/отключением экспериментальных фич
 */

export const FEATURES = {
  /**
   * Multi-Winner Voting
   * Включает режим завершения голосования с множественными победителями
   * 
   * @default false (отключено по умолчанию)
   * @env FEATURE_MULTI_WINNER
   */
  MULTI_WINNER_VOTING: process.env.FEATURE_MULTI_WINNER === 'true',
};

export function isFeatureEnabled(feature: keyof typeof FEATURES): boolean {
  return FEATURES[feature] === true;
}
