import React from 'react';
import { motion } from 'framer-motion';
import { Users, Clock, User } from 'lucide-react';
import { Progress } from '../ui/progress';
import { Avatar, AvatarImage, AvatarFallback } from '../ui/avatar';
import { cn, formatRelativeTime, getInitials } from '../../lib/utils';
import { ICON_SIZES } from '@/lib/design-tokens';

interface PollStatsBarProps {
  participantCount: number;
  totalMembers: number;
  endedAt: string;
  duration: number; // в минутах
  responsiblePerson?: {
    id: number;
    firstName: string;
    lastName?: string;
    username?: string;
    photoUrl?: string;
  };
  className?: string;
}

/**
 * Статистика завершённого голосования
 */
export const PollStatsBar: React.FC<PollStatsBarProps> = ({
  participantCount,
  totalMembers,
  endedAt,
  duration,
  responsiblePerson,
  className,
}) => {
  const participationPercent = Math.round((participantCount / totalMembers) * 100);
  const endedAtDate = new Date(endedAt);
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.4 }}
      className={cn('space-y-4', className)}
    >
      {/* Участие */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
            <Users className={ICON_SIZES.sm} />
            <span className="font-medium">
              {participantCount} из {totalMembers} {totalMembers === 1 ? 'человека' : totalMembers < 5 ? 'человек' : 'человек'} проголосовали
            </span>
          </div>
          <span className="font-semibold text-gray-900 dark:text-white">
            {participationPercent}%
          </span>
        </div>
        
        <Progress 
          value={participationPercent} 
          className={cn(
            "h-2",
            participationPercent >= 70 ? '[&>div]:bg-green-500' :
            participationPercent >= 40 ? '[&>div]:bg-yellow-500' :
            '[&>div]:bg-red-500'
          )}
        />
      </div>

      {/* Время */}
      <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
        <div className="flex items-center gap-1.5">
          <Clock className={ICON_SIZES.sm} />
          <span>
            Завершено {formatRelativeTime(endedAtDate)} 
            <span className="text-xs ml-1">
              ({endedAtDate.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })})
            </span>
          </span>
        </div>
      </div>

      <div className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-400">
        Длительность: {duration} {duration === 1 ? 'минута' : duration < 5 ? 'минуты' : 'минут'}
      </div>

      {/* Ответственный */}
      {responsiblePerson && (
        <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <User className={ICON_SIZES.sm} />
              <span className="font-medium">Ответственный:</span>
            </div>
            
            <div className="flex items-center gap-2">
              <Avatar className={`${ICON_SIZES.xl} border-2 border-green-500`}>
                {responsiblePerson.photoUrl && (
                  <AvatarImage src={responsiblePerson.photoUrl} alt={responsiblePerson.firstName} />
                )}
                <AvatarFallback className="bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 text-xs font-semibold">
                  {getInitials(`${responsiblePerson.firstName}${responsiblePerson.lastName ? ` ${responsiblePerson.lastName}` : ''}`)}
                </AvatarFallback>
              </Avatar>
              
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-gray-900 dark:text-white">
                  {responsiblePerson.firstName}{responsiblePerson.lastName ? ` ${responsiblePerson.lastName}` : ''}
                </span>
                {responsiblePerson.username && (
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    @{responsiblePerson.username}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
};
