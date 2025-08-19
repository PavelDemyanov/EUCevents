import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Calendar, MapPin, Users, Plus, Eye, Edit, Trash2 } from "lucide-react";
import type { EventWithStats } from "@shared/schema";

export default function Events() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: events = [], isLoading } = useQuery({
    queryKey: ["/api/events"],
  });

  const deleteEventMutation = useMutation({
    mutationFn: async (eventId: number) => {
      await apiRequest("DELETE", `/api/events/${eventId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      toast({
        title: "Успешно",
        description: "Мероприятие удалено",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось удалить мероприятие",
        variant: "destructive",
      });
    },
  });

  const filteredEvents = (events as EventWithStats[]).filter((event) => {
    const matchesSearch = event.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         event.location.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = !statusFilter || 
                         (statusFilter === "active" && event.isActive) ||
                         (statusFilter === "inactive" && !event.isActive);
    return matchesSearch && matchesStatus;
  });

  const handleDeleteEvent = (eventId: number) => {
    if (confirm("Вы уверены, что хотите удалить это мероприятие?")) {
      deleteEventMutation.mutate(eventId);
    }
  };

  const formatDateTime = (date: string) => {
    return new Intl.DateTimeFormat('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(date));
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-200 rounded-xl" />
            ))}
          </div>
          <div className="h-96 bg-gray-200 rounded-xl" />
        </div>
      </div>
    );
  }

  const totalEvents = events.length;
  const totalParticipants = events.reduce((sum: number, event: EventWithStats) => sum + event.participantCount, 0);
  const totalBots = 3; // Placeholder - should come from API
  const todayRegistrations = 15; // Placeholder - should come from API

  return (
    <div className="p-6 space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="stats-card-blue p-3 rounded-lg">
                <Calendar className="h-6 w-6" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">Всего мероприятий</p>
                <p className="text-2xl font-bold text-gray-900">{totalEvents}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="stats-card-green p-3 rounded-lg">
                <Users className="h-6 w-6" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">Активных участников</p>
                <p className="text-2xl font-bold text-gray-900">{totalParticipants}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="stats-card-purple p-3 rounded-lg">
                <i className="fab fa-telegram-plane text-xl" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">Подключенных ботов</p>
                <p className="text-2xl font-bold text-gray-900">{totalBots}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="stats-card-orange p-3 rounded-lg">
                <i className="fas fa-chart-line text-xl" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">Регистраций сегодня</p>
                <p className="text-2xl font-bold text-gray-900">{todayRegistrations}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Events Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Список мероприятий</CardTitle>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Создать мероприятие
            </Button>
          </div>
          <div className="flex items-center space-x-4 mt-4">
            <Input
              placeholder="Поиск мероприятий..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1"
            />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Все статусы" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Все статусы</SelectItem>
                <SelectItem value="active">Активные</SelectItem>
                <SelectItem value="inactive">Завершенные</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Название
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Место проведения
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Дата и время
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Участников
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Статус
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Действия
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredEvents.map((event) => (
                  <tr key={event.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium text-gray-900">{event.name}</div>
                      <div className="text-sm text-gray-500">ID: #{event.id}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div className="flex items-center gap-1">
                        <MapPin className="h-4 w-4" />
                        {event.location}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDateTime(event.datetime.toString())}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{event.participantCount} участников</div>
                      <div className="text-xs text-gray-500">
                        {event.monowheelCount} моноколес, {event.scooterCount} самокатов, {event.spectatorCount} зрителей
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge variant={event.isActive ? "default" : "secondary"}>
                        {event.isActive ? "Активное" : "Завершено"}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                      <Button variant="ghost" size="sm" className="gap-1">
                        <Eye className="h-4 w-4" />
                        Участники
                      </Button>
                      <Button variant="ghost" size="sm" className="gap-1">
                        <Edit className="h-4 w-4" />
                        Редактировать
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="gap-1 text-red-600 hover:text-red-900"
                        onClick={() => handleDeleteEvent(event.id)}
                        disabled={deleteEventMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                        Удалить
                      </Button>
                    </td>
                  </tr>
                ))}
                {filteredEvents.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                      Мероприятия не найдены
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
