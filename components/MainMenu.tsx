import React, { useState } from 'react';
import { GameState } from '../types';

interface MainMenuProps {
  onStart: (name: string) => void;
}

const MainMenu: React.FC<MainMenuProps> = ({ onStart }) => {
  const [name, setName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onStart(name || "Player 1");
  };

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-50">
      <div className="bg-slate-900 p-8 rounded-2xl shadow-2xl border border-slate-700 text-center max-w-md w-full">
        <h1 className="text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-blue-500 mb-6 tracking-tight">
          SlitherClone
        </h1>
        <p className="text-gray-400 mb-8">
          Eat orbs, grow longer, cut off other snakes.
        </p>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            maxLength={12}
            placeholder="Nickname"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-4 py-3 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500 transition"
          />
          <button
            type="submit"
            className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold py-3 px-6 rounded-lg transform transition hover:scale-105 active:scale-95"
          >
            Play Now
          </button>
        </form>
      </div>
    </div>
  );
};

export default MainMenu;