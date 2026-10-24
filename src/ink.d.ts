/** An ink file, compiled to its JSON when the game is built (vite.config.ts; DIALOGUE.md). */
declare module '*.ink' {
  const json: string;
  export default json;
}
