// Static data service replacing AI dependencies
const BOT_NAMES = [
  "Snek", "Python", "Anaconda", "Viper", "Cobra", "Mamba", "Sidewinder", 
  "Rattler", "Boa", "Noodle", "Worm", "Slider", "Hiss", "Fang", "Venom", 
  "Slither", "Scale", "Serpent", "Basilisk", "Hydra", "Titanoboa", 
  "Danger Noodle", "Nope Rope", "Slippy", "Glider"
];

const DEATH_MESSAGES = [
  "Better luck next time!",
  "Ouch! That looked painful.",
  "Watch your head!",
  "Greed is not good.",
  "Trapped!",
  "So close to the leaderboard!",
  "Snakes don't have brakes.",
  "Nom nom nom...",
  "You became food.",
  "Try boosting less next time."
];

export const generateBotNames = async (count: number): Promise<string[]> => {
  // Return random selection from static list
  const names: string[] = [];
  for (let i = 0; i < count; i++) {
    names.push(BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)]);
  }
  return names;
};

export const getGameOverCommentary = async (score: number, killedBy: string): Promise<string> => {
  if (killedBy === "The World Border") return "Don't hit the wall!";
  return DEATH_MESSAGES[Math.floor(Math.random() * DEATH_MESSAGES.length)];
};