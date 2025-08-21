import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { ArrowLeft, FileText, Download, Bell, Share2 } from "lucide-react";
import type { UserWithEvent } from "@shared/schema";

// Format phone number for display: 7XXXXXXXXXX -> +7 (XXX) XXX-XX-XX
function formatPhoneNumber(phone: string): string {
  if (!phone) return phone;
  
  // If already formatted, return as is
  if (phone.includes('(') && phone.includes(')')) {
    return phone;
  }
  
  // Format: 7XXXXXXXXXX -> +7 (XXX) XXX-XX-XX
  const match = phone.match(/^7(\d{3})(\d{3})(\d{2})(\d{2})$/);
  if (match) {
    return `+7 (${match[1]}) ${match[2]}-${match[3]}-${match[4]}`;
  }
  
  return phone;
}

interface ParticipantsProps {
  eventId: number;
  onBack: () => void;
}

export default function Participants({ eventId, onBack }: ParticipantsProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: participants = [], isLoading: loadingParticipants } = useQuery({
    queryKey: ["/api/events", eventId, "participants"],
  });

  const { data: event } = useQuery({
    queryKey: ["/api/events", eventId],
  });

  const generatePdfMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest(`/api/events/${eventId}/pdf`);
      const blob = await response.blob();
      return blob;
    },
    onSuccess: (blob) => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `participants-${eventId}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast({
        title: "Успешно",
        description: "Общий PDF сгенерирован и загружен",
      });
    },
  });

  const generateTransportPdfMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest(`/api/events/${eventId}/pdf-transport`);
      const blob = await response.blob();
      return blob;
    },
    onSuccess: (blob) => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `participants-transport-${eventId}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast({
        title: "Успешно",
        description: "PDF по транспорту сгенерирован и загружен",
      });
    },
  });

  const notifyGroupMutation = useMutation({
    mutationFn: async () => {
      await apiRequest(`/api/events/${eventId}/notify-group`, {
        method: "POST"
      });
    },
    onSuccess: () => {
      toast({
        title: "Успешно",
        description: "Уведомление отправлено в группу",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось отправить уведомление",
        variant: "destructive",
      });
    },
  });

  const updateParticipantMutation = useMutation({
    mutationFn: async ({ participantId, field, value }: {
      participantId: number;
      field: string;
      value: any;
    }) => {
      await apiRequest(`/api/participants/${participantId}`, {
        method: "PUT",
        body: { [field]: value }
      });
    },
    onSuccess: () => {
      // Invalidate multiple related queries to ensure UI updates
      queryClient.invalidateQueries({ queryKey: ["/api/events", eventId, "participants"] });
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      toast({
        title: "Успешно",
        description: "Данные участника обновлены",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось обновить данные участника",
        variant: "destructive",
      });
    },
  });

  const generateShareLinkMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest(`/api/events/${eventId}/share`, {
        method: "POST"
      });
      return response.json();
    },
    onSuccess: (data) => {
      const shareUrl = `${window.location.origin}/public/${data.shareCode}`;
      window.open(shareUrl, '_blank');
      toast({
        title: "Публичная ссылка создана",
        description: "Страница открыта в новом окне",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось создать ссылку",
        variant: "destructive",
      });
    },
  });

  const handleCellEdit = (participantId: number, field: string, value: any) => {
    updateParticipantMutation.mutate({
      participantId,
      field,
      value
    });
  };



  const getTransportTypeLabel = (type: string) => {
    switch (type) {
      case 'monowheel': return 'Моноколесо';
      case 'scooter': return 'Самокат';
      case 'eboard': return 'Электро-борд';
      case 'spectator': return 'Зритель';
      default: return type;
    }
  };

  const getTransportIcon = (type: string) => {
    switch (type) {
      case 'monowheel': return '🛞';
      case 'scooter': return '🛴';
      case 'eboard': return '🏄';
      case 'spectator': return '👀';
      default: return '';
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

  if (loadingParticipants) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-32 bg-gray-200 rounded-xl" />
          <div className="h-96 bg-gray-200 rounded-xl" />
        </div>
      </div>
    );
  }

  const typedParticipants = participants as UserWithEvent[];
  const activeParticipants = typedParticipants.filter(p => p.isActive);
  const monowheelCount = activeParticipants.filter(p => p.transportType === 'monowheel').length;
  const scooterCount = activeParticipants.filter(p => p.transportType === 'scooter').length;
  const eboardCount = activeParticipants.filter(p => p.transportType === 'eboard').length;
  const spectatorCount = activeParticipants.filter(p => p.transportType === 'spectator').length;

  const columns = [
    {
      key: 'participantNumber' as keyof UserWithEvent,
      header: '№',
      sortable: true,
      render: (value: number, row: UserWithEvent) => (
        <span className={`participant-number participant-number-${row.transportType}`}>
          {value}
        </span>
      ),
    },
    {
      key: 'fullName' as keyof UserWithEvent,
      header: 'ФИО',
      sortable: true,
      render: (value: string) => (
        <div className="font-medium text-gray-900">{value}</div>
      ),
    },
    {
      key: 'telegramNickname' as keyof UserWithEvent,
      header: 'Telegram ник',
      sortable: true,
      render: (value: string) => value || '—',
    },
    {
      key: 'phone' as keyof UserWithEvent,
      header: 'Телефон',
      sortable: true,
      render: (value: string) => (
        <span className="font-mono text-sm">{formatPhoneNumber(value)}</span>
      ),
    },
    {
      key: 'transportType' as keyof UserWithEvent,
      header: 'Тип транспорта',
      sortable: true,
      render: (value: string) => (
        <Badge className={`transport-badge-${value}`}>
          {getTransportIcon(value)} {getTransportTypeLabel(value)}
        </Badge>
      ),
    },
    {
      key: 'transportModel' as keyof UserWithEvent,
      header: 'Модель',
      sortable: true,
      editable: true,
      render: (value: string | null) => (
        <span className="text-sm">
          {value || '—'}
        </span>
      ),
    },
    {
      key: 'isActive' as keyof UserWithEvent,
      header: 'Статус',
      render: (value: boolean) => (
        <Badge variant={value ? "default" : "destructive"}>
          {value ? "Активен" : "Отказался"}
        </Badge>
      ),
    },
  ];

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      {/* Mobile Title */}
      <div className="md:hidden">
        <h1 className="text-2xl font-bold text-gray-900">Участники</h1>
      </div>

      {/* Breadcrumb - Desktop only */}
      <div className="hidden md:flex items-center space-x-2 text-sm text-gray-600">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={onBack}
          className="gap-1 p-0 hover:bg-transparent text-gray-600 hover:text-gray-900 text-xs sm:text-sm"
        >
          <ArrowLeft className="h-4 w-4" />
          Назад к мероприятиям
        </Button>
        <span>•</span>
        <span>Участники</span>
      </div>

      {/* Mobile Back Button */}
      <div className="md:hidden">
        <Button 
          variant="outline" 
          size="sm"
          onClick={onBack}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Назад
        </Button>
      </div>

      {/* Header */}
      <Card>
        <CardHeader className="p-4 md:p-6">
          <div className="flex flex-col gap-4">
            <div>
              {event && (
                <div>
                  <CardTitle className="text-lg md:text-2xl mb-2">{(event as any)?.name || 'Мероприятие'}</CardTitle>
                  {(event as any)?.description && (
                    <div className="mb-3 p-3 bg-blue-50 border-l-4 border-blue-400 rounded-r-md">
                      <p className="text-sm text-gray-700 leading-relaxed">
                        📝 {(event as any).description}
                      </p>
                    </div>
                  )}
                  <div className="flex flex-col md:flex-row md:items-center md:space-x-4 space-y-1 md:space-y-0 text-xs md:text-sm text-gray-600">
                    <span className="flex items-center gap-1">
                      📍 {(event as any)?.location || 'Место не указано'}
                    </span>
                    <span className="flex items-center gap-1">
                      📅 {(event as any)?.datetime ? formatDateTime((event as any).datetime.toString()) : 'Время не указано'}
                    </span>
                  </div>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 md:flex md:flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-1 text-xs md:text-sm"
                onClick={() => notifyGroupMutation.mutate()}
                disabled={notifyGroupMutation.isPending}
              >
                <Bell className="h-4 w-4" />
                <span className="hidden md:inline">Оповестить группу</span>
                <span className="md:hidden">Группе</span>
              </Button>

              <Button 
                variant="outline" 
                size="sm"
                className="gap-1 text-xs md:text-sm"
                onClick={() => generatePdfMutation.mutate()}
                disabled={generatePdfMutation.isPending}
              >
                <FileText className="h-4 w-4" />
                <span className="hidden md:inline">{generatePdfMutation.isPending ? "Общий PDF..." : "Общий PDF"}</span>
                <span className="md:hidden">PDF</span>
              </Button>
              
              <Button 
                variant="outline" 
                size="sm"
                className="gap-1 text-xs md:text-sm"
                onClick={() => generateTransportPdfMutation.mutate()}
                disabled={generateTransportPdfMutation.isPending}
              >
                <FileText className="h-4 w-4" />
                <span className="hidden md:inline">{generateTransportPdfMutation.isPending ? "По транспорту PDF..." : "По транспорту PDF"}</span>
                <span className="md:hidden">Транспорт</span>
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                className="gap-1 text-xs md:text-sm"
                onClick={() => generateShareLinkMutation.mutate()}
                disabled={generateShareLinkMutation.isPending}
              >
                <Share2 className="h-4 w-4" />
                <span className="hidden md:inline">{generateShareLinkMutation.isPending ? "Создание..." : "Поделиться"}</span>
                <span className="md:hidden">Ссылка</span>
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Statistics */}
      <Card>
        <CardContent className="p-4 md:p-6 bg-gray-50">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4">
            <div className="text-center">
              <div className="text-lg md:text-2xl font-bold text-purple-600">{monowheelCount}</div>
              <div className="text-xs md:text-sm text-gray-600">Моноколёса</div>
            </div>
            <div className="text-center">
              <div className="text-lg md:text-2xl font-bold text-blue-600">{scooterCount}</div>
              <div className="text-xs md:text-sm text-gray-600">Самокаты</div>
            </div>
            <div className="text-center">
              <div className="text-lg md:text-2xl font-bold text-orange-600">{eboardCount}</div>
              <div className="text-xs md:text-sm text-gray-600">Электро-борд</div>
            </div>
            <div className="text-center">
              <div className="text-lg md:text-2xl font-bold text-green-600">{spectatorCount}</div>
              <div className="text-xs md:text-sm text-gray-600">Зрители</div>
            </div>
            <div className="text-center">
              <div className="text-lg md:text-2xl font-bold text-gray-800">{activeParticipants.length}</div>
              <div className="text-xs md:text-sm text-gray-600">Всего</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Participants Table */}
      <Card>
        <CardContent>
          <DataTable
            data={typedParticipants}
            columns={columns}
            searchPlaceholder="Поиск по ФИО, нику или телефону..."
            searchKey="fullName"
            onCellEdit={handleCellEdit}
            filters={[
              {
                key: 'transportType',
                label: 'Тип транспорта',
                options: [
                  { value: 'monowheel', label: 'Моноколесо' },
                  { value: 'scooter', label: 'Самокат' },
                  { value: 'spectator', label: 'Зритель' },
                ],
              },
              {
                key: 'isActive',
                label: 'Статус',
                options: [
                  { value: 'true', label: 'Активные' },
                  { value: 'false', label: 'Неактивные' },
                ],
              },
            ]}
          />
        </CardContent>
      </Card>
    </div>
  );
}
