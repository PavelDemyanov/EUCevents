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
import { ArrowLeft, Lock, FileText, Download, Bell } from "lucide-react";
import type { UserWithEvent, ReservedNumber } from "@shared/schema";

interface ParticipantsProps {
  eventId: number;
  onBack: () => void;
}

export default function Participants({ eventId, onBack }: ParticipantsProps) {
  const [reservedNumbersText, setReservedNumbersText] = useState("");
  const [showReserveDialog, setShowReserveDialog] = useState(false);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: participants = [], isLoading: loadingParticipants } = useQuery({
    queryKey: ["/api/events", eventId, "participants"],
  });

  const { data: event } = useQuery({
    queryKey: ["/api/events", eventId],
  });

  const { data: reservedNumbers = [] } = useQuery({
    queryKey: ["/api/events", eventId, "reserved-numbers"],
  });

  const updateParticipantMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: number; updates: any }) => {
      await apiRequest("PUT", `/api/participants/${id}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events", eventId, "participants"] });
      toast({
        title: "Успешно",
        description: "Участник обновлен",
      });
    },
  });

  const addReservedNumbersMutation = useMutation({
    mutationFn: async (numbers: number[]) => {
      await apiRequest("POST", `/api/events/${eventId}/reserved-numbers`, { numbers });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events", eventId, "reserved-numbers"] });
      setShowReserveDialog(false);
      setReservedNumbersText("");
      toast({
        title: "Успешно",
        description: "Номера зарезервированы",
      });
    },
  });

  const generatePdfMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("GET", `/api/events/${eventId}/pdf`);
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
        description: "PDF сгенерирован и загружен",
      });
    },
  });

  const notifyGroupMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/events/${eventId}/notify-group`);
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

  const handleReserveNumbers = () => {
    const numbersArray = reservedNumbersText
      .split(",")
      .map(n => parseInt(n.trim()))
      .filter(n => !isNaN(n) && n >= 1 && n <= 99);

    if (numbersArray.length === 0) {
      toast({
        title: "Ошибка",
        description: "Введите корректные номера от 1 до 99",
        variant: "destructive",
      });
      return;
    }

    addReservedNumbersMutation.mutate(numbersArray);
  };

  const getTransportTypeLabel = (type: string) => {
    switch (type) {
      case 'monowheel': return 'Моноколесо';
      case 'scooter': return 'Самокат';
      case 'spectator': return 'Зритель';
      default: return type;
    }
  };

  const getTransportIcon = (type: string) => {
    switch (type) {
      case 'monowheel': return '🛞';
      case 'scooter': return '🛴';
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
  const spectatorCount = activeParticipants.filter(p => p.transportType === 'spectator').length;

  const columns = [
    {
      key: 'participantNumber' as keyof UserWithEvent,
      header: '№ участника',
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
    <div className="p-6 space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Участники мероприятия</CardTitle>
              {event && (
                <p className="text-sm text-gray-600 mt-1">
                  {(event as any).name} • {(event as any).location} • {formatDateTime((event as any).datetime.toString())}
                </p>
              )}
            </div>
            <div className="flex items-center space-x-3">
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => notifyGroupMutation.mutate()}
                disabled={notifyGroupMutation.isPending}
              >
                <Bell className="h-4 w-4" />
                Оповестить группу о мероприятии
              </Button>
              <Dialog open={showReserveDialog} onOpenChange={setShowReserveDialog}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="gap-2">
                    <Lock className="h-4 w-4" />
                    Зарезервировать номера
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Зарезервировать номера</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>Номера для резервирования (от 1 до 99, через запятую)</Label>
                      <Textarea
                        placeholder="Например: 1, 5, 10, 15, 99"
                        value={reservedNumbersText}
                        onChange={(e) => setReservedNumbersText(e.target.value)}
                        className="mt-2"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Зарезервированные номера не будут автоматически назначаться участникам
                      </p>
                    </div>
                    
                    {reservedNumbers.length > 0 && (
                      <div>
                        <Label>Текущие зарезервированные номера:</Label>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {(reservedNumbers as ReservedNumber[]).map((rn) => (
                            <Badge key={rn.id} variant="outline">
                              {rn.number}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    <div className="flex justify-end space-x-2">
                      <Button variant="outline" onClick={() => setShowReserveDialog(false)}>
                        Отмена
                      </Button>
                      <Button 
                        onClick={handleReserveNumbers}
                        disabled={addReservedNumbersMutation.isPending}
                      >
                        Сохранить
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
              
              <Button 
                variant="outline" 
                className="gap-2"
                onClick={() => generatePdfMutation.mutate()}
                disabled={generatePdfMutation.isPending}
              >
                <FileText className="h-4 w-4" />
                {generatePdfMutation.isPending ? "Генерация..." : "Генерировать PDF"}
              </Button>
              
              <Button variant="outline" onClick={onBack} className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Назад к мероприятиям
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Statistics */}
      <Card>
        <CardContent className="p-6 bg-gray-50">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{monowheelCount}</div>
              <div className="text-sm text-gray-600">Моноколёса</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{scooterCount}</div>
              <div className="text-sm text-gray-600">Самокаты</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{spectatorCount}</div>
              <div className="text-sm text-gray-600">Зрители</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-800">{activeParticipants.length}</div>
              <div className="text-sm text-gray-600">Всего участников</div>
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
