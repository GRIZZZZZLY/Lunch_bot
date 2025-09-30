import { useState } from 'react';
import { MenuPage } from './pages/MenuPage';
import { StatsPage } from './pages/StatsPage';
import { Navigation } from './components/layout/Layout';

function App() {
  const [currentTab, setCurrentTab] = useState<string>('menu');

  const renderCurrentPage = () => {
    switch (currentTab) {
      case 'menu':
        return <MenuPage />;
      case 'stats':
        return <StatsPage />;
      default:
        return <MenuPage />;
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1">
        {renderCurrentPage()}
      </div>
      <Navigation currentTab={currentTab} onTabChange={setCurrentTab} />
    </div>
  );
}

export default App;
