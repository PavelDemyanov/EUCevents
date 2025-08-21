import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable } from "@/components/ui/data-table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Search, Edit, Trash2, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface UserWithEvent {
  id: number;
  telegramId: string;
  telegramNickname: string | null;
  fullName: string;
  phone: string;
  transportType: string;
  transportModel: string | null;
  participantNumber: number | null;
  isActive: boolean;
  eventId: number;
  createdAt: string;
  event: {
    id: number;
    name: string;
    location: string;
    datetime: string;
  } | null;
}

interface AllParticipantsProps {
  onBack: () => void;
}

export default function AllParticipants({ onBack }: AllParticipantsProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [transportFilter, setTransportFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch all participants
  const { data: participants = [], isLoading } = useQuery<UserWithEvent[]>({
    queryKey: ["/api/users/all"],
  });

  const formatDateTime = (dateString: string) => {
    return new Intl.DateTimeFormat('ru-RU', {
      day: '2-digit',
      month: '2-digit',  
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(dateString));
  };

  const formatPhone = (phone: string) => {
    if (!phone) return phone;
    
    // Remove the leading 7 and add +7 with formatting
    const cleaned = phone.replace(/^\+?7/, '');
    if (cleaned.length === 10) {
      return `+7 (${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6, 8)}-${cleaned.slice(8, 10)}`;
    }
    return phone;
  };

  const getTransportTypeLabel = (type: string) => {
    switch (type) {
      case 'monowheel': return '🛞 Моноколесо';
      case 'scooter': return '🛴 Самокат';
      case 'eboard': return '🛹 Электро-борд';
      case 'spectator': return '👀 Зритель';
      default: return type;
    }
  };

  // Filter participants
  const filteredParticipants = participants.filter((participant: UserWithEvent) => {
    const matchesSearch = searchQuery === "" || 
      participant.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      participant.phone.includes(searchQuery) ||
      (participant.telegramNickname && participant.telegramNickname.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (participant.event && participant.event.name.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesTransport = transportFilter === "all" || participant.transportType === transportFilter;
    const matchesStatus = statusFilter === "all" || 
      (statusFilter === "active" && participant.isActive) ||
      (statusFilter === "inactive" && !participant.isActive);
    
    return matchesSearch && matchesTransport && matchesStatus;
  });

  // Delete participant mutation
  const deleteParticipantMutation = useMutation({
    mutationFn: async (participantId: number) => {
      await apiRequest(`/api/users/${participantId}`, {
        method: 'DELETE'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users/all"] });
      toast({
        title: "Участник удален",
        description: "Участник успешно удален из системы",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось удалить участника",
        variant: "destructive",
      });
    }
  });

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-64"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Назад
          </Button>
          <div className="flex items-center gap-2">
            <Users className="h-6 w-6 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900">Все участники</h1>
          </div>
        </div>
        <div className="text-sm text-gray-500">
          Всего участников: {participants.length} | Найдено: {filteredParticipants.length}
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Поиск по имени, телефону, Telegram нику или мероприятию..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={transportFilter} onValueChange={setTransportFilter}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="Тип транспорта" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все типы</SelectItem>
                <SelectItem value="monowheel">Моноколесо</SelectItem>
                <SelectItem value="scooter">Самокат</SelectItem>
                <SelectItem value="eboard">Электро-борд</SelectItem>
                <SelectItem value="spectator">Зритель</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-32">
                <SelectValue placeholder="Статус" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все</SelectItem>
                <SelectItem value="active">Активные</SelectItem>
                <SelectItem value="inactive">Неактивные</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Participants Table */}
      <Card>
        <CardContent>
          <DataTable
            data={filteredParticipants}
            columns={[
              {
                key: 'fullName' as keyof UserWithEvent,
                header: 'Участник',
                sortable: true,
                render: (value: string, row: UserWithEvent) => (
                  <div>
                    <div className="font-medium text-gray-900">{value}</div>
                    <div className="text-sm text-gray-500">
                      Регистрация: {formatDateTime(row.createdAt)}
                    </div>
                  </div>
                ),
              },
              {
                key: 'phone' as keyof UserWithEvent,
                header: 'Контакты',
                sortable: true,
                render: (value: string, row: UserWithEvent) => (
                  <div className="text-sm">
                    <div className="text-gray-900">{formatPhone(value)}</div>
                    <div className="text-gray-500">
                      TG: {row.telegramNickname || "—"}
                    </div>
                  </div>
                ),
              },
              {
                key: 'transportType' as keyof UserWithEvent,
                header: 'Транспорт',
                sortable: true,
                render: (value: string, row: UserWithEvent) => (
                  <div className="text-sm">
                    <div>{getTransportTypeLabel(value)}</div>
                    {row.transportModel && (
                      <div className="text-gray-500">{row.transportModel}</div>
                    )}
                  </div>
                ),
              },
              {
                key: 'eventId' as keyof UserWithEvent,
                header: 'Мероприятие',
                sortable: true,
                render: (value: number, row: UserWithEvent) => (
                  <div className="text-sm">
                    <div className="font-medium text-gray-900">
                      {row.event ? row.event.name : "—"}
                    </div>
                    {row.event ? (
                      <div className="text-gray-500">
                        {formatDateTime(row.event.datetime)}
                      </div>
                    ) : (
                      <div className="text-red-500 text-xs">
                        Мероприятие удалено (ID: {value})
                      </div>
                    )}
                  </div>
                ),
              },
              {
                key: 'participantNumber' as keyof UserWithEvent,
                header: '№',
                sortable: true,
                render: (value: number | null) => (
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    value 
                      ? 'bg-blue-100 text-blue-800' 
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {value || "—"}
                  </span>
                ),
              },
              {
                key: 'isActive' as keyof UserWithEvent,
                header: 'Статус',
                sortable: true,
                render: (value: boolean) => (
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    value 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {value ? 'Активен' : 'Неактивен'}
                  </span>
                ),
              },
              {
                key: 'id' as keyof UserWithEvent,
                header: 'Действия',
                render: (value: number) => (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="gap-1 text-red-600 hover:text-red-900"
                    onClick={() => deleteParticipantMutation.mutate(value)}
                    disabled={deleteParticipantMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                    <span className="hidden md:inline">Удалить</span>
                  </Button>
                ),
              },
            ]}
            searchPlaceholder="Поиск по ФИО, телефону, нику..."
            searchKey="fullName"
            pageSize={50}
          />
        </CardContent>
      </Card>
    </div>
  );
}