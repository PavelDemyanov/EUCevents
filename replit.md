# Event Management System with Telegram Bot

## Overview

This is a full-stack web application with an integrated Telegram bot for managing events and participant registration. The system allows administrators to create and manage events through a web interface while participants can register via Telegram bots. The application supports multiple events, participant management, automated PDF report generation, and comprehensive data editing capabilities for registered participants.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript using Vite as the build tool
- **UI Library**: Shadcn/ui components built on Radix UI primitives
- **Styling**: Tailwind CSS with CSS variables for theming
- **State Management**: TanStack Query (React Query) for server state management
- **Routing**: Wouter for client-side routing
- **Forms**: React Hook Form with Zod validation via @hookform/resolvers

### Backend Architecture
- **Runtime**: Node.js with Express.js server
- **Language**: TypeScript with ES modules
- **Database ORM**: Drizzle ORM with PostgreSQL dialect
- **Session Management**: Express sessions with configurable storage
- **Authentication**: Session-based authentication with bcrypt for password hashing
- **File Generation**: PDFKit for generating participant lists as PDF documents

### Data Storage Solutions
- **Primary Database**: PostgreSQL via Neon serverless connection
- **Connection Pooling**: Neon serverless pool with WebSocket support
- **Schema Management**: Drizzle migrations with shared schema definitions
- **Tables**: Users, Events, Bots, Chats, ReservedNumbers, AdminUsers

### Authentication and Authorization
- **Admin Authentication**: Username/password with bcrypt hashing
- **Session Management**: Express sessions with HTTP-only cookies
- **Default Credentials**: admin/admin123 (auto-created on first run)
- **Route Protection**: Middleware-based authentication checks for admin routes

### External Dependencies

- **Database**: Neon PostgreSQL serverless database
- **Telegram Bot API**: node-telegram-bot-api for bot integration
- **UI Components**: Radix UI primitives for accessible components
- **Development Tools**: Replit-specific plugins for development environment
- **Fonts**: Google Fonts (Inter, DM Sans, Fira Code, Geist Mono, Architects Daughter)
- **Build Tools**: Vite for frontend bundling, esbuild for server bundling
- **Validation**: Zod for runtime type validation and schema definition