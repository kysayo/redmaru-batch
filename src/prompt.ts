export function waitForEnter(message: string): Promise<void> {
  console.log(message);
  return new Promise((resolve) => {
    process.stdin.resume();
    process.stdin.once('data', () => {
      process.stdin.pause();
      resolve();
    });
  });
}
