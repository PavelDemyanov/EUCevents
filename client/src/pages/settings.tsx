import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Plus, Edit, Trash2, Bot as BotIcon, MessageCircle } from "lucide-react";
import type { Bot, Chat } from "@shared/schema";

export default function Settings() {
  const [showBotDialog, setShowBotDialog] = useState(false);
  const [showChatDialog, setShowChatDialog] = useState(false);
  const [editingBot, setEditingBot] = useState<Bot | null>(null);
  const [editingChat, setEditingChat] = useState<Chat | null>(null);
  const [newBot, setNewBot] = useState({
    token: "",
    name: "",
    description: ""
  });
  const [newChat, setNewChat] = useState({
    chatId: "",
    title: "",
    botId: 1
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Загрузка данных
  const { data: bots = [], isLoading: botsLoading } = useQuery({
    queryKey: ["/api/bots"],
  });

  const { data: chats = [], isLoading: chatsLoading } = useQuery({
    queryKey: ["/api/chats"],
  });

  // Мутации для ботов
  const createBotMutation = useMutation({
    mutationFn: async (botData: typeof newBot) => {
      await apiRequest("POST", "/api/bots", botData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bots"] });
      setShowBotDialog(false);
      setNewBot({ token: "", name: "", description: "" });
      toast({
        title: "Успешно",
        description: "Telegram-бот добавлен",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось добавить бота",
        variant: "destructive",
      });
    },
  });

  const deleteBotMutation = useMutation({
    mutationFn: async (botId: number) => {
      await apiRequest("DELETE", `/api/bots/${botId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bots"] });
      toast({
        title: "Успешно",
        description: "Telegram-бот удален",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось удалить бота",
        variant: "destructive",
      });
    },
  });

  const toggleBotMutation = useMutation({
    mutationFn: async ({ botId, action }: { botId: number, action: 'start' | 'stop' }) => {
      await apiRequest("POST", `/api/bots/${botId}/${action}`);
    },
    onSuccess: (_, { action }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/bots"] });
      toast({
        title: "Успешно",
        description: action === 'start' ? "Бот запущен" : "Бот остановлен",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось изменить статус бота",
        variant: "destructive",
      });
    },
  });

  // Мутации для чатов
  const createChatMutation = useMutation({
    mutationFn: async (chatData: typeof newChat) => {
      await apiRequest("POST", "/api/chats", {
        ...chatData,
        chatId: parseInt(chatData.chatId)
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chats"] });
      setShowChatDialog(false);
      setNewChat({ chatId: "", title: "", botId: 1 });
      toast({
        title: "Успешно",
        description: "Чат добавлен",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось добавить чат",
        variant: "destructive",
      });
    },
  });

  const deleteChatMutation = useMutation({
    mutationFn: async (chatId: number) => {
      await apiRequest("DELETE", `/api/chats/${chatId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chats"] });
      toast({
        title: "Успешно",
        description: "Чат удален",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось удалить чат",
        variant: "destructive",
      });
    },
  });

  const handleCreateBot = (e: React.FormEvent) => {
    e.preventDefault();
    createBotMutation.mutate(newBot);
  };

  const handleCreateChat = (e: React.FormEvent) => {
    e.preventDefault();
    createChatMutation.mutate(newChat);
  };

  const handleDeleteBot = (botId: number) => {
    if (confirm("Вы уверены, что хотите удалить этого бота?")) {
      deleteBotMutation.mutate(botId);
    }
  };

  const handleToggleBot = (botId: number, isActive: boolean) => {
    const action = isActive ? 'stop' : 'start';
    toggleBotMutation.mutate({ botId, action });
  };

  const handleDeleteChat = (chatId: number) => {
    if (confirm("Вы уверены, что хотите удалить этот чат?")) {
      deleteChatMutation.mutate(chatId);
    }
  };

  if (botsLoading || chatsLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Настройки системы</h1>
        <p className="text-gray-600 mt-2">Управление Telegram-ботами и чатами для регистрации участников</p>
      </div>

      {/* Telegram Bots Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <BotIcon className="h-5 w-5" />
              <CardTitle>Telegram-боты</CardTitle>
            </div>
            <Button 
              className="gap-2"
              onClick={() => setShowBotDialog(true)}
            >
              <Plus className="h-4 w-4" />
              Добавить бота
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {bots.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <BotIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <p>Telegram-боты не настроены</p>
              <p className="text-sm">Добавьте бота для начала работы с регистрацией участников</p>
            </div>
          ) : (
            <div className="space-y-4">
              {(bots as Bot[]).map((bot: Bot) => (
                <div key={bot.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="bg-blue-100 p-2 rounded-lg">
                      <BotIcon className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-medium">{bot.name}</h3>
                      <p className="text-sm text-gray-600">{bot.description}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        Токен: {bot.token.substring(0, 10)}...
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge variant={bot.isActive ? "default" : "secondary"}>
                      {bot.isActive ? "Активен" : "Отключен"}
                    </Badge>
                    <Button
                      variant={bot.isActive ? "destructive" : "default"}
                      size="sm"
                      onClick={() => handleToggleBot(bot.id, bot.isActive)}
                      disabled={toggleBotMutation.isPending}
                    >
                      {bot.isActive ? "Остановить" : "Запустить"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteBot(bot.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Telegram Chats Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <MessageCircle className="h-5 w-5" />
              <CardTitle>Telegram-чаты</CardTitle>
            </div>
            <Button 
              className="gap-2"
              onClick={() => setShowChatDialog(true)}
              disabled={(bots as Bot[]).length === 0}
            >
              <Plus className="h-4 w-4" />
              Добавить чат
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {chats.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <MessageCircle className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <p>Чаты не настроены</p>
              <p className="text-sm">Добавьте чаты для привязки к мероприятиям</p>
            </div>
          ) : (
            <div className="space-y-4">
              {(chats as Chat[]).map((chat: Chat) => (
                <div key={chat.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="bg-green-100 p-2 rounded-lg">
                      <MessageCircle className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <h3 className="font-medium">{chat.title}</h3>
                      <p className="text-sm text-gray-600">Chat ID: {chat.chatId}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        Бот: {(bots as Bot[]).find((bot: Bot) => bot.id === chat.botId)?.name || 'Неизвестен'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge variant={chat.isActive ? "default" : "secondary"}>
                      {chat.isActive ? "Активен" : "Отключен"}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteChat(chat.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Bot Dialog */}
      <Dialog open={showBotDialog} onOpenChange={setShowBotDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Добавить Telegram-бота</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateBot} className="space-y-4">
            <div>
              <Label htmlFor="bot-token">Токен бота</Label>
              <Input
                id="bot-token"
                value={newBot.token}
                onChange={(e) => setNewBot({ ...newBot, token: e.target.value })}
                placeholder="123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                Получите токен у @BotFather в Telegram
              </p>
            </div>
            <div>
              <Label htmlFor="bot-name">Название бота</Label>
              <Input
                id="bot-name"
                value={newBot.name}
                onChange={(e) => setNewBot({ ...newBot, name: e.target.value })}
                placeholder="Мой Event Bot"
                required
              />
            </div>
            <div>
              <Label htmlFor="bot-description">Описание</Label>
              <Input
                id="bot-description"
                value={newBot.description}
                onChange={(e) => setNewBot({ ...newBot, description: e.target.value })}
                placeholder="Бот для регистрации на мероприятия"
              />
            </div>
            <div className="flex justify-end space-x-2">
              <Button 
                type="button" 
                variant="outline"
                onClick={() => setShowBotDialog(false)}
              >
                Отмена
              </Button>
              <Button 
                type="submit"
                disabled={createBotMutation.isPending}
              >
                {createBotMutation.isPending ? "Добавление..." : "Добавить"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Chat Dialog */}
      <Dialog open={showChatDialog} onOpenChange={setShowChatDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Добавить чат</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateChat} className="space-y-4">
            <div>
              <Label htmlFor="chat-id">ID чата</Label>
              <Input
                id="chat-id"
                value={newChat.chatId}
                onChange={(e) => setNewChat({ ...newChat, chatId: e.target.value })}
                placeholder="-1001234567890"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                ID группы или канала (начинается с -)
              </p>
            </div>
            <div>
              <Label htmlFor="chat-title">Название чата</Label>
              <Input
                id="chat-title"
                value={newChat.title}
                onChange={(e) => setNewChat({ ...newChat, title: e.target.value })}
                placeholder="Группа мероприятий"
                required
              />
            </div>
            <div>
              <Label htmlFor="chat-bot">Бот</Label>
              <select
                id="chat-bot"
                value={newChat.botId}
                onChange={(e) => setNewChat({ ...newChat, botId: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                required
              >
                {(bots as Bot[]).map((bot: Bot) => (
                  <option key={bot.id} value={bot.id}>
                    {bot.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end space-x-2">
              <Button 
                type="button" 
                variant="outline"
                onClick={() => setShowChatDialog(false)}
              >
                Отмена
              </Button>
              <Button 
                type="submit"
                disabled={createChatMutation.isPending}
              >
                {createChatMutation.isPending ? "Добавление..." : "Добавить"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}