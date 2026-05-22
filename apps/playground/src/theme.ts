import { alpha, createTheme } from "@mui/material/styles";

export type PlaygroundThemeMode = "dark" | "light";

interface PlaygroundPalette {
  readonly background: string;
  readonly card: string;
  readonly foreground: string;
  readonly input: string;
  readonly muted: string;
  readonly mutedForeground: string;
  readonly popover: string;
  readonly primary: string;
  readonly primaryContainer: string;
  readonly primaryForeground: string;
  readonly ring: string;
  readonly secondary: string;
  readonly secondaryForeground: string;
  readonly surface: string;
  readonly surfaceContainer: string;
  readonly surfaceContainerHigh: string;
  readonly surfaceContainerHighest: string;
  readonly surfaceContainerLow: string;
  readonly border: string;
  readonly destructive: string;
}

const palettes: Record<PlaygroundThemeMode, PlaygroundPalette> = {
  light: {
    background: "#f6f8fb",
    card: "#ffffff",
    foreground: "#1c2127",
    input: "#c7d0dc",
    muted: "#eef2f6",
    mutedForeground: "#657282",
    popover: "#ffffff",
    primary: "#0b5cad",
    primaryContainer: "#d7e7ff",
    primaryForeground: "#ffffff",
    ring: "#4b8fd8",
    secondary: "#4f5f72",
    secondaryForeground: "#ffffff",
    surface: "#fbfcfe",
    surfaceContainer: "#eef3f8",
    surfaceContainerHigh: "#e5ebf2",
    surfaceContainerHighest: "#dae2ec",
    surfaceContainerLow: "#f5f7fa",
    border: "#d4dce7",
    destructive: "#c23030",
  },
  dark: {
    background: "#11161d",
    card: "#171d25",
    foreground: "#e8edf3",
    input: "#3a4654",
    muted: "#202833",
    mutedForeground: "#9caaba",
    popover: "#1b222c",
    primary: "#8ab4f8",
    primaryContainer: "#17385f",
    primaryForeground: "#07111f",
    ring: "#6ea2e6",
    secondary: "#aab6c5",
    secondaryForeground: "#101820",
    surface: "#151b23",
    surfaceContainer: "#1b232d",
    surfaceContainerHigh: "#222b36",
    surfaceContainerHighest: "#2a3541",
    surfaceContainerLow: "#131920",
    border: "#303b48",
    destructive: "#ff8a80",
  },
};

export function getPlaygroundCssVariables(mode: PlaygroundThemeMode): Record<string, string> {
  const palette = palettes[mode];
  return {
    "--background": palette.background,
    "--foreground": palette.foreground,
    "--card": palette.card,
    "--card-foreground": palette.foreground,
    "--popover": palette.popover,
    "--popover-foreground": palette.foreground,
    "--primary": palette.primary,
    "--primary-foreground": palette.primaryForeground,
    "--secondary": palette.surfaceContainerHigh,
    "--secondary-foreground": palette.foreground,
    "--muted": palette.muted,
    "--muted-foreground": palette.mutedForeground,
    "--accent": palette.primaryContainer,
    "--accent-foreground": palette.foreground,
    "--destructive": palette.destructive,
    "--border": palette.border,
    "--input": palette.input,
    "--ring": palette.ring,
    "--chart-1": palette.primary,
    "--chart-2": "#5f9ea6",
    "--chart-3": "#7e8dd6",
    "--chart-4": "#d6994f",
    "--chart-5": palette.destructive,
    "--sidebar": palette.surfaceContainer,
    "--sidebar-foreground": palette.foreground,
    "--sidebar-primary": palette.primary,
    "--sidebar-primary-foreground": palette.primaryForeground,
    "--sidebar-accent": palette.surfaceContainerHigh,
    "--sidebar-accent-foreground": palette.foreground,
    "--sidebar-border": palette.border,
    "--sidebar-ring": palette.ring,
    "--radius": "0.375rem",
  };
}

export function applyPlaygroundThemeMode(mode: PlaygroundThemeMode) {
  document.documentElement.dataset["theme"] = mode;
  document.documentElement.classList.toggle("dark", mode === "dark");
  document.documentElement.style.colorScheme = mode;
  const variables = getPlaygroundCssVariables(mode);
  for (const [name, value] of Object.entries(variables)) {
    document.documentElement.style.setProperty(name, value);
  }
}

export function createPlaygroundTheme(mode: PlaygroundThemeMode) {
  const palette = palettes[mode];
  const isDark = mode === "dark";
  const hover = alpha(palette.primary, isDark ? 0.16 : 0.08);
  const selected = alpha(palette.primary, isDark ? 0.24 : 0.14);

  return createTheme({
    palette: {
      mode,
      primary: {
        main: palette.primary,
        contrastText: palette.primaryForeground,
      },
      secondary: {
        main: palette.secondary,
        contrastText: palette.secondaryForeground,
      },
      error: {
        main: palette.destructive,
      },
      background: {
        default: palette.background,
        paper: palette.card,
      },
      divider: palette.border,
      text: {
        primary: palette.foreground,
        secondary: palette.mutedForeground,
      },
      action: {
        hover,
        selected,
        focus: alpha(palette.ring, 0.24),
        disabled: alpha(palette.foreground, 0.34),
        disabledBackground: alpha(palette.foreground, 0.08),
      },
    },
    shape: {
      borderRadius: 4,
    },
    spacing: 4,
    typography: {
      fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
      fontSize: 13,
      htmlFontSize: 16,
      h1: { fontSize: 24, fontWeight: 650, lineHeight: 1.2 },
      h2: { fontSize: 20, fontWeight: 650, lineHeight: 1.25 },
      h3: { fontSize: 17, fontWeight: 650, lineHeight: 1.3 },
      h4: { fontSize: 15, fontWeight: 650, lineHeight: 1.35 },
      h5: { fontSize: 14, fontWeight: 650, lineHeight: 1.4 },
      h6: { fontSize: 13, fontWeight: 650, lineHeight: 1.4 },
      body1: { fontSize: 13, lineHeight: 1.45 },
      body2: { fontSize: 12, lineHeight: 1.4 },
      button: { fontSize: 12, fontWeight: 600, letterSpacing: 0, textTransform: "none" },
      caption: { fontSize: 11, lineHeight: 1.35 },
      overline: { fontSize: 10, fontWeight: 650, letterSpacing: 0, textTransform: "uppercase" },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            backgroundColor: palette.background,
            color: palette.foreground,
            fontSize: 13,
          },
          "::selection": {
            backgroundColor: alpha(palette.primary, 0.24),
          },
        },
      },
      MuiButton: {
        defaultProps: {
          disableElevation: true,
          size: "small",
        },
        styleOverrides: {
          root: {
            borderRadius: 4,
            minHeight: 28,
            padding: "3px 10px",
          },
          sizeSmall: {
            minHeight: 26,
            padding: "2px 8px",
          },
          containedPrimary: {
            backgroundColor: palette.primary,
          },
          outlined: {
            backgroundColor: palette.surface,
            borderColor: palette.border,
            color: palette.foreground,
            "&:hover": {
              backgroundColor: hover,
              borderColor: palette.ring,
            },
          },
          text: {
            color: palette.foreground,
            "&:hover": {
              backgroundColor: hover,
            },
          },
        },
      },
      MuiIconButton: {
        defaultProps: {
          size: "small",
        },
        styleOverrides: {
          root: {
            borderRadius: 4,
            height: 28,
            padding: 4,
            width: 28,
            "&:hover": {
              backgroundColor: hover,
            },
          },
          sizeMedium: {
            height: 30,
            width: 30,
          },
        },
      },
      MuiChip: {
        defaultProps: {
          size: "small",
        },
        styleOverrides: {
          root: {
            borderRadius: 4,
            fontSize: 11,
            fontWeight: 600,
            height: 20,
          },
          label: {
            paddingLeft: 6,
            paddingRight: 6,
          },
          outlined: {
            backgroundColor: palette.surface,
            borderColor: palette.border,
          },
          filledSecondary: {
            backgroundColor: palette.surfaceContainerHighest,
            color: palette.foreground,
          },
        },
      },
      MuiFormControl: {
        defaultProps: {
          margin: "dense",
          size: "small",
        },
      },
      MuiInputBase: {
        styleOverrides: {
          root: {
            fontSize: 12,
          },
          input: {
            paddingBottom: 5,
            paddingTop: 5,
          },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            backgroundColor: palette.surface,
            borderRadius: 4,
            minHeight: 30,
            "& .MuiOutlinedInput-notchedOutline": {
              borderColor: palette.border,
            },
            "&:hover .MuiOutlinedInput-notchedOutline": {
              borderColor: palette.ring,
            },
            "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
              borderColor: palette.ring,
              borderWidth: 1,
              boxShadow: `0 0 0 2px ${alpha(palette.ring, 0.18)}`,
            },
          },
          input: {
            padding: "5px 8px",
          },
        },
      },
      MuiSelect: {
        defaultProps: {
          size: "small",
        },
        styleOverrides: {
          select: {
            minHeight: "unset",
            paddingBottom: 5,
            paddingTop: 5,
          },
        },
      },
      MuiMenu: {
        defaultProps: {
          elevation: 2,
        },
        styleOverrides: {
          paper: {
            backgroundColor: palette.popover,
            border: `1px solid ${palette.border}`,
            borderRadius: 4,
          },
          list: {
            paddingBottom: 4,
            paddingTop: 4,
          },
        },
      },
      MuiMenuItem: {
        styleOverrides: {
          root: {
            borderRadius: 3,
            fontSize: 12,
            marginLeft: 4,
            marginRight: 4,
            minHeight: 28,
            paddingBottom: 4,
            paddingTop: 4,
            "&.Mui-selected": {
              backgroundColor: selected,
            },
            "&.Mui-selected:hover": {
              backgroundColor: alpha(palette.primary, isDark ? 0.3 : 0.18),
            },
          },
        },
      },
      MuiToggleButtonGroup: {
        styleOverrides: {
          root: {
            backgroundColor: palette.surface,
            borderRadius: 4,
          },
        },
      },
      MuiToggleButton: {
        styleOverrides: {
          root: {
            borderColor: palette.border,
            borderRadius: 4,
            color: palette.foreground,
            fontSize: 12,
            minHeight: 28,
            padding: "3px 9px",
            textTransform: "none",
            "&.Mui-selected": {
              backgroundColor: selected,
              color: palette.foreground,
            },
            "&.Mui-selected:hover": {
              backgroundColor: alpha(palette.primary, isDark ? 0.3 : 0.18),
            },
          },
        },
      },
      MuiCheckbox: {
        defaultProps: {
          size: "small",
        },
        styleOverrides: {
          root: {
            padding: 4,
          },
        },
      },
      MuiFormControlLabel: {
        styleOverrides: {
          root: {
            marginLeft: -4,
            marginRight: 0,
          },
          label: {
            fontSize: 12,
          },
        },
      },
      MuiTextField: {
        defaultProps: {
          margin: "dense",
          size: "small",
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            backgroundColor: palette.card,
            borderColor: palette.border,
          },
        },
      },
      MuiPaper: {
        defaultProps: {
          elevation: 0,
        },
        styleOverrides: {
          root: {
            backgroundImage: "none",
          },
          outlined: {
            borderColor: palette.border,
          },
        },
      },
      MuiTooltip: {
        styleOverrides: {
          tooltip: {
            borderRadius: 4,
            fontSize: 11,
          },
        },
      },
    },
  });
}
