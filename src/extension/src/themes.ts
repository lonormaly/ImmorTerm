/**
 * ImmorTerm Status Bar Themes
 *
 * Each theme defines a gradient of colors for the status bar:
 * - bg1: Project name background (darkest/leftmost)
 * - bg2: Separator "/"
 * - bg3: Window title
 * - bg4: "Last Active:" label
 * - bg5: Timestamp value (uses %I escape - zero polling!)
 * - bg6: "ImmorTerm" branding (lightest/rightmost)
 * - fg: Default foreground (text) color
 * - fgAccent: Accent foreground for "Last Active:" label
 */

export interface Theme {
  name: string;
  bg1: string;  // Project name (darkest)
  bg2: string;  // Separator "/"
  bg3: string;  // Window title
  bg4: string;  // "Last Active:" label
  bg5: string;  // Timestamp value
  bg6: string;  // "ImmorTerm" branding (was memory, now branding)
  bg7: string;  // Kept for backward compatibility
  fg: string;
  fgAccent: string;
}

export const themes: Record<string, Theme> = {
  'Purple Haze': {
    name: 'Purple Haze',
    bg1: '#2D004D',
    bg2: '#3D1A6D',
    bg3: '#4D2A7D',
    bg4: '#5B2C8A',
    bg5: '#6B3FA0',
    bg6: '#7B52B8',
    bg7: '#8B008B',
    fg: '#FFFFFF',
    fgAccent: '#E0B0FF',
  },
  'Ocean Depths': {
    name: 'Ocean Depths',
    bg1: '#001F3F',
    bg2: '#003366',
    bg3: '#00447A',
    bg4: '#004C8C',
    bg5: '#0066B3',
    bg6: '#0080D9',
    bg7: '#00A0E0',
    fg: '#FFFFFF',
    fgAccent: '#87CEEB',
  },
  'Forest Canopy': {
    name: 'Forest Canopy',
    bg1: '#0D2818',
    bg2: '#1A4028',
    bg3: '#204C30',
    bg4: '#265838',
    bg5: '#337048',
    bg6: '#408858',
    bg7: '#4CA068',
    fg: '#FFFFFF',
    fgAccent: '#90EE90',
  },
  'Sunset Glow': {
    name: 'Sunset Glow',
    bg1: '#4A1C1C',
    bg2: '#6B2D2D',
    bg3: '#7E3636',
    bg4: '#8C3E3E',
    bg5: '#AD4F4F',
    bg6: '#CE6060',
    bg7: '#E07020',
    fg: '#FFFFFF',
    fgAccent: '#FFD700',
  },
  'Midnight Blue': {
    name: 'Midnight Blue',
    bg1: '#0D1B2A',
    bg2: '#1B263B',
    bg3: '#223248',
    bg4: '#293D55',
    bg5: '#37546F',
    bg6: '#456B89',
    bg7: '#5382A3',
    fg: '#FFFFFF',
    fgAccent: '#B0C4DE',
  },
  'Rose Gold': {
    name: 'Rose Gold',
    bg1: '#3D1F2B',
    bg2: '#5C2E41',
    bg3: '#6C364C',
    bg4: '#7B3D57',
    bg5: '#9A4C6D',
    bg6: '#B95B83',
    bg7: '#D86A99',
    fg: '#FFFFFF',
    fgAccent: '#FFB6C1',
  },
  'Cyberpunk': {
    name: 'Cyberpunk',
    bg1: '#0D0221',
    bg2: '#1A0A3E',
    bg3: '#240E4C',
    bg4: '#2D1259',
    bg5: '#541388',
    bg6: '#7B1FA2',
    bg7: '#FF006E',
    fg: '#00FFFF',
    fgAccent: '#FF00FF',
  },
  'Nord': {
    name: 'Nord',
    bg1: '#2E3440',
    bg2: '#3B4252',
    bg3: '#3F4859',
    bg4: '#434C5E',
    bg5: '#4C566A',
    bg6: '#5E81AC',
    bg7: '#81A1C1',
    fg: '#ECEFF4',
    fgAccent: '#88C0D0',
  },
  'Dracula': {
    name: 'Dracula',
    bg1: '#21222C',
    bg2: '#282A36',
    bg3: '#2E303E',
    bg4: '#343746',
    bg5: '#44475A',
    bg6: '#6272A4',
    bg7: '#BD93F9',
    fg: '#F8F8F2',
    fgAccent: '#FF79C6',
  },
  'Monokai': {
    name: 'Monokai',
    bg1: '#1E1E1E',
    bg2: '#272822',
    bg3: '#30302A',
    bg4: '#383830',
    bg5: '#49483E',
    bg6: '#5A584C',
    bg7: '#A6E22E',
    fg: '#F8F8F2',
    fgAccent: '#F92672',
  },
  'Solarized Dark': {
    name: 'Solarized Dark',
    bg1: '#002B36',
    bg2: '#073642',
    bg3: '#0C404D',
    bg4: '#104B58',
    bg5: '#19606E',
    bg6: '#227584',
    bg7: '#2AA198',
    fg: '#FDF6E3',
    fgAccent: '#B58900',
  },
  'Gruvbox': {
    name: 'Gruvbox',
    bg1: '#1D2021',
    bg2: '#282828',
    bg3: '#32302F',
    bg4: '#3C3836',
    bg5: '#504945',
    bg6: '#665C54',
    bg7: '#D65D0E',
    fg: '#EBDBB2',
    fgAccent: '#FE8019',
  },
  'Tokyo Night': {
    name: 'Tokyo Night',
    bg1: '#16161E',
    bg2: '#1A1B26',
    bg3: '#1F2231',
    bg4: '#24283B',
    bg5: '#2F3549',
    bg6: '#3D4257',
    bg7: '#7AA2F7',
    fg: '#C0CAF5',
    fgAccent: '#BB9AF7',
  },
  'One Dark': {
    name: 'One Dark',
    bg1: '#1E2127',
    bg2: '#282C34',
    bg3: '#2D323B',
    bg4: '#323842',
    bg5: '#3E4451',
    bg6: '#4B5263',
    bg7: '#61AFEF',
    fg: '#ABB2BF',
    fgAccent: '#C678DD',
  },
  'Catppuccin': {
    name: 'Catppuccin',
    bg1: '#1E1E2E',
    bg2: '#252536',
    bg3: '#2B2B3D',
    bg4: '#313244',
    bg5: '#45475A',
    bg6: '#585B70',
    bg7: '#CBA6F7',
    fg: '#CDD6F4',
    fgAccent: '#F5C2E7',
  },
  'Synthwave': {
    name: 'Synthwave',
    bg1: '#1A1A2E',
    bg2: '#262640',
    bg3: '#2C2C49',
    bg4: '#323252',
    bg5: '#4A3F6B',
    bg6: '#614385',
    bg7: '#FF2E97',
    fg: '#FFFFFF',
    fgAccent: '#00F3FF',
  },
  'Monochrome Dark': {
    name: 'Monochrome Dark',
    bg1: '#000000',
    bg2: '#1A1A1A',
    bg3: '#2D2D2D',
    bg4: '#404040',
    bg5: '#555555',
    bg6: '#6A6A6A',
    bg7: '#808080',
    fg: '#FFFFFF',
    fgAccent: '#CCCCCC',
  },
  'Monochrome Light': {
    name: 'Monochrome Light',
    bg1: '#FFFFFF',
    bg2: '#F0F0F0',
    bg3: '#E0E0E0',
    bg4: '#D0D0D0',
    bg5: '#C0C0C0',
    bg6: '#B0B0B0',
    bg7: '#A0A0A0',
    fg: '#000000',
    fgAccent: '#333333',
  },
  'Crimson': {
    name: 'Crimson',
    bg1: '#1A0000',
    bg2: '#330000',
    bg3: '#4D0000',
    bg4: '#660000',
    bg5: '#800000',
    bg6: '#990000',
    bg7: '#CC0000',
    fg: '#FFFFFF',
    fgAccent: '#FF6666',
  },
};

/**
 * Get a theme by name, falling back to Purple Haze if not found
 */
export function getTheme(name: string): Theme {
  return themes[name] || themes['Purple Haze'];
}

/**
 * Generate the hardstatus line for a given theme
 * Layout: [project] [/] [title] ... [Last Active:] [time] [ImmorTerm]
 *         bg1       bg2  bg3        bg4            bg5    bg6
 * Note: %I = last I/O activity timestamp (ImmorTerm C code feature - zero polling!)
 */
export function generateHardstatus(theme: Theme): string {
  return `'%{= ${theme.fg};${theme.bg1}} %2\` %{= ${theme.fg};${theme.bg2}} / %{= ${theme.fg};${theme.bg3}} %t %=%{= ${theme.fgAccent};${theme.bg4}} Last Active: %{= ${theme.fg};${theme.bg5}} %I %{= ${theme.fg};${theme.bg6}} ImmorTerm %{-}'`;
}

/**
 * List all available theme names
 */
export function getThemeNames(): string[] {
  return Object.keys(themes);
}

/**
 * Theme display labels with emojis for UI pickers
 */
export const themeLabels: Record<string, string> = {
  'Purple Haze': '🟣 Purple Haze',
  'Ocean Depths': '🔵 Ocean Depths',
  'Forest Canopy': '🟢 Forest Canopy',
  'Sunset Glow': '🟠 Sunset Glow',
  'Midnight Blue': '🔷 Midnight Blue',
  'Rose Gold': '🩷 Rose Gold',
  'Cyberpunk': '💜 Cyberpunk',
  'Nord': '🧊 Nord',
  'Dracula': '🧛 Dracula',
  'Monokai': '🌈 Monokai',
  'Solarized Dark': '☀️ Solarized Dark',
  'Gruvbox': '🟤 Gruvbox',
  'Tokyo Night': '🌃 Tokyo Night',
  'One Dark': '🌑 One Dark',
  'Catppuccin': '🐱 Catppuccin',
  'Synthwave': '🌆 Synthwave',
  'Monochrome Dark': '⬛ Monochrome Dark',
  'Monochrome Light': '⬜ Monochrome Light',
  'Crimson': '🔴 Crimson',
};

/**
 * Get the display label for a theme (with emoji)
 */
export function getThemeLabel(name: string): string {
  return themeLabels[name] || name;
}
