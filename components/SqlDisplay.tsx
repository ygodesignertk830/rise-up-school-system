import React, { useState, useEffect } from 'react';
import { Copy, Check } from 'lucide-react';

const SqlDisplay: React.FC = () => {
  const [sqlContent, setSqlContent] = useState('Loading...');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch('/supabase_setup.sql')
      .then(res => res.text())
      .then(text => setSqlContent(text))
      .catch(err => setSqlContent('-- Error loading SQL file'));
  }, []);

  const handleCopy = () => {
    navigator.clipboard.writeText(sqlContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Setup do Banco de Dados</h2>
          <p className="text-gray-500">Copie este script e execute no SQL Editor do Supabase.</p>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
          {copied ? 'Copiado!' : 'Copiar SQL'}
        </button>
      </div>
      
      <div className="relative">
        <pre className="bg-slate-900 text-slate-100 p-6 rounded-xl overflow-x-auto text-sm font-mono leading-relaxed h-[600px] shadow-inner">
          <code>{sqlContent}</code>
        </pre>
      </div>
    </div>
  );
};

export default SqlDisplay;