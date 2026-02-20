import React, { useEffect, useState } from 'react';

interface GameOverProps {
  score: number;
  message: string;
  onRestart: () => void;
}

const GameOver: React.FC<GameOverProps> = ({ score, message, onRestart }) => {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-50 animate-fade-in">
      <div className="bg-slate-900 p-8 rounded-2xl shadow-2xl border border-red-900/50 text-center max-w-lg w-full">
        <h2 className="text-4xl font-bold text-red-500 mb-2">Game Over</h2>
        <div className="text-6xl font-black text-white mb-6">{score}</div>
        
        <div className="bg-slate-800 p-4 rounded-lg mb-8 border border-slate-700">
          <p className="text-lg text-green-300 italic">"{message}"</p>
        </div>

        <button
          onClick={onRestart}
          className="w-full bg-white text-slate-900 font-bold py-3 px-6 rounded-lg hover:bg-gray-200 transition transform hover:scale-105"
        >
          Play Again
        </button>
      </div>
    </div>
  );
};

export default GameOver;