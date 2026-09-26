import { Palette } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { THEMES } from "@/lib/themes";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0"
          title="Change theme"
        >
          <Palette className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
          App Theme
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {THEMES.map((t) => (
          <DropdownMenuItem
            key={t.id}
            onClick={() => setTheme(t.id)}
            className={cn(
              "flex items-center gap-3 cursor-pointer",
              theme === t.id && "font-medium text-primary",
            )}
          >
            {/* Swatch mini preview */}
            <span className="flex shrink-0 gap-0.5">
              {t.swatches.slice(0, 3).map((c) => (
                <span
                  key={c}
                  className="h-3.5 w-3.5 rounded-full border border-black/10"
                  style={{ backgroundColor: c }}
                />
              ))}
            </span>
            <span className="truncate text-sm">{t.name}</span>
            {theme === t.id && (
              <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
