# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
# Install dependencies
npm install

# Run development server (Vite)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Environment Setup

Before running the app, ensure you have a `.env.local` file with:
```
GEMINI_API_KEY=your-api-key-here
```

## Architecture Overview

This is a React + TypeScript application built with Vite as the bundler. The project showcases a digital agency landing page with advanced parallax scrolling effects.

### Key Components

- **App.tsx**: Main application entry point that renders the Header component and placeholder content
- **Header.tsx**: Complex parallax scrolling header with a grid of phone mockups that move in opposite directions based on scroll position
- **PhoneMockup.tsx**: Reusable component for displaying video content inside phone frames
- **constants.ts**: Contains video configurations and other constants used throughout the app
- **types.ts**: TypeScript interface definitions for video info and other shared types

### Technical Details

- **Styling**: Uses Tailwind CSS with custom animations defined inline
- **State Management**: React hooks (useState, useEffect, useRef, useMemo) for local state
- **Build Configuration**: 
  - Vite configured with path aliases (`@/` maps to root directory)
  - Environment variables exposed via `process.env`
- **TypeScript**: Strict mode enabled with no unused locals/parameters allowed

### Parallax Implementation

The Header component implements a sophisticated parallax effect where:
- Phones in even columns move up while odd columns move down during scroll
- The effect duration is controlled by `PARALLAX_DURATION_VIEWPORTS` (3.5 viewport heights)
- Scroll progress is calculated relative to the sticky container position
- Maximum parallax offset is 50% for a pronounced visual effect

### Performance Considerations

- Uses `useMemo` to prevent recreation of phone configurations
- Scroll event listeners use passive mode for better performance
- Transitions are kept short (20ms) for responsive parallax movement