import React from 'react';
import { Share2 } from 'lucide-react';
import { Button } from '../ui/button';
import { useTelegram } from '../../hooks/useTelegram';

interface InviteButtonProps {
  pollId?: number;
}

export const InviteButton: React.FC<InviteButtonProps> = ({ pollId }) => {
  const { webApp, hapticFeedback } = useTelegram();

  const handleInvite = () => {
    hapticFeedback.impactOccurred('light');
    
    const shareUrl = pollId 
      ? `${window.location.origin}?pollId=${pollId}`
      : window.location.origin;
    
    const shareText = pollId
      ? '🗳️ Присоединяйся к голосованию за обед!'
      : '🍽️ Присоединяйся к нашему боту для выбора обедов!';

    webApp.openTelegramLink(
      `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`
    );
  };

  return (
    <Button
      variant="outline"
      size="lg"
      className="w-full"
      onClick={handleInvite}
    >
      <Share2 className="size-5 mr-2" />
      Пригласить друга
    </Button>
  );
};
