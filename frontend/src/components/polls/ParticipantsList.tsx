import { useState } from 'react';
import { m, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { Badge } from '../ui/badge';
import { cn } from '../../lib/utils';
import { UserAvatar } from '../common/UserAvatar';
import { ICON_SIZES } from '@/lib/design-tokens';

interface Participant {
  id: number;
  firstName: string;
  lastName?: string;
  photoUrl?: string;
  dishName: string;
  dishPrice: number;
  dishEmoji?: string;
}

interface ParticipantsListProps {
  participants: Participant[];
  currentUserId?: number;
  userParticipated: boolean;
  className?: string;
}

/**
 * Список участников голосования с их выбором
 */
export const ParticipantsList: React.FC<ParticipantsListProps> = ({
  participants,
  currentUserId,
  userParticipated,
  className,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Сортировка: текущий пользователь первым, остальные по алфавиту
  const sortedParticipants = [...participants].sort((a, b) => {
    if (a.id === currentUserId) return -1;
    if (b.id === currentUserId) return 1;
    return a.firstName.localeCompare(b.firstName);
  });

  // Подсчёт общей суммы
  const totalAmount = participants.reduce((sum, p) => sum + p.dishPrice, 0);

  // Группировка по блюдам для компактного отображения
  return (
    <m.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.5 }}
      className={cn('space-y-3', className)}
    >
      {/* Заголовок */}
      <button type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">📋</span>
          <span className="font-semibold text-gray-900 dark:text-white">
            {userParticipated ? 'Кто что заказал' : 'Что заказали другие'} ({participants.length} {participants.length === 1 ? 'человек' : participants.length < 5 ? 'человека' : 'человек'})
          </span>
        </div>
        
        <m.div
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className={`${ICON_SIZES.md} text-gray-400 dark:text-gray-400`} />
        </m.div>
      </button>

      {/* Список участников */}
      <AnimatePresence>
        {isExpanded && (
          <m.div
            initial={{ opacity: 0, scaleY: 0.98 }}
            animate={{ opacity: 1, scaleY: 1 }}
            exit={{ opacity: 0, scaleY: 0.98 }}
            transition={{ duration: 0.3 }}
            className="origin-top overflow-hidden"
          >
            <div className="space-y-2 p-4 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
              {sortedParticipants.map((participant, index) => (
                <m.div
                  key={participant.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className={cn(
                    'flex items-center justify-between p-3 rounded-lg',
                    participant.id === currentUserId
                      ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800'
                      : 'bg-gray-50 dark:bg-gray-800/50'
                  )}
                >
                  {/* Участник */}
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <UserAvatar
                      userId={participant.id}
                      firstName={participant.firstName}
                      lastName={participant.lastName}
                      size="md"
                      className="w-10 h-10 flex-shrink-0"
                    />
                    
                    <div className="flex flex-col min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm text-gray-900 dark:text-white truncate">
                          {participant.firstName}{participant.lastName ? ` ${participant.lastName}` : ''}
                        </span>
                        {participant.id === currentUserId && (
                          <Badge variant="secondary" className="text-xs px-1.5 py-0">
                            Ты
                          </Badge>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
                        <span>{participant.dishEmoji}</span>
                        <span className="truncate">{participant.dishName}</span>
                      </div>
                    </div>
                  </div>

                  {/* Цена */}
                  <div className="text-sm font-semibold text-green-600 dark:text-green-400 flex-shrink-0 ml-2">
                    {participant.dishPrice} ₽
                  </div>
                </m.div>
              ))}

              {/* Итого */}
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <span className="font-semibold text-gray-900 dark:text-white">
                  💰 Общая сумма:
                </span>
                <span className="text-lg font-bold text-green-600 dark:text-green-400">
                  {totalAmount} ₽
                </span>
              </div>
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </m.div>
  );
};
