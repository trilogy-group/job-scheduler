import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        accent: {
          300: '#00ccf9',
          500: '#00a1c8',
        },
        ok: '#67bb6b',
        warn: '#f3ae58',
        bad: '#f04c5a',
        idle: '#86909b',
        bg: '#0a0e11',
        'bg-elev': '#13161a',
        'bg-hover': '#1c2024',
        fg: '#f8f8f8',
        'fg-muted': '#9a9fa5',
        'fg-subtle': '#6d7277',
        'border-synapse': '#23272b',
        'border-strong': '#373b40',
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          'Inter',
          'Segoe UI',
          'Helvetica',
          'Arial',
          'sans-serif',
        ],
        mono: [
          'ui-monospace',
          'SFMono-Regular',
          'SF Mono',
          'Menlo',
          'Monaco',
          'Cascadia Mono',
          'Consolas',
          'monospace',
        ],
      },
      borderRadius: {
        sm: '4px',
        md: '6px',
        lg: '10px',
        xl: '14px',
        full: '9999px',
      },
    },
  },
  plugins: [],
};

export default config;
