import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Calendar, MapPin, Users, FileText } from "lucide-react";

interface PublicEventData {
  event: {
    id: number;
    name: string;
    description?: string;
    location: string;
    datetime: string;
  };
  participants: Array<{
    id: number;
    fullName: string;
    telegramNickname: string;
    transportType: string;
    transportModel?: string;
    participantNumber: number;
    isActive: boolean;
  }>;
}

export default function PublicEvent() {
  const [match, params] = useRoute("/public/:shareCode");
  const shareCode = params?.shareCode;
  const { toast } = useToast();

  const { data: eventData, isLoading } = useQuery<PublicEventData>({
    queryKey: ["/api/public/events", shareCode],
    enabled: !!shareCode
  });

  const generatePdfMutation = useMutation({
    mutationFn: async () => {
      if (!eventData?.event?.id) throw new Error('Event not found');
      const response = await fetch(`/api/public/events/${eventData.event.id}/pdf`);
      if (!response.ok) throw new Error('Failed to generate PDF');
      return await response.blob();
    },
    onSuccess: (blob) => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `participants-${eventData?.event?.id || 'event'}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast({
        title: "PDF создан",
        description: "Общий список участников загружен",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: "Не удалось создать PDF",
        variant: "destructive",
      });
    },
  });

  const generateTransportPdfMutation = useMutation({
    mutationFn: async () => {
      if (!eventData?.event?.id) throw new Error('Event not found');
      const response = await fetch(`/api/public/events/${eventData.event.id}/pdf-transport`);
      if (!response.ok) throw new Error('Failed to generate transport PDF');
      return await response.blob();
    },
    onSuccess: (blob) => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `participants-transport-${eventData?.event?.id || 'event'}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast({
        title: "PDF создан",
        description: "Список по транспорту загружен",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: "Не удалось создать PDF по транспорту",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!eventData) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
            Мероприятие не найдено
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            Проверьте правильность ссылки
          </p>
        </div>
      </div>
    );
  }

  const { event, participants } = eventData;
  const activeParticipants = participants.filter((p) => p.isActive);

  // Group participants by transport type
  const groupedParticipants = {
    monowheel: activeParticipants.filter((p) => p.transportType === 'monowheel'),
    scooter: activeParticipants.filter((p) => p.transportType === 'scooter'),
    spectator: activeParticipants.filter((p) => p.transportType === 'spectator')
  };

  const getTransportTypeLabel = (type: string) => {
    switch (type) {
      case 'monowheel': return 'Моноколесо';
      case 'scooter': return 'Самокат';
      case 'spectator': return 'Зритель';
      default: return type;
    }
  };

  const getTransportBadgeColor = (type: string) => {
    switch (type) {
      case 'monowheel': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'scooter': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'spectator': return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Event Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            {event.name}
          </h1>
          
          {event.description && (
            <div className="max-w-3xl mx-auto mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-400 rounded-r-lg">
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                📝 {event.description}
              </p>
            </div>
          )}
          
          <div className="flex flex-wrap justify-center gap-6 text-gray-600 dark:text-gray-300 mb-6">
            <div className="flex items-center gap-2">
              <MapPin className="w-5 h-5" />
              <span>{event.location}</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              <span>{new Date(event.datetime).toLocaleDateString('ru-RU', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}</span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              <span>{activeParticipants.length} участников</span>
            </div>
          </div>

          {/* PDF Download Buttons */}
          <div className="flex flex-wrap justify-center gap-3">
            <Button
              variant="outline"
              onClick={() => generatePdfMutation.mutate()}
              disabled={generatePdfMutation.isPending || !eventData?.event?.id}
              className="gap-2"
            >
              <FileText className="w-4 h-4" />
              {generatePdfMutation.isPending ? "Создание..." : "Общий PDF"}
            </Button>
            
            <Button
              variant="outline"
              onClick={() => generateTransportPdfMutation.mutate()}
              disabled={generateTransportPdfMutation.isPending || !eventData?.event?.id}
              className="gap-2"
            >
              <FileText className="w-4 h-4" />
              {generateTransportPdfMutation.isPending ? "Создание..." : "По транспорту PDF"}
            </Button>
          </div>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="text-2xl font-bold text-blue-600">
                {activeParticipants.length}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-300">
                Всего участников
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="text-2xl font-bold text-blue-600">
                {groupedParticipants.monowheel.length}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-300">
                Моноколеса
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="text-2xl font-bold text-green-600">
                {groupedParticipants.scooter.length}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-300">
                Самокаты
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="text-2xl font-bold text-gray-600">
                {groupedParticipants.spectator.length}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-300">
                Зрители
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Participants List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Список участников
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {(Object.entries(groupedParticipants) as [string, typeof participants][]).map(([type, participants]) => {
                if (participants.length === 0) return null;
                
                return (
                  <div key={type}>
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <Badge className={getTransportBadgeColor(type)}>
                        {getTransportTypeLabel(type)} ({participants.length})
                      </Badge>
                    </h3>
                    
                    <div className="grid gap-3">
                      {participants.map((participant) => (
                        <div 
                          key={participant.id}
                          className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg"
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">
                              {participant.participantNumber}
                            </div>
                            <div>
                              <div className="font-medium text-gray-900 dark:text-white">
                                {participant.fullName}
                              </div>
                              <div className="text-sm text-gray-600 dark:text-gray-300">
                                @{participant.telegramNickname}
                              </div>
                            </div>
                          </div>
                          
                          <div className="text-right">
                            <Badge className={getTransportBadgeColor(participant.transportType)}>
                              {getTransportTypeLabel(participant.transportType)}
                            </Badge>
                            {participant.transportModel && (
                              <div className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                                {participant.transportModel}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}