import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { MenuForm } from '@/components/menu/MenuForm';
import { useMenu } from '@/hooks/useMenu';
import { useTelegram } from '@/hooks/useTelegram';
import { CreateMenuItemData, MenuItem } from '../services/menu.service';

export function EditMenuPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { showAlert, hapticFeedback } = useTelegram();
  const { updateItem, getItem } = useMenu({ autoFetch: false });
  
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [item, setItem] = useState<MenuItem | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch item on mount
  useEffect(() => {
    const fetchItem = async () => {
      if (!id) {
        setError('ID блюда не указан');
        setFetchLoading(false);
        return;
      }

      const numId = parseInt(id);
      if (isNaN(numId)) {
        setError('Неверный ID блюда');
        setFetchLoading(false);
        return;
      }

      try {
        const result = await getItem(numId);
        if (result) {
          setItem(result);
        } else {
          setError('Блюдо не найдено');
        }
      } catch (error) {
        console.error('Error fetching menu item:', error);
        setError('Ошибка загрузки блюда');
      } finally {
        setFetchLoading(false);
      }
    };

    fetchItem();
  }, [id, getItem]);

  const handleSubmit = async (data: CreateMenuItemData) => {
    if (!item) return;
    
    setLoading(true);
    
    try {
      const result = await updateItem(item.id, data);
      
      if (result) {
        showAlert?.('Блюдо успешно обновлено!', () => {
          navigate('/');
        });
      } else {
        showAlert?.('Ошибка при обновлении блюда. Попробуйте еще раз.');
      }
    } catch (error) {
      console.error('Error updating menu item:', error);
      showAlert?.('Произошла ошибка. Проверьте подключение к интернету.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    hapticFeedback?.impactOccurred('light');
    navigate('/');
  };

  // Loading state
  if (fetchLoading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-tg-button mx-auto mb-4"></div>
        <p className="text-tg-hint">Загрузка блюда...</p>
      </div>
    );
  }

  // Error state
  if (error || !item) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">❌</div>
        <h2 className="text-xl font-semibold text-tg-text mb-2">
          Ошибка
        </h2>
        <p className="text-tg-hint mb-4">
          {error || 'Блюдо не найдено'}
        </p>
        <button
          onClick={() => navigate('/')}
          className="btn btn-primary"
        >
          ← Вернуться к меню
        </button>
      </div>
    );
  }

  return (
    <MenuForm
      item={item}
      onSubmit={handleSubmit}
      onCancel={handleCancel}
      loading={loading}
    />
  );
}
