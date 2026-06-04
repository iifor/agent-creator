export function toKebabCase(value: string): string {
  return value
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .toLowerCase();
}

export function toCamelCase(value: string): string {
  const kebab = toKebabCase(value);
  return kebab.replace(/-([a-z0-9])/g, (_, char: string) => char.toUpperCase());
}

export function toToolName(value: string): string {
  const normalized = toKebabCase(value).replace(/-/g, '.');
  return normalized.includes('.') ? normalized : `${normalized}.run`;
}

export function assertSafeName(value: string): void {
  if (!/^[a-zA-Z0-9_-]+$/.test(value)) {
    throw new Error('Name may only contain letters, numbers, underscores, and hyphens.');
  }
}
