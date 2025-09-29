import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import Login from "@/pages/login";
import Events from "@/pages/events";
import Participants from "@/pages/participants";
import AllParticipants from "@/pages/all-participants";
import Settings from "@/pages/settings";
import PublicEvent from "@/pages/public-event";
import Setup from "@/pages/setup";
import NotFound from "@/pages/not-found";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useLogout } from "@/hooks/useAuth";
import { Calendar, Users, Settings as SettingsIcon, LogOut, Menu } from "lucide-react";

function Dashboard() {
  const [currentPage, setCurrentPage] = useState<"events" | "participants" | "all-participants" | "settings">("events");
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const [selectedEventName, setSelectedEventName] = useState<string>("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const logout = useLogout();
  const { user } = useAuth();

  const handleViewParticipants = (eventId: number, eventName?: string) => {
    setSelectedEventId(eventId);
    setSelectedEventName(eventName || "");
    setCurrentPage("participants");
    setMobileMenuOpen(false); // Close mobile menu when navigating
  };

  const handleBackToEvents = () => {
    setCurrentPage("events");
    setSelectedEventId(null);
    setSelectedEventName("");
  };

  const handleLogout = () => {
    logout.mutate();
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-white shadow-sm border-b">
        <div className="flex items-center justify-between h-16 px-4">
          <div className="flex items-center">
            <div className="bg-primary/10 w-8 h-8 rounded-lg flex items-center justify-center mr-3">
              <Users className="text-primary h-5 w-5" />
            </div>
            <span className="font-semibold text-gray-900 text-sm">Управление</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="h-10 w-10"
          >
            <Menu className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-black bg-opacity-50" onClick={() => setMobileMenuOpen(false)} />
      )}

      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 w-52 md:w-52 bg-white shadow-lg transform transition-transform duration-300 ease-in-out ${
        mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
      }`}>
        <div className="flex items-center h-16 px-4 border-b">
          <div className="bg-primary/10 w-8 h-8 rounded-lg flex items-center justify-center mr-3">
            <Users className="text-primary h-5 w-5" />
          </div>
          <span className="font-semibold text-gray-900 text-sm">Управление мероприятиями</span>
        </div>
        
        <nav className="mt-6">
          <button
            onClick={() => {
              setCurrentPage("events");
              setMobileMenuOpen(false);
            }}
            className={`sidebar-link w-full text-left ${
              currentPage === "events" ? "sidebar-link-active" : ""
            }`}
          >
            <Calendar className="w-5 h-5 mr-3" />
            Мероприятия
          </button>
          <button
            onClick={() => {
              setCurrentPage("all-participants");
              setMobileMenuOpen(false);
            }}
            className={`sidebar-link w-full text-left ${
              currentPage === "all-participants" ? "sidebar-link-active" : ""
            }`}
          >
            <Users className="w-5 h-5 mr-3" />
            Все участники
          </button>
          {selectedEventId && (
            <button
              onClick={() => {
                setCurrentPage("participants");
                setMobileMenuOpen(false);
              }}
              className={`sidebar-link w-full text-left ${
                currentPage === "participants" ? "sidebar-link-active" : ""
              }`}
            >
              <Users className="w-5 h-5 mr-3 flex-shrink-0" />
              <div className="min-w-0 flex-1 overflow-hidden">
                <div>Участники</div>
                {selectedEventName && (
                  <div className="mt-1 pr-2">
                    <span className="inline-block px-2 py-0.5 text-xs bg-blue-100 text-blue-800 rounded-full truncate max-w-full block">
                      {selectedEventName}
                    </span>
                  </div>
                )}
              </div>
            </button>
          )}
          <button 
            className={`sidebar-link w-full text-left ${
              currentPage === "settings" ? "sidebar-link-active" : ""
            }`}
            onClick={() => {
              setCurrentPage("settings");
              setMobileMenuOpen(false);
            }}
          >
            <SettingsIcon className="w-5 h-5 mr-3" />
            Настройки
          </button>
        </nav>
        
        <div className="absolute bottom-0 left-0 right-0 p-6 border-t">
          <Button
            variant="ghost"
            onClick={handleLogout}
            className="w-full justify-start text-gray-600 hover:text-red-600"
            disabled={logout.isPending}
          >
            <LogOut className="w-4 h-4 mr-2" />
            Выход
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="md:pl-52 pt-16 md:pt-0">
        {/* Header - Hidden on mobile */}
        <header className="hidden md:block bg-white shadow-sm border-b h-16">
          <div className="flex items-center justify-between px-6 h-full">
            <h1 className="text-xl font-semibold text-gray-900">
              {currentPage === "events" ? "Мероприятия" : 
               currentPage === "participants" ? "Участники мероприятия" :
               currentPage === "all-participants" ? "Все участники" :
               "Настройки системы"}
            </h1>
            <div className="text-sm text-gray-600">
              Администратор: <span className="font-medium">{user?.username}</span>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main>
          {currentPage === "events" && (
            <Events onViewParticipants={handleViewParticipants} />
          )}
          {currentPage === "participants" && selectedEventId && (
            <Participants 
              eventId={selectedEventId} 
              onBack={handleBackToEvents}
            />
          )}
          {currentPage === "all-participants" && (
            <AllParticipants 
              onBack={() => setCurrentPage("events")}
            />
          )}
          {currentPage === "settings" && (
            <Settings />
          )}
        </main>
      </div>
    </div>
  );
}

function AuthenticatedApp() {
  const { user, isLoading, isAuthenticated } = useAuth();
  const { data: setupStatus, isLoading: setupLoading } = useQuery({
    queryKey: ["/api/setup/status"],
    retry: false,
  });

  if (isLoading || setupLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // If setup is not complete, show setup wizard
  if (setupStatus && !(setupStatus as any).isComplete) {
    return <Setup />;
  }

  if (!isAuthenticated) {
    return <Login />;
  }

  return <Dashboard />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <div className="min-h-screen">
          <Switch>
            <Route path="/public/:shareCode" component={PublicEvent} />
            <Route path="*" component={AuthenticatedApp} />
          </Switch>
          <Toaster />
        </div>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
