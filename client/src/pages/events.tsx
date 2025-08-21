import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Calendar, MapPin, Users, Plus, Eye, Edit, Trash2 } from "lucide-react";
import type { EventWithStats, Event } from "@shared/schema";

interface EventsProps {
  onViewParticipants?: (eventId: number, eventName?: string) => void;
}

// Editing type with chatIds for easier form handling
type EditingEvent = Event & {
  chatIds?: number[];
};

export default function Events({ onViewParticipants }: EventsProps = {}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EditingEvent | null>(null);
  const [newEvent, setNewEvent] = useState({
    name: "",
    description: "",
    location: "",
    datetime: "",
    chatIds: [] as number[]
  });
  const [isCustomLocation, setIsCustomLocation] = useState(false);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: events = [], isLoading } = useQuery({
    queryKey: ["/api/events"],
  });

  const { data: chats = [] } = useQuery({
    queryKey: ["/api/chats"],
  });

  const { data: bots = [] } = useQuery({
    queryKey: ["/api/bots"],
  });

  const { data: todayStats } = useQuery({
    queryKey: ["/api/stats/today"],
  });

  const { data: locations = [] } = useQuery({
    queryKey: ["/api/events/locations"],
  });

  const createEventMutation = useMutation({
    mutationFn: async (eventData: typeof newEvent) => {
      await apiRequest("/api/events", {
        method: "POST",
        body: eventData
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      setShowCreateDialog(false);
      setNewEvent({ name: "", description: "", location: "", datetime: "", chatIds: [] });
      setIsCustomLocation(false);
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
      await apiRequest(`/api/events/${eventId}`, {
        method: "PUT",
        body: eventData
      });
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
      await apiRequest(`/api/events/${eventId}`, {
        method: "DELETE"
      });
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
    if (newEvent.chatIds.length === 0) {
      toast({
        title: "Ошибка",
        description: "Выберите хотя бы один чат",
        variant: "destructive",
      });
      return;
    }
    createEventMutation.mutate(newEvent);
  };

  const handleEditEvent = (event: EventWithStats) => {
    setEditingEvent({
      ...event,
      chatIds: event.chats?.map(chat => chat.id) || []
    });
    setShowEditDialog(true);
  };

  const handleUpdateEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEvent) return;
    
    editEventMutation.mutate({
      eventId: editingEvent.id,
      eventData: {
        name: editingEvent.name,
        description: editingEvent.description,
        location: editingEvent.location,
        datetime: editingEvent.datetime,
        chatIds: editingEvent.chatIds || [],
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
  const totalBots = (bots as any[]).length;
  const todayRegistrations = (todayStats as any)?.todayRegistrations || 0;

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      {/* Mobile Title */}
      <div className="md:hidden">
        <h1 className="text-2xl font-bold text-gray-900">Мероприятия</h1>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
        <Card>
          <CardContent className="p-3 md:p-6">
            <div className="flex items-center">
              <div className="stats-card-blue p-2 md:p-3 rounded-lg">
                <Calendar className="h-4 w-4 md:h-6 md:w-6" />
              </div>
              <div className="ml-2 md:ml-4">
                <p className="text-xs md:text-sm text-gray-600">Мероприятий</p>
                <p className="text-lg md:text-2xl font-bold text-gray-900">{totalEvents}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-3 md:p-6">
            <div className="flex items-center">
              <div className="stats-card-green p-2 md:p-3 rounded-lg">
                <Users className="h-4 w-4 md:h-6 md:w-6" />
              </div>
              <div className="ml-2 md:ml-4">
                <p className="text-xs md:text-sm text-gray-600">Участников</p>
                <p className="text-lg md:text-2xl font-bold text-gray-900">{totalParticipants}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-3 md:p-6">
            <div className="flex items-center">
              <div className="stats-card-purple p-2 md:p-3 rounded-lg">
                <i className="fab fa-telegram-plane text-sm md:text-xl" />
              </div>
              <div className="ml-2 md:ml-4">
                <p className="text-xs md:text-sm text-gray-600">Подключенных ботов</p>
                <p className="text-lg md:text-2xl font-bold text-gray-900">{totalBots}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-3 md:p-6">
            <div className="flex items-center">
              <div className="stats-card-orange p-2 md:p-3 rounded-lg">
                <i className="fas fa-chart-line text-sm md:text-xl" />
              </div>
              <div className="ml-2 md:ml-4">
                <p className="text-xs md:text-sm text-gray-600">Регистраций сегодня</p>
                <p className="text-lg md:text-2xl font-bold text-gray-900">{todayRegistrations}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Events Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <CardTitle className="text-lg md:text-xl">Список мероприятий</CardTitle>
            <Button 
              className="gap-2 w-full md:w-auto"
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
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">{event.name}</div>
                      {event.description && (
                        <div className="text-sm text-gray-600 mt-1 max-w-48 truncate" title={event.description}>
                          {event.description.length > 225 ? `${event.description.substring(0, 225)}...` : event.description}
                        </div>
                      )}
                      <div className="text-xs text-gray-500 mt-1">ID: #{event.id}</div>
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
                      <div className="text-sm font-medium text-gray-900">{event.participantCount} участников</div>
                      <div className="text-xs text-gray-500 space-y-0.5">
                        <div>🛞 {event.monowheelCount} моноколес</div>
                        <div>🛴 {event.scooterCount} самокатов</div>
                        <div>👀 {event.spectatorCount} зрителей</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge variant={event.isActive ? "default" : "secondary"}>
                        {event.isActive ? "Активное" : "Завершено"}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center space-x-1">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="w-8 h-8 p-0"
                          onClick={() => onViewParticipants?.(event.id, event.name)}
                          title="Участники"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="w-8 h-8 p-0"
                          onClick={() => handleEditEvent(event)}
                          title="Редактировать"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="w-8 h-8 p-0 text-red-600 hover:text-red-900"
                          onClick={() => handleDeleteEvent(event.id)}
                          disabled={deleteEventMutation.isPending}
                          title="Удалить"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
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
              <Label htmlFor="description">Описание мероприятия</Label>
              <Textarea
                id="description"
                value={newEvent.description}
                onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                placeholder="Введите описание мероприятия (не более 900 символов)"
                maxLength={900}
                rows={3}
                className="resize-none"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>Необязательное поле</span>
                <span>{newEvent.description.length}/900</span>
              </div>
            </div>
            <div>
              <Label htmlFor="location">Место проведения</Label>
              <div className="space-y-2">
                {(locations as string[]).length > 0 && (
                  <Select 
                    value={isCustomLocation ? "" : newEvent.location} 
                    onValueChange={(value) => {
                      if (value === "custom") {
                        setIsCustomLocation(true);
                        setNewEvent({ ...newEvent, location: "" });
                      } else {
                        setIsCustomLocation(false);
                        setNewEvent({ ...newEvent, location: value });
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Выберите место или введите новое" />
                    </SelectTrigger>
                    <SelectContent>
                      {(locations as string[]).map((location: string) => (
                        <SelectItem key={location} value={location}>
                          {location}
                        </SelectItem>
                      ))}
                      <SelectItem value="custom">Ввести новое место...</SelectItem>
                    </SelectContent>
                  </Select>
                )}
                {(isCustomLocation || (locations as string[]).length === 0) && (
                  <Input
                    id="location"
                    value={newEvent.location}
                    onChange={(e) => setNewEvent({ ...newEvent, location: e.target.value })}
                    placeholder="Введите место проведения"
                    required
                  />
                )}
              </div>
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
              <Label>Telegram-чаты</Label>
              <div className="space-y-2 border rounded-md p-3 max-h-32 overflow-y-auto">
                {(chats as any[]).length === 0 ? (
                  <p className="text-gray-500 text-sm">Нет доступных чатов</p>
                ) : (
                  (chats as any[]).map((chat: any) => (
                    <div key={chat.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`chat-${chat.id}`}
                        checked={newEvent.chatIds.includes(chat.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setNewEvent({ ...newEvent, chatIds: [...newEvent.chatIds, chat.id] });
                          } else {
                            setNewEvent({ ...newEvent, chatIds: newEvent.chatIds.filter(id => id !== chat.id) });
                          }
                        }}
                      />
                      <label htmlFor={`chat-${chat.id}`} className="text-sm cursor-pointer">
                        {chat.title} (ID: {chat.chatId})
                      </label>
                    </div>
                  ))
                )}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Выберите чаты для уведомлений. Настройте чаты в разделе "Настройки"
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
                <Label htmlFor="edit-description">Описание мероприятия</Label>
                <Textarea
                  id="edit-description"
                  value={editingEvent.description || ""}
                  onChange={(e) => setEditingEvent({ ...editingEvent, description: e.target.value })}
                  placeholder="Введите описание мероприятия (не более 900 символов)"
                  maxLength={900}
                  rows={3}
                  className="resize-none"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>Необязательное поле</span>
                  <span>{(editingEvent.description || "").length}/900</span>
                </div>
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
                  value={editingEvent.datetime instanceof Date 
                    ? editingEvent.datetime.toISOString().slice(0, 16)
                    : typeof editingEvent.datetime === 'string' 
                      ? new Date(editingEvent.datetime).toISOString().slice(0, 16)
                      : ''
                  }
                  onChange={(e) => setEditingEvent({ ...editingEvent, datetime: new Date(e.target.value) })}
                  required
                />
              </div>
              <div>
                <Label>Telegram-чаты</Label>
                <div className="space-y-2 border rounded-md p-3 max-h-32 overflow-y-auto">
                  {(chats as any[]).length === 0 ? (
                    <p className="text-gray-500 text-sm">Нет доступных чатов</p>
                  ) : (
                    (chats as any[]).map((chat: any) => (
                      <div key={chat.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`edit-chat-${chat.id}`}
                          checked={editingEvent.chatIds?.includes(chat.id) || false}
                          onCheckedChange={(checked) => {
                            const currentChatIds = editingEvent.chatIds || [];
                            if (checked) {
                              setEditingEvent({ ...editingEvent, chatIds: [...currentChatIds, chat.id] });
                            } else {
                              setEditingEvent({ ...editingEvent, chatIds: currentChatIds.filter(id => id !== chat.id) });
                            }
                          }}
                        />
                        <label htmlFor={`edit-chat-${chat.id}`} className="text-sm cursor-pointer">
                          {chat.title} (ID: {chat.chatId})
                        </label>
                      </div>
                    ))
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Выберите чаты для уведомлений. Настройте чаты в разделе "Настройки"
                </p>
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
