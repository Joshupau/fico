# Fico - Financial Management App

A hybrid mobile financial management application built with Next.js, Ionic React, and Capacitor.

## 🚀 Tech Stack

### Core Frameworks
- **Next.js 16** - React framework with static export for mobile deployment
- **Ionic React 8** - Native-looking UI components for iOS and Android
- **Capacitor 6** - Native runtime for building web apps as mobile apps
- **React Router DOM 5** - Client-side routing (compatible with Ionic)
- **TypeScript 5** - Type-safe development

### UI & Styling
- **Ionic Components** - IonCard, IonButton, IonInput, IonHeader, IonToolbar, etc.
- **Tailwind CSS 4** - Utility-first CSS framework
- **Ionicons** - Icon library for Ionic apps
- **Dark Mode** - Full dark mode support with Ionic theming

### State Management & Data
- **Zustand 5** - Lightweight state management
- **React Query 5** - Server state management (configured, ready to use)
- **Axios 1.13** - HTTP client for API calls

### Additional Features
- **React Hook Form** - Form validation
- **Zod** - Schema validation
- **crypto-js** - Encryption/decryption utilities
- **date-fns** - Date manipulation
- **recharts** - Chart library for data visualization

## 📱 Project Structure

```
fico/
├── app/                      # Next.js app directory
│   ├── layout.tsx           # Root layout with Ionic integration
│   ├── page.tsx             # Root page (redirects to signin)
│   ├── globals.css          # Global styles + Ionic theme
│   ├── ionic-theme.css      # Ionic CSS variables for dark/light mode
│   ├── signin/              # Auth pages
│   └── dashboard/           # Dashboard pages
├── components/
│   ├── AppShell.tsx         # Main Ionic app wrapper with routing
│   ├── navbar.tsx           # Ionic navbar with menu
│   └── theme-toggle.tsx     # Dark mode toggle button
├── pages/
│   ├── SignInPage.tsx       # Login page with IonPage wrapper
│   └── DashboardPage.tsx    # Dashboard page with IonPage wrapper
├── store/                   # Zustand stores
│   ├── auth-store.tsx       # Authentication state
│   ├── manage-user-store.ts # User management
│   └── theme-store.ts       # Dark mode state
├── hooks/
│   ├── use-mobile.ts        # Mobile detection hook
│   └── use-toast.ts         # Toast notification hook
├── utils/
│   ├── axios-instance.ts    # Configured Axios instance
│   ├── crypto.ts            # Encryption utilities
│   ├── error-handler.tsx    # Error handling middleware
│   └── formatter.ts         # Data formatters
├── queries/
│   └── query-provider.tsx   # React Query provider
├── android/                 # Android native project
├── ios/                     # iOS native project
├── capacitor.config.json    # Capacitor configuration
└── next.config.ts           # Next.js config (static export enabled)
```

## 🛠️ Development

### Prerequisites
- Node.js 18+ and npm
- Android Studio (for Android development)
- Xcode (for iOS development, macOS only)

### Installation

```bash
# Install dependencies
npm install --legacy-peer-deps

# Run development server
npm run dev
```

### Building for Production

```bash
# Build Next.js static export
npm run build

# Sync with native platforms
npm run cap:sync

# Open in native IDEs
npm run cap:open:android
npm run cap:open:ios

# Or run directly on device
npm run cap:run:android
npm run cap:run:ios
```

### Build and Deploy Mobile

```bash
# Build web app and sync to native platforms
npm run build:mobile
```

## 🎨 Theming & Dark Mode

The app supports dark mode using Ionic's theming system:

- **Light Mode**: Default theme with clean, modern design
- **Dark Mode**: Dark theme with proper contrast for OLED screens
- **Toggle**: Use the theme toggle button in the navbar
- **Persistence**: Theme preference saved to localStorage

Theme configuration in `app/ionic-theme.css` includes:
- Ionic color palette (primary, secondary, success, warning, danger, etc.)
- Background and text colors for both modes
- Card, toolbar, and item backgrounds

## 📦 Key Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| @capacitor/core | ^6.0.0 | Capacitor core functionality |
| @capacitor/android | ^6.0.0 | Android platform support |
| @capacitor/ios | ^6.0.0 | iOS platform support |
| @ionic/react | ^8.0.0 | Ionic React components |
| @ionic/react-router | ^8.0.0 | Ionic + React Router integration |
| next | 16.0.10 | Next.js framework |
| react | 19.2.0 | React library |
| react-router-dom | ^5.3.4 | Client-side routing |
| zustand | ^5.0.9 | State management |
| tailwindcss | ^4.1.9 | CSS framework |

## 🔄 Routing

The app uses React Router v5 (compatible with Ionic React Router):

- `/` - Root route (redirects to signin)
- `/signin` - Authentication page
- `/dashboard` - Main dashboard
- `/dashboard/transactions` - Transaction list (planned)
- `/dashboard/analytics` - Analytics page (planned)

## 🔐 Authentication

Authentication is managed through Zustand store:
- User credentials stored in `auth-store.tsx`
- Persistent storage with localStorage
- Encryption available via `utils/crypto.ts`

Current implementation uses mock authentication. To integrate real backend:
1. Update `utils/axios-instance.ts` with your API base URL
2. Implement login/logout API calls
3. Update auth store actions

## 📡 API Integration

React Query is configured and ready to use:

```typescript
import { useQuery } from '@tanstack/react-query';
import axiosInstance from '@/utils/axios-instance';

// Example query
const { data, isLoading } = useQuery({
  queryKey: ['transactions'],
  queryFn: () => axiosInstance.get('/api/transactions').then(res => res.data)
});
```

## 🎯 Next Steps

1. **Build the static export**: `npm run build`
2. **Test on device**: Use Android Studio or Xcode to run on emulator/device
3. **Implement backend API**: Connect to your financial data API
4. **Add more pages**: Transactions, Analytics, Profile, Settings
5. **Implement forms**: Use React Hook Form + Zod for validation
6. **Add native features**: Use Capacitor plugins for camera, geolocation, etc.

## 📝 Capacitor Configuration

The app is configured in `capacitor.config.json`:
- **App ID**: com.example.app (change this for production)
- **App Name**: nextjs-tailwind-capacitor
- **Web Dir**: out (Next.js static export directory)
- **Plugins**: SplashScreen configured

## 🚧 Development Notes

### Ionic vs shadcn Component Mapping

| shadcn/Radix | Ionic React | Notes |
|--------------|-------------|-------|
| Button | IonButton | Supports fill, expand, size props |
| Card | IonCard | With IonCardHeader, IonCardContent |
| Input | IonInput | Use with IonItem for better styling |
| Badge | IonBadge | Supports color prop |
| DropdownMenu | IonPopover | Use with trigger pattern |
| Dialog | IonModal | Full-screen or card modal |
| Separator | - | Use border-bottom CSS |
| Label | IonLabel | Use inside IonItem |

### Mobile Considerations

- Use `useIsMobile()` hook to detect mobile viewport
- Responsive grid: `grid-cols-1 md:grid-cols-2 lg:grid-cols-4`
- Mobile menu with IonMenu for drawer navigation
- Native-looking components adapt to iOS/Android automatically

### Static Export Limitations

Since we're using Next.js static export:
- No server-side rendering (SSR)
- No API routes (use external backend)
- No dynamic routes without pre-rendering
- All rendering happens client-side

## 📄 License

Private project - All rights reserved

## 👤 Author

Creative Brain Studios
