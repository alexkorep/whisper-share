import React from 'react';
import '../App.css'; // Corrected path

interface TabBarProps {
  onTabChange: (tab: string) => void;
  activeTab: string;
}

const TabBar: React.FC<TabBarProps> = ({ onTabChange, activeTab }) => {
  return (
    <nav className="TabBarNav">
      <button onClick={() => onTabChange('home')} className={activeTab === 'home' ? 'active' : ''}>Home</button>
      <button onClick={() => onTabChange('history')} className={activeTab === 'history' ? 'active' : ''}>History</button>
      <button onClick={() => onTabChange('settings')} className={activeTab === 'settings' ? 'active' : ''}>Settings</button>
    </nav>
  );
};

export default TabBar;
