import React, { useState } from 'react';
import GameCanvas from './components/GameCanvas';
import MainMenu from './components/MainMenu';
import GameOver from './components/GameOver';
import { GameState } from './types';

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(GameState.MENU);
  const [playerName, setPlayerName] = useState<string>('');
  const [score, setScore] = useState<number>(0);
  const [gameOverMsg, setGameOverMsg] = useState<string>('');

  const handleStart = (name: string) => {
    setPlayerName(name);
    setScore(0);
    setGameState(GameState.PLAYING);
  };

  const handleGameOver = (finalScore: number, msg: string) => {
    setScore(finalScore);
    setGameOverMsg(msg);
    setGameState(GameState.GAME_OVER);
  };

  const handleRestart = () => {
    setGameState(GameState.PLAYING);
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-950 font-sans select-none">
      
      {/* Game Canvas Layer - Always Active */}
      <div className={`absolute inset-0 transition-all duration-700 ${gameState === GameState.MENU ? 'opacity-40 blur-sm scale-105' : 'opacity-100 scale-100'}`}>
         <GameCanvas 
            playerName={playerName} 
            gameState={gameState} 
            onGameOver={handleGameOver}
            onScoreUpdate={setScore}
         />
      </div>

      {/* UI Layers */}
      {gameState === GameState.MENU && <MainMenu onStart={handleStart} />}
      
      {gameState === GameState.GAME_OVER && (
        <GameOver 
            score={Math.floor(score)} 
            message={gameOverMsg} 
            onRestart={handleRestart} 
        />
      )}
      
      {/* Score Overlay (Playing) */}
      {gameState === GameState.PLAYING && (
         <div className="absolute bottom-4 left-6 pointer-events-none text-white drop-shadow-md">
             <div className="text-xl font-bold opacity-80">Length: {Math.floor(score)}</div>
         </div>
      )}
    </div>
  );
};

export default App;