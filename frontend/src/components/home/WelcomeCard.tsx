import React from 'react';
import { motion } from 'framer-motion';
import { UserPlus } from 'lucide-react';
import { Button } from '../ui/button';
import { GlassCard, GlassCardContent } from '../ui/glass-card';
import { useTimeBasedGradient } from '../../hooks/useTimeBasedGradient';
import { useAppStore } from '../../store/useAppStore';

interface WelcomeCardProps {
  onInviteFriend: () => void;
}

/**
 * Welcome Card - Приветственная карточка для новых пользователей
 * 
 * Показывается только пользователям с 0-2 голосованиями.
 * Объясняет как работает бот и содержит кнопку приглашения друзей.
 */
export const WelcomeCard: React.FC<WelcomeCardProps> = ({ onInviteFriend }) => {
  const theme = useAppStore((state) => state.theme);
  const gradientColors = useTimeBasedGradient(theme === 'dark');

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
    >
      <GlassCard intensity="solid" className="overflow-hidden">
        {/* Gradient background */}
        <div 
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `linear-gradient(135deg, ${gradientColors.from}, ${gradientColors.to})`,
            opacity: 0.3
          }}
        />
        
        <GlassCardContent className="relative py-6 px-6 space-y-4">
          {/* Emoji */}
          <div className="text-center">
            <div className="text-6xl mb-2">🎉</div>
          </div>
          
          {/* Title */}
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-bold text-foreground">
              Добро пожаловать!
            </h2>
            <p className="text-sm text-muted-foreground">
              Это бот для выбора обеда командой!
            </p>
          </div>

          {/* How it works */}
          <div className="space-y-3 bg-background/30 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-foreground">
              Как это работает:
            </h3>
            <div className="space-y-2 text-sm text-muted-foreground">
              <div className="flex items-start gap-2">
                <span className="text-lg">1️⃣</span>
                <span>Администратор создаёт голосование</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-lg">2️⃣</span>
                <span>Вы выбираете любимое блюдо</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-lg">3️⃣</span>
                <span>Победитель определяется голосами</span>
              </div>
            </div>
          </div>

          {/* Tip */}
          <div className="bg-mint-500/10 border border-mint-500/30 rounded-xl p-3">
            <p className="text-xs text-foreground">
              💡 <span className="font-semibold">Совет:</span> Голосуйте быстрее, чтобы повлиять на выбор команды!
            </p>
          </div>

          {/* Invite button */}
          <Button 
            variant="mint"
            size="lg"
            className="w-full"
            onClick={onInviteFriend}
          >
            <UserPlus className="size-5 mr-2" />
            Пригласить друга
          </Button>
        </GlassCardContent>
      </GlassCard>
    </motion.div>
  );
};
