import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Calendar, MapPin, Users, Plus, Eye, Edit, Trash2 } from "lucide-react";
import type { EventWithStats } from "@shared/schema";

interface EventsProps {
  onViewParticipants?: (eventId: number) => void;
}

export default function Events({ onViewParticipants }: EventsProps = {}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EventWithStats | null>(null);
  const [newEvent, setNewEvent] = useState({
    name: "",
    location: "",
    datetime: "",
    chatId: 1
  });
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: events = [], isLoading } = useQuery({
    queryKey: ["/api/events"],
  });

  const { data: chats = [] } = useQuery({
    queryKey: ["/api/chats"],
  });

  const createEventMutation = useMutation({
    mutationFn: async (eventData: typeof newEvent) => {
      await apiRequest("POST", "/api/events", eventData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      setShowCreateDialog(false);
      setNewEvent({ name: "", location: "", datetime: "", chatId: 1 });
      toast({
        title: "Успешно",
        description: "Мероприятие создано",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось создать мероприятие",
        variant: "destructive",
      });
    },
  });

  const editEventMutation = useMutation({
    mutationFn: async ({ eventId, eventData }: { eventId: number; eventData: any }) => {
      await apiRequest("PUT", `/api/events/${eventId}`, eventData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      setShowEditDialog(false);
      setEditingEvent(null);
      toast({
        title: "Успешно",
        description: "Мероприятие обновлено",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось обновить мероприятие",
        variant: "destructive",
      });
    },
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
    const matchesStatus = !statusFilter || statusFilter === "all" ||
                         (statusFilter === "active" && event.isActive) ||
                         (statusFilter === "inactive" && !event.isActive);
    return matchesSearch && matchesStatus;
  });

  const handleCreateEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEvent.name || !newEvent.location || !newEvent.datetime) {
      toast({
        title: "Ошибка",
        description: "Заполните все поля",
        variant: "destructive",
      });
      return;
    }
    createEventMutation.mutate(newEvent);
  };

  const handleEditEvent = (event: EventWithStats) => {
    setEditingEvent(event);
    setShowEditDialog(true);
  };

  const handleUpdateEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEvent) return;
    
    editEventMutation.mutate({
      eventId: editingEvent.id,
      eventData: {
        name: editingEvent.name,
        location: editingEvent.location,
        datetime: editingEvent.datetime,
        chatId: editingEvent.chatId,
        isActive: editingEvent.isActive,
      },
    });
  };

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

  const eventsTyped = events as EventWithStats[];
  const totalEvents = eventsTyped.length;
  const totalParticipants = eventsTyped.reduce((sum: number, event: EventWithStats) => sum + event.participantCount, 0);
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
            <Button 
              className="gap-2"
              onClick={() => setShowCreateDialog(true)}
            >
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
                <SelectItem value="all">Все статусы</SelectItem>
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
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="gap-1"
                        onClick={() => onViewParticipants?.(event.id)}
                      >
                        <Eye className="h-4 w-4" />
                        Участники
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="gap-1"
                        onClick={() => handleEditEvent(event)}
                      >
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

      {/* Create Event Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Создать новое мероприятие</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateEvent} className="space-y-4">
            <div>
              <Label htmlFor="name">Название мероприятия</Label>
              <Input
                id="name"
                value={newEvent.name}
                onChange={(e) => setNewEvent({ ...newEvent, name: e.target.value })}
                placeholder="Введите название мероприятия"
                required
              />
            </div>
            <div>
              <Label htmlFor="location">Место проведения</Label>
              <Input
                id="location"
                value={newEvent.location}
                onChange={(e) => setNewEvent({ ...newEvent, location: e.target.value })}
                placeholder="Введите место проведения"
                required
              />
            </div>
            <div>
              <Label htmlFor="datetime">Дата и время</Label>
              <Input
                id="datetime"
                type="datetime-local"
                value={newEvent.datetime}
                onChange={(e) => setNewEvent({ ...newEvent, datetime: e.target.value })}
                required
              />
            </div>
            <div>
              <Label htmlFor="chat">Telegram-чат</Label>
              <select
                id="chat"
                value={newEvent.chatId}
                onChange={(e) => setNewEvent({ ...newEvent, chatId: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                required
              >
                {chats.length === 0 ? (
                  <option value="">Нет доступных чатов</option>
                ) : (
                  chats.map((chat: any) => (
                    <option key={chat.id} value={chat.id}>
                      {chat.title} (ID: {chat.chatId})
                    </option>
                  ))
                )}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Настройте чаты в разделе "Настройки"
              </p>
            </div>
            <div className="flex justify-end space-x-2">
              <Button 
                type="button" 
                variant="outline"
                onClick={() => setShowCreateDialog(false)}
              >
                Отмена
              </Button>
              <Button 
                type="submit"
                disabled={createEventMutation.isPending}
              >
                {createEventMutation.isPending ? "Создание..." : "Создать"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Event Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Редактировать мероприятие</DialogTitle>
          </DialogHeader>
          {editingEvent && (
            <form onSubmit={handleUpdateEvent} className="space-y-4">
              <div>
                <Label htmlFor="edit-name">Название мероприятия</Label>
                <Input
                  id="edit-name"
                  value={editingEvent.name}
                  onChange={(e) => setEditingEvent({ ...editingEvent, name: e.target.value })}
                  placeholder="Введите название мероприятия"
                  required
                />
              </div>
              <div>
                <Label htmlFor="edit-location">Место проведения</Label>
                <Input
                  id="edit-location"
                  value={editingEvent.location}
                  onChange={(e) => setEditingEvent({ ...editingEvent, location: e.target.value })}
                  placeholder="Введите место проведения"
                  required
                />
              </div>
              <div>
                <Label htmlFor="edit-datetime">Дата и время</Label>
                <Input
                  id="edit-datetime"
                  type="datetime-local"
                  value={new Date(editingEvent.datetime).toISOString().slice(0, 16)}
                  onChange={(e) => setEditingEvent({ ...editingEvent, datetime: new Date(e.target.value) })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="edit-chat">Telegram-чат</Label>
                <select
                  id="edit-chat"
                  value={editingEvent.chatId}
                  onChange={(e) => setEditingEvent({ ...editingEvent, chatId: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  required
                >
                  {chats.map((chat: any) => (
                    <option key={chat.id} value={chat.id}>
                      {chat.title} (ID: {chat.chatId})
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="edit-active"
                  checked={editingEvent.isActive}
                  onChange={(e) => setEditingEvent({ ...editingEvent, isActive: e.target.checked })}
                />
                <Label htmlFor="edit-active">Мероприятие активно</Label>
              </div>
              <div className="flex justify-end space-x-2">
                <Button 
                  type="button" 
                  variant="outline"
                  onClick={() => setShowEditDialog(false)}
                >
                  Отмена
                </Button>
                <Button 
                  type="submit"
                  disabled={editEventMutation.isPending}
                >
                  {editEventMutation.isPending ? "Сохранение..." : "Сохранить"}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
