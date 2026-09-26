import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  DEFAULT_THEME,
  THEME_STORAGE_KEY,
  THEMES,
  type ThemeId,
} from "@/lib/themes";

interface ThemeContextValue {
  theme: ThemeId;
  setTheme: (theme: ThemeId) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: DEFAULT_THEME,
  setTheme: () => {},
});

function isThemeId(value: string | null): value is ThemeId {
  return THEMES.some((t) => t.id === value);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>(DEFAULT_THEME);

  // Restore saved theme after hydration (localStorage is browser-only).
  useEffect(() => {
    const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (isThemeId(saved)) setThemeState(saved);
  }, []);

  useEffect(() => {
    document.documentElement.dataset["theme"] = theme;
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme: setThemeState }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
