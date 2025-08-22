# EUCevents - Event Management System with Telegram Bot

## Overview

Repository: https://github.com/PavelDemyanov/EUCevents

This is a full-stack web application with an integrated Telegram bot for managing events and participant registration. The system allows administrators to create and manage events through a web interface while participants can register via Telegram bots. The application supports multiple events, participant management, automated PDF report generation, and comprehensive data editing capabilities for registered participants.

## User Preferences

Preferred communication style: Simple, everyday language.
Phone number format preference: Accept multiple input formats (8XXXXXXXXXX, +7XXXXXXXXXX, 7XXXXXXXXXX) but store as 7XXXXXXXXXX and display as +7 (XXX) XXX-XX-XX throughout the system.

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

### Recent Updates (August 21, 2025)

- **Event Description Field (Completed)**: Added comprehensive description support for events
  - Added 900-character description field to events database schema
  - Enhanced event creation and editing forms with textarea and character counter
  - Added description display in events list, participant pages, and public event pages
  - Integrated description display in Telegram bot messages for enhanced user context
  - Professional UI design with consistent styling across all pages

- **Bot UX Improvements (Completed)**: Enhanced Telegram bot user experience
  - Added "🏠 Домой" button after registration/editing completion for easy navigation
  - Implemented arbitrary message handling - bot now responds to any message (like "привет", "алло") with current events list
  - Replaced text command links with user-friendly buttons in bot responses
  - Fixed TypeScript compilation errors in telegram-bot.ts
  - Improved bot polling conflict management to prevent multiple bot instances
  - Added webhook clearing on bot startup to resolve polling conflicts
  - Enhanced error handling and logging for bot message processing
  
- **Location Dropdown Fix (Completed)**: Fixed event creation form location dropdown
  - Location dropdown now correctly shows all unique locations from existing events
  - Added detailed logging for location API debugging
  - Confirmed proper data flow from database through API to frontend

- **Electric Board Transport Type (Completed)**: Added comprehensive support for "электро-борд" (electric board/e-board) transport type
  - Updated database schema and all related components to support new transport type "eboard"
  - Enhanced Telegram bot with electric board option (🛹 icon) in transport selection menus
  - Added electric board statistics display in participants page with orange color scheme
  - Updated PDF generation to include electric board count in summary sections
  - Enhanced public event pages with electric board support and proper color coding
  - Added CSS styling for electric board participant number badges (orange theme)
  - Fixed all TypeScript compilation errors across the system
  - Changed electric board emoji from 🏄 to 🛹 across all interfaces (August 21, 2025)
  - System now supports 4 transport types: monowheel (🛞), scooter (🛴), electric board (🛹), spectator (👀)

- **Local Database Setup (August 22, 2025)**: Complete PostgreSQL setup package for local deployment
  - Created comprehensive SQL database dump (database_dump.sql) with complete schema and default admin user
  - Generated LOCAL_SETUP.md with detailed installation instructions for Ubuntu/Debian, CentOS/RHEL, macOS, and Windows
  - Added automated setup script (setup_local_db.sh) for one-command database configuration
  - Created .env.local.example with all necessary environment variables for local deployment
  - Included systemd service configuration for production Linux deployment
  - Database includes all tables: events, users, admin_users, bots, chats, reserved_numbers, fixed_number_bindings, event_chats
  - Default admin credentials: admin/admin123 (bcrypt hashed)
  - Support for all transport types with proper array handling in PostgreSQL

- **Local Installation Fixes (August 22, 2025)**: Fixed critical issues in local deployment
  - Fixed database permissions issues by creating database_setup_script.sql without owner dependencies
  - Resolved port conflicts by changing server host from 0.0.0.0 to 127.0.0.1 and removing reusePort
  - Fixed ES modules compatibility in server/db.ts for local PostgreSQL connections
  - Updated install-macos-arm.sh to automatically clone repository and apply all fixes
  - Enhanced QUICK_FIX_CLONE.md with complete troubleshooting guide
  - All installation scripts now work end-to-end without manual intervention

- **Previous Updates (August 20, 2025)**:
  - **Public Event Sharing Feature**: Added public event sharing with generated share codes (format: XXX-YYYY-ZZZ)
  - **Public Pages**: Created public event view without phone numbers and admin functions
  - **Database Schema**: Added shareCode field to events table for public sharing
  - **Share Button**: Added "Поделиться" button on participants page that opens public link in new window
  - **Mobile UI Improvements**: Comprehensive mobile responsiveness across all pages with reduced sidebar width, responsive grid layouts, mobile headers
  - **Admin Management System**: Added full admin user management with login/password creation, role-based access control, and admin dashboard in settings
  - **Enhanced Database Schema**: Extended adminUsers table with fullName, email, isActive, isSuperAdmin fields for comprehensive user management
  - **Deployment Setup Wizard**: Created first-run setup wizard for initial administrator creation and bot configuration
  - **Production Ready**: Added comprehensive README with installation instructions and production deployment guide
  - **Local Server Support**: Full local server installation with PostgreSQL setup and system service configuration