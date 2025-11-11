import { useState, useEffect } from 'react';
import { pollsService } from '../services/polls.service';
import { useUI } from '../store/useAppStore';
import { useTelegram } from './useTelegram';

/**
 * Hook for managing multiple vote selection
 * Handles selecting/deselecting menu items and submitting votes
 */
export const useMultipleVotes = (pollId: number | null, isActive: boolean) => {
  const [selectedItemIds, setSelectedItemIds] = useState<number[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const { addNotification } = useUI();
  const { hapticFeedback } = useTelegram();

  // Load user's existing votes
  useEffect(() => {
    if (!pollId || !isActive) {
      setLoading(false);
      return;
    }

    const loadUserVotes = async () => {
      try {
        const response = await pollsService.getUserVotes(pollId);
        if (response.success && response.data) {
          setSelectedItemIds(response.data.menuItemIds || []);
          console.log('✅ Loaded user votes:', response.data.menuItemIds);
        }
      } catch (error) {
        console.error('Error loading user votes:', error);
      } finally {
        setLoading(false);
      }
    };

    loadUserVotes();
  }, [pollId, isActive]);

  /**
   * Toggle selection of a menu item
   */
  const toggleItem = (itemId: number) => {
    if (!isActive) return;

    hapticFeedback.selectionChanged();

    setSelectedItemIds(prev => {
      if (prev.includes(itemId)) {
        // Deselect
        return prev.filter(id => id !== itemId);
      } else {
        // Select
        return [...prev, itemId];
      }
    });
  };

  /**
   * Check if item is selected
   */
  const isSelected = (itemId: number): boolean => {
    return selectedItemIds.includes(itemId);
  };

  /**
   * Submit all selected votes
   */
  const submitVotes = async (): Promise<boolean> => {
    if (!pollId || submitting) return false;

    try {
      setSubmitting(true);
      hapticFeedback.impactOccurred('light');

      const response = await pollsService.voteForMultipleItems(pollId, selectedItemIds);

      if (response.success) {
        hapticFeedback.notificationOccurred('success');
        addNotification({
          type: 'success',
          message: `✓ Голоса учтены! Выбрано блюд: ${selectedItemIds.length}`,
        });
        return true;
      } else {
        throw new Error(response.error || 'Failed to submit votes');
      }
    } catch (error) {
      console.error('Error submitting votes:', error);
      hapticFeedback.notificationOccurred('error');
      addNotification({
        type: 'error',
        message: 'Ошибка при голосовании',
      });
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  /**
   * Clear all selections
   */
  const clearSelection = () => {
    setSelectedItemIds([]);
  };

  return {
    selectedItemIds,
    selectedCount: selectedItemIds.length,
    toggleItem,
    isSelected,
    submitVotes,
    clearSelection,
    submitting,
    loading,
  };
};
