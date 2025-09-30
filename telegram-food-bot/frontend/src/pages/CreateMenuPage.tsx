import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MenuForm } from '@/components/menu/MenuForm';
import { useMenu } from '@/hooks/useMenu';
import { useTelegram } from '@/hooks/useTelegram';
import { CreateMenuItemData } from '../services/menu.service';

export function CreateMenuPage() {
  const navigate = useNavigate();
  const { showAlert, hapticFeedback } = useTelegram();
  const { createItem } = useMenu({ autoFetch: false });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (data: CreateMenuItemData) => {
    setLoading(true);
    
    try {
      const result = await createItem(data);
      
      if (result) {
        showAlert?.('Блюдо успешно добавлено!', () => {
          navigate('/');
        });
      } else {
        showAlert?.('Ошибка при создании блюда. Попробуйте еще раз.');
      }
    } catch (error) {
      console.error('Error creating menu item:', error);
      showAlert?.('Произошла ошибка. Проверьте подключение к интернету.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    hapticFeedback?.impactOccurred('light');
    navigate('/');
  };

  return (
    <MenuForm
      onSubmit={handleSubmit}
      onCancel={handleCancel}
      loading={loading}
    />
  );
}
