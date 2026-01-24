import React from 'react';
import { 
  Home, 
  Users, 
  BookOpen, 
  DollarSign, 
  Menu, 
  Database 
} from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const Layout: React.FC<LayoutProps> = ({ children, activeTab, setActiveTab }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  const navItems = [
    { id: 'dashboard', label: 'Visão Geral', icon: Home },
    { id: 'classes', label: 'Turmas', icon: BookOpen },
    { id: 'students', label: 'Alunos', icon: Users },
    { id: 'financial', label: 'Financeiro', icon: DollarSign },
    { id: 'sql', label: 'Database Setup', icon: Database },
  ];

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Mobile Menu Button */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <button 
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 bg-white rounded-md shadow-md"
        >
          <Menu className="w-6 h-6 text-gray-700" />
        </button>
      </div>

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-40 w-64 bg-slate-900 text-white transform transition-transform duration-200 ease-in-out
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:relative lg:translate-x-0
      `}>
        <div className="flex items-center justify-center h-20 border-b border-slate-800">
          <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-teal-400">
            Rise UP
          </h1>
        </div>
        <nav className="mt-6 px-4 space-y-2">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setActiveTab(item.id);
                setIsMobileMenuOpen(false);
              }}
              className={`
                flex items-center w-full px-4 py-3 text-sm font-medium rounded-lg transition-colors
                ${activeTab === item.id 
                  ? 'bg-blue-600 text-white shadow-lg' 
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'}
              `}
            >
              <item.icon className="w-5 h-5 mr-3" />
              {item.label}
            </button>
          ))}
        </nav>
        
        <div className="absolute bottom-0 w-full p-4 border-t border-slate-800">
          <div className="flex items-center">
            <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-xs font-bold">
              AD
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-white">Admin</p>
              <p className="text-xs text-slate-500">admin@riseup.school</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-4 lg:p-8">
        <div className="max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;