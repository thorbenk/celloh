/** Check the real DOM type once at the boundary instead of scattering casts and ! assertions. */
export function requireElement<T extends Element>(
  selector: string,
  elementType: { new (): T },
  root: ParentNode = document,
): T {
  const element = root.querySelector(selector);
  if (!(element instanceof elementType)) {
    throw new Error(`Expected ${elementType.name} at ${selector}`);
  }
  return element;
}
