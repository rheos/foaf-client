export interface FoafUiTheme {
  colors: {
    background: string;
    surface: string;
    text: string;
    mutedText: string;
    border: string;
    primary: string;
    primaryText: string;
    danger: string;
    positive: string;
  };
  spacing: { xs: number; sm: number; md: number; lg: number };
  radii: { sm: number; md: number; lg: number };
  typography?: {
    bodySize?: number;
    titleSize?: number;
  };
}
