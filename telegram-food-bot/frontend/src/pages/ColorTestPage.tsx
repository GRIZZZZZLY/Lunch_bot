import React from 'react';
import { useAppStore } from '../store/useAppStore';
import { Sun, Moon } from 'lucide-react';
import { motion } from 'framer-motion';

export const ColorTestPage: React.FC = () => {
  const { theme, setTheme } = useAppStore((state) => ({
    theme: state.theme,
    setTheme: state.setTheme,
  }));

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
            🎨 Тест пастельных цветов
          </h1>
          
          {/* Theme Toggle */}
          <div className="flex items-center justify-center gap-4 py-4">
            <Sun size={24} className={`transition-colors ${
              theme === 'light' ? 'text-orange-500' : 'text-gray-400 dark:text-gray-600'
            }`} />
            
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className={`relative w-16 h-8 rounded-full transition-all duration-300 ${
                theme === 'dark' 
                  ? 'bg-slate-600 dark:bg-slate-700' 
                  : 'bg-gray-300'
              }`}
              aria-label="Переключить тему"
            >
              <motion.span
                layout
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                className={`absolute top-1 w-6 h-6 rounded-full bg-white shadow-md ${
                  theme === 'dark' ? 'left-9' : 'left-1'
                }`}
              />
            </button>
            
            <Moon size={24} className={`transition-colors ${
              theme === 'dark' ? 'text-blue-400' : 'text-gray-400'
            }`} />
          </div>
          
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Текущая тема: <span className="font-bold">{theme === 'dark' ? 'Темная' : 'Светлая'}</span>
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
            HTML класс: <code className="bg-gray-200 dark:bg-slate-800 px-2 py-1 rounded">
              {document.documentElement.classList.contains('dark') ? 'dark' : 'light'}
            </code>
          </p>
        </div>

        {/* Bluegray */}
        <div className="space-y-3">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Bluegray (Голубовато-серый)
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-bluegray-300 p-4 rounded-lg">
              <p className="text-slate-900 font-medium">bluegray-300</p>
              <p className="text-xs text-slate-800">#9FB3C8</p>
            </div>
            <div className="bg-bluegray-400 p-4 rounded-lg">
              <p className="text-slate-900 font-medium">bluegray-400</p>
              <p className="text-xs text-slate-800">#829AB1</p>
            </div>
            <div className="bg-bluegray-500 p-4 rounded-lg">
              <p className="text-white font-medium">bluegray-500</p>
              <p className="text-xs text-slate-100">#627D98</p>
            </div>
            <div className="bg-bluegray-600 p-4 rounded-lg">
              <p className="text-white font-medium">bluegray-600</p>
              <p className="text-xs text-slate-100">#486581</p>
            </div>
          </div>
          
          {/* Text colors */}
          <div className="bg-slate-800 p-4 rounded-lg">
            <p className="text-bluegray-300 text-lg">Текст bluegray-300 на темном фоне</p>
            <p className="text-bluegray-400 text-lg">Текст bluegray-400 на темном фоне</p>
          </div>
        </div>

        {/* Lavender */}
        <div className="space-y-3">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Lavender (Лиловый)
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-lavender-300 p-4 rounded-lg">
              <p className="text-slate-900 font-medium">lavender-300</p>
              <p className="text-xs text-slate-800">#C4B5FD</p>
            </div>
            <div className="bg-lavender-400 p-4 rounded-lg">
              <p className="text-slate-900 font-medium">lavender-400</p>
              <p className="text-xs text-slate-800">#A78BFA</p>
            </div>
            <div className="bg-lavender-500 p-4 rounded-lg">
              <p className="text-white font-medium">lavender-500</p>
              <p className="text-xs text-slate-100">#8B5CF6</p>
            </div>
            <div className="bg-lavender-600 p-4 rounded-lg">
              <p className="text-white font-medium">lavender-600</p>
              <p className="text-xs text-slate-100">#7C3AED</p>
            </div>
          </div>
          
          {/* Text colors */}
          <div className="bg-slate-800 p-4 rounded-lg">
            <p className="text-lavender-300 text-lg">Текст lavender-300 на темном фоне</p>
            <p className="text-lavender-400 text-lg">Текст lavender-400 на темном фоне</p>
          </div>
        </div>

        {/* Peach */}
        <div className="space-y-3">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Peach (Персиковый)
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-peach-300 p-4 rounded-lg">
              <p className="text-slate-900 font-medium">peach-300</p>
              <p className="text-xs text-slate-800">#D4A574</p>
            </div>
            <div className="bg-peach-400 p-4 rounded-lg">
              <p className="text-slate-900 font-medium">peach-400</p>
              <p className="text-xs text-slate-800">#C78A5C</p>
            </div>
            <div className="bg-peach-500 p-4 rounded-lg">
              <p className="text-white font-medium">peach-500</p>
              <p className="text-xs text-slate-100">#B97447</p>
            </div>
            <div className="bg-peach-600 p-4 rounded-lg">
              <p className="text-white font-medium">peach-600</p>
              <p className="text-xs text-slate-100">#A05E35</p>
            </div>
          </div>
          
          {/* Text colors */}
          <div className="bg-slate-800 p-4 rounded-lg">
            <p className="text-peach-300 text-lg">Текст peach-300 на темном фоне</p>
            <p className="text-peach-400 text-lg">Текст peach-400 на темном фоне</p>
          </div>
        </div>

        {/* Success Soft */}
        <div className="space-y-3">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Success Soft (Мягкий зелёный)
          </h2>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-success-soft-200 p-4 rounded-lg">
              <p className="text-slate-900 font-medium">success-soft-200</p>
              <p className="text-xs text-slate-800">#C5E6D5</p>
            </div>
            <div className="bg-success-soft-300 p-4 rounded-lg">
              <p className="text-slate-900 font-medium">success-soft-300</p>
              <p className="text-xs text-slate-800">#9FD4B3</p>
            </div>
            <div className="bg-success-soft-400 p-4 rounded-lg">
              <p className="text-white font-medium">success-soft-400</p>
              <p className="text-xs text-slate-100">#6BA882</p>
            </div>
          </div>
          
          {/* Text colors */}
          <div className="bg-slate-800 p-4 rounded-lg">
            <p className="text-success-soft-300 text-lg">Текст success-soft-300 на темном фоне</p>
          </div>
        </div>

        {/* Warning Soft */}
        <div className="space-y-3">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Warning Soft (Мягкий жёлтый)
          </h2>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-warning-soft-200 p-4 rounded-lg">
              <p className="text-slate-900 font-medium">warning-soft-200</p>
              <p className="text-xs text-slate-800">#E6DEBA</p>
            </div>
            <div className="bg-warning-soft-300 p-4 rounded-lg">
              <p className="text-slate-900 font-medium">warning-soft-300</p>
              <p className="text-xs text-slate-800">#D9D394</p>
            </div>
            <div className="bg-warning-soft-400 p-4 rounded-lg">
              <p className="text-white font-medium">warning-soft-400</p>
              <p className="text-xs text-slate-100">#C5A66D</p>
            </div>
          </div>
          
          {/* Text colors */}
          <div className="bg-slate-800 p-4 rounded-lg">
            <p className="text-warning-soft-300 text-lg">Текст warning-soft-300 на темном фоне</p>
          </div>
        </div>

        {/* Error Soft */}
        <div className="space-y-3">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Error Soft (Мягкий красный)
          </h2>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-error-soft-200 p-4 rounded-lg">
              <p className="text-slate-900 font-medium">error-soft-200</p>
              <p className="text-xs text-slate-800">#E6C5C5</p>
            </div>
            <div className="bg-error-soft-300 p-4 rounded-lg">
              <p className="text-slate-900 font-medium">error-soft-300</p>
              <p className="text-xs text-slate-800">#D4A5A5</p>
            </div>
            <div className="bg-error-soft-400 p-4 rounded-lg">
              <p className="text-white font-medium">error-soft-400</p>
              <p className="text-xs text-slate-100">#B87171</p>
            </div>
          </div>
          
          {/* Text colors */}
          <div className="bg-slate-800 p-4 rounded-lg">
            <p className="text-error-soft-300 text-lg">Текст error-soft-300 на темном фоне</p>
          </div>
        </div>

        {/* Opacity test */}
        <div className="space-y-3">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Тест Opacity (фоны с прозрачностью)
          </h2>
          <div className="bg-slate-800 p-4 rounded-lg space-y-3">
            <div className="bg-bluegray-400/20 p-4 rounded border border-bluegray-400/30">
              <p className="text-bluegray-300">bluegray-400/20 фон</p>
              <p className="text-sm text-bluegray-400">hover: bluegray-400/30</p>
            </div>
            <div className="bg-peach-500/20 p-4 rounded border border-peach-400/30">
              <p className="text-peach-300">peach-500/20 фон</p>
              <p className="text-sm text-peach-400">hover: peach-400/30</p>
            </div>
            <div className="bg-success-soft-400/20 p-4 rounded border border-success-soft-400/30">
              <p className="text-success-soft-300">success-soft-400/20 фон</p>
            </div>
          </div>
        </div>

        {/* Applied example */}
        <div className="space-y-3">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Примеры кнопок (как в MenuItemCard)
          </h2>
          <div className="space-y-3">
            <button className="flex items-center space-x-1 text-xs font-medium px-3 py-2 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 dark:bg-bluegray-400/20 dark:hover:bg-bluegray-400/30 dark:text-bluegray-300 transition-colors">
              Изменить (bluegray)
            </button>
            <button className="flex items-center space-x-1 text-xs font-medium px-3 py-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 dark:bg-error-soft-400/20 dark:hover:bg-error-soft-400/30 dark:text-error-soft-300 transition-colors">
              Удалить (error-soft)
            </button>
            <button className="flex items-center space-x-1 text-xs font-medium px-3 py-2 rounded-lg bg-green-50 hover:bg-green-100 text-green-600 dark:bg-success-soft-400/20 dark:hover:bg-success-soft-400/30 dark:text-success-soft-300 transition-colors">
              Активно (success-soft)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
