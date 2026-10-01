import 'expo-router';

declare module 'expo-router' {
  type Href = string;

  export const router: {
    push: (href: Href) => void;
    replace: (href: Href) => void;
    back: () => void;
  };

  export function useRouter(): typeof router;
  export function useSegments(): string[];
  export function useFocusEffect(effect: () => void | (() => void)): void;
}
