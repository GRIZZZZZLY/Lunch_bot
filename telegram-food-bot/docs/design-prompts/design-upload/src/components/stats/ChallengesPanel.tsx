import { motion } from 'framer-motion';
import { Target, Sparkles } from 'lucide-react';
import { PastelCard, CardHeader, CardTitle, CardContent } from '../ui/pastel-card';

interface Challenge {
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
}

interface ChallengesPanelProps {
  isDark: boolean;
  onChallengeComplete?: (challenge: Challenge) => void;
}

export function ChallengesPanel({
  isDark,
  onChallengeComplete: _onChallengeComplete,
}: ChallengesPanelProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.4, delay: 0.2 }}
    >
      <PastelCard variant="glass">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Target className={`w-5 h-5 ${isDark ? 'text-peach-400' : 'text-peach-600'}`} />
            <CardTitle className="text-lg">Челленджи</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <Sparkles className={`w-12 h-12 mx-auto mb-3 ${isDark ? 'text-zinc-600' : 'text-zinc-300'}`} />
              <p className={`text-sm ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                Челленджи скоро появятся
              </p>
            </div>
          </div>
        </CardContent>
      </PastelCard>
    </motion.div>
  );
}
