export function installCommand(packageManager: string): string {
  if (packageManager === 'npm') return 'npm install';
  return `${packageManager} install`;
}
