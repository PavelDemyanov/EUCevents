import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import Login from "@/pages/login";
import Events from "@/pages/events";
import Participants from "@/pages/participants";
import NotFound from "@/pages/not-found";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useLogout } from "@/hooks/useAuth";
import { Calendar, Users, Settings, LogOut, Menu } from "lucide-react";

function Dashboard() {
  const [currentPage, setCurrentPage] = useState<"events" | "participants">("events");
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const logout = useLogout();
  const { user } = useAuth();

  const handleViewParticipants = (eventId: number) => {
    setSelectedEventId(eventId);
    setCurrentPage("participants");
  };

  const handleBackToEvents = () => {
    setCurrentPage("events");
    setSelectedEventId(null);
  };

  const handleLogout = () => {
    logout.mutate();
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Sidebar */}
      <div className="fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg">
        <div className="flex items-center h-16 px-6 border-b">
          <div className="bg-primary/10 w-8 h-8 rounded-lg flex items-center justify-center mr-3">
            <Users className="text-primary h-5 w-5" />
          </div>
          <span className="font-semibold text-gray-900">Управление мероприятиями</span>
        </div>
        
        <nav className="mt-6">
          <button
            onClick={() => setCurrentPage("events")}
            className={`sidebar-link w-full text-left ${
              currentPage === "events" ? "sidebar-link-active" : ""
            }`}
          >
            <Calendar className="w-5 h-5 mr-3" />
            Мероприятия
          </button>
          {selectedEventId && (
            <button
              onClick={() => setCurrentPage("participants")}
              className={`sidebar-link w-full text-left ${
                currentPage === "participants" ? "sidebar-link-active" : ""
              }`}
            >
              <Users className="w-5 h-5 mr-3" />
              Участники
            </button>
          )}
          <button className="sidebar-link w-full text-left">
            <Settings className="w-5 h-5 mr-3" />
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
      <div className="pl-64">
        {/* Header */}
        <header className="bg-white shadow-sm border-b h-16 flex items-center justify-between px-6">
          <h1 className="text-xl font-semibold text-gray-900">
            {currentPage === "events" ? "Мероприятия" : "Участники мероприятия"}
          </h1>
          <div className="text-sm text-gray-600">
            Администратор: <span className="font-medium">{user?.username}</span>
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
        </main>
      </div>
    </div>
  );
}

function AuthenticatedApp() {
  const { user, isLoading, isAuthenticated } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
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
        <Toaster />
        <AuthenticatedApp />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
