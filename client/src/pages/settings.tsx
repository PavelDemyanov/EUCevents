import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Plus, Edit, Trash2, Bot as BotIcon, MessageCircle, Hash, Users, UserPlus } from "lucide-react";
import type { Bot, Chat, FixedNumberBinding, InsertFixedNumberBinding, AdminUser, InsertAdminUserWithValidation } from "@shared/schema";
import { insertAdminUserSchema } from "@shared/schema";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { 
  Form, 
  FormControl, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage 
} from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";

export default function Settings() {
  const [showBotDialog, setShowBotDialog] = useState(false);
  const [showChatDialog, setShowChatDialog] = useState(false);
  const [showBindingDialog, setShowBindingDialog] = useState(false);
  const [showAdminDialog, setShowAdminDialog] = useState(false);
  const [editingBot, setEditingBot] = useState<Bot | null>(null);
  const [editingChat, setEditingChat] = useState<Chat | null>(null);
  const [editingAdmin, setEditingAdmin] = useState<AdminUser | null>(null);
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
  const [newBinding, setNewBinding] = useState({
    telegramNickname: "",
    participantNumber: 1
  });
  const [useCustomNickname, setUseCustomNickname] = useState(false);
  const [numberConflicts, setNumberConflicts] = useState<Array<{eventName: string, userName: string, telegramNickname: string}>>([]);
  const [checkingConflicts, setCheckingConflicts] = useState(false);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Загрузка данных
  const { data: bots = [], isLoading: botsLoading } = useQuery({
    queryKey: ["/api/bots"],
  });

  const { data: chats = [], isLoading: chatsLoading } = useQuery({
    queryKey: ["/api/chats"],
  });

  const { data: fixedBindings = [], isLoading: bindingsLoading } = useQuery({
    queryKey: ["/api/fixed-bindings"],
  });

  const { data: telegramNicknames = [], isLoading: nicknamesLoading } = useQuery({
    queryKey: ["/api/telegram-nicknames"],
  });

  const { data: admins = [], isLoading: adminsLoading } = useQuery({
    queryKey: ["/api/admins"],
  });

  // Мутации для ботов
  const createBotMutation = useMutation({
    mutationFn: async (botData: typeof newBot) => {
      await apiRequest("/api/bots", {
        method: "POST",
        body: botData
      });
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
      await apiRequest(`/api/bots/${botId}`, {
        method: "DELETE"
      });
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
      await apiRequest(`/api/bots/${botId}/${action}`, {
        method: "POST"
      });
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
      await apiRequest("/api/chats", {
        method: "POST",
        body: {
          ...chatData,
          chatId: parseInt(chatData.chatId)
        }
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
      await apiRequest(`/api/chats/${chatId}`, {
        method: "DELETE"
      });
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

  // Мутации для привязки номеров
  const createBindingMutation = useMutation({
    mutationFn: async (bindingData: InsertFixedNumberBinding) => {
      return await apiRequest("/api/fixed-bindings", {
        method: "POST",
        body: bindingData
      });
    },
    onSuccess: (response: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/fixed-bindings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/events"] }); // Refresh participants counts
      resetBindingForm();
      toast({
        title: "Успешно",
        description: response.message || "Привязка номера создана",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось создать привязку номера",
        variant: "destructive",
      });
    },
  });

  const deleteBindingMutation = useMutation({
    mutationFn: async (bindingId: number) => {
      await apiRequest(`/api/fixed-bindings/${bindingId}`, {
        method: "DELETE"
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fixed-bindings"] });
      toast({
        title: "Успешно",
        description: "Привязка номера удалена",
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

  const handleCreateBinding = (e: React.FormEvent) => {
    e.preventDefault();
    createBindingMutation.mutate(newBinding);
  };

  // Check for conflicts when number changes
  const checkNumberConflicts = async (participantNumber: number) => {
    if (participantNumber < 1 || participantNumber > 999) {
      setNumberConflicts([]);
      return;
    }
    
    try {
      setCheckingConflicts(true);
      const response = await apiRequest(`/api/fixed-bindings/check-conflicts/${participantNumber}`);
      setNumberConflicts(response.conflicts || []);
    } catch (error) {
      console.error("Ошибка проверки конфликтов:", error);
      setNumberConflicts([]);
    } finally {
      setCheckingConflicts(false);
    }
  };

  // Reset form
  const resetBindingForm = () => {
    setNewBinding({ telegramNickname: "", participantNumber: 1 });
    setUseCustomNickname(false);
    setNumberConflicts([]);
    setShowBindingDialog(false);
  };

  const handleDeleteBinding = (bindingId: number) => {
    if (confirm("Вы уверены, что хотите удалить эту привязку номера?")) {
      deleteBindingMutation.mutate(bindingId);
    }
  };

  // Мутация для удаления администратора
  const deleteAdminMutation = useMutation({
    mutationFn: async (adminId: number) => {
      await apiRequest(`/api/admins/${adminId}`, {
        method: "DELETE"
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admins"] });
      toast({
        title: "Успешно",
        description: "Администратор удалён",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось удалить администратора",
        variant: "destructive",
      });
    },
  });

  const handleDeleteAdmin = (adminId: number) => {
    if (confirm("Вы уверены, что хотите удалить этого администратора?")) {
      deleteAdminMutation.mutate(adminId);
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
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      {/* Mobile Title */}
      <div className="md:hidden">
        <h1 className="text-2xl font-bold text-gray-900">Настройки</h1>
      </div>

      {/* Header - Desktop only */}
      <div className="hidden md:block">
        <h1 className="text-2xl font-bold text-gray-900">Настройки системы</h1>
        <p className="text-gray-600 mt-2">Управление Telegram-ботами и чатами для регистрации участников</p>
      </div>

      {/* Telegram Bots Section */}
      <Card>
        <CardHeader className="p-4 md:p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center space-x-2">
              <BotIcon className="h-5 w-5" />
              <CardTitle className="text-lg md:text-xl">Telegram-боты</CardTitle>
            </div>
            <Button 
              className="gap-2 w-full md:w-auto"
              onClick={() => setShowBotDialog(true)}
            >
              <Plus className="h-4 w-4" />
              Добавить бота
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {(bots as Bot[]).length === 0 ? (
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
                      <p className="text-sm text-gray-600">Telegram бот для уведомлений</p>
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
        <CardHeader className="p-4 md:p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center space-x-2">
              <MessageCircle className="h-5 w-5" />
              <CardTitle className="text-lg md:text-xl">Telegram-чаты</CardTitle>
            </div>
            <Button 
              className="gap-2 w-full md:w-auto"
              onClick={() => setShowChatDialog(true)}
              disabled={(bots as Bot[]).length === 0}
            >
              <Plus className="h-4 w-4" />
              Добавить чат
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {(chats as Chat[])?.length === 0 ? (
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
                {(bots as Bot[])?.map((bot: Bot) => (
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

      {/* Fixed Number Bindings Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Hash className="h-5 w-5" />
              Привязка номеров
            </CardTitle>
            <p className="text-sm text-gray-600">
              Фиксированные привязки telegram-ников к номерам участников
            </p>
          </div>
          <Button onClick={() => setShowBindingDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Добавить привязку
          </Button>
        </CardHeader>
        <CardContent>
          {bindingsLoading ? (
            <div className="text-center py-4">Загрузка...</div>
          ) : (fixedBindings as FixedNumberBinding[]).length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              Нет настроенных привязок номеров
            </div>
          ) : (
            <div className="space-y-2">
              {(fixedBindings as FixedNumberBinding[]).map((binding: FixedNumberBinding) => (
                <div key={binding.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center space-x-3">
                    <Badge variant="outline" className="font-mono">
                      #{binding.participantNumber}
                    </Badge>
                    <span className="text-gray-700">@{binding.telegramNickname}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteBinding(binding.id)}
                    className="text-red-600 hover:text-red-800"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Fixed Binding Dialog */}
      <Dialog open={showBindingDialog} onOpenChange={setShowBindingDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Добавить привязку номера</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateBinding} className="space-y-4">
            <div>
              <Label htmlFor="telegram-nickname">Telegram-ник</Label>
              <div className="space-y-2">
                {/* Toggle between select and input */}
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="use-custom"
                    checked={useCustomNickname}
                    onChange={(e) => {
                      setUseCustomNickname(e.target.checked);
                      if (!e.target.checked) {
                        setNewBinding({ ...newBinding, telegramNickname: "" });
                      }
                    }}
                    className="rounded"
                  />
                  <Label htmlFor="use-custom" className="text-sm">
                    Ввести новый ник
                  </Label>
                </div>
                
                {useCustomNickname ? (
                  <Input
                    id="telegram-nickname"
                    value={newBinding.telegramNickname}
                    onChange={(e) => setNewBinding({ ...newBinding, telegramNickname: e.target.value })}
                    placeholder="username"
                    required
                  />
                ) : (
                  <select
                    id="telegram-nickname-select"
                    value={newBinding.telegramNickname}
                    onChange={(e) => setNewBinding({ ...newBinding, telegramNickname: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    required
                    disabled={nicknamesLoading}
                  >
                    <option value="">Выберите telegram-ник</option>
                    {(telegramNicknames as string[]).map((nickname: string) => (
                      <option key={nickname} value={nickname}>
                        @{nickname}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Ник без символа @. Выберите из существующих или введите новый.
              </p>
            </div>
            <div>
              <Label htmlFor="participant-number">Номер участника</Label>
              <Input
                id="participant-number"
                type="number"
                min="1"
                max="999"
                value={newBinding.participantNumber}
                onChange={(e) => {
                  const number = parseInt(e.target.value);
                  setNewBinding({ ...newBinding, participantNumber: number });
                  if (!isNaN(number)) {
                    checkNumberConflicts(number);
                  }
                }}
                placeholder="1"
                required
              />
              
              {/* Conflict warnings */}
              {checkingConflicts && (
                <div className="text-xs text-blue-600 mt-1">
                  Проверка конфликтов...
                </div>
              )}
              
              {numberConflicts.length > 0 && (
                <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-md">
                  <div className="text-sm font-medium text-amber-800">
                    ⚠️ Конфликт номеров ({numberConflicts.length})
                  </div>
                  <div className="text-xs text-amber-700 mt-1">
                    Номер {newBinding.participantNumber} уже используется:
                  </div>
                  <div className="text-xs text-amber-600 mt-2 space-y-1 max-h-20 overflow-y-auto">
                    {numberConflicts.map((conflict, index) => (
                      <div key={index}>
                        • {conflict.userName} (@{conflict.telegramNickname}) в "{conflict.eventName}"
                      </div>
                    ))}
                  </div>
                  <div className="text-xs text-amber-700 mt-2">
                    При создании привязки участники не получат номер {newBinding.participantNumber} в мероприятиях, где он уже занят.
                  </div>
                </div>
              )}
              
              <p className="text-xs text-gray-500 mt-1">
                Фиксированный номер от 1 до 999. При создании привязки все существующие пользователи с этим telegram-ником будут обновлены на новый номер (если номер не занят в их мероприятиях).
              </p>
            </div>
            <div className="flex justify-end space-x-2">
              <Button 
                type="button" 
                variant="outline"
                onClick={resetBindingForm}
              >
                Отмена
              </Button>
              <Button 
                type="submit"
                disabled={createBindingMutation.isPending}
              >
                {createBindingMutation.isPending ? "Добавление..." : "Добавить"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Администраторы */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Users className="h-5 w-5" />
              <CardTitle>Администраторы</CardTitle>
            </div>
            <Button 
              onClick={() => {
                setEditingAdmin(null);
                setShowAdminDialog(true);
              }}
              size="sm"
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Добавить администратора
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {adminsLoading ? (
            <p className="text-gray-500">Загрузка администраторов...</p>
          ) : (
            <div className="space-y-2">
              {(admins as AdminUser[]).map((admin: AdminUser) => (
                <div
                  key={admin.id}
                  className="flex items-center justify-between p-3 border rounded-lg bg-gray-50"
                >
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-medium">@{admin.username}</span>
                      {admin.isSuperAdmin && (
                        <Badge variant="secondary">Супер-админ</Badge>
                      )}
                      {!admin.isActive && (
                        <Badge variant="destructive">Отключен</Badge>
                      )}
                    </div>
                    {admin.fullName && (
                      <p className="text-sm text-gray-500">{admin.fullName}</p>
                    )}
                    {admin.email && (
                      <p className="text-xs text-gray-400">{admin.email}</p>
                    )}
                    <p className="text-xs text-gray-400">
                      Создан: {new Date(admin.createdAt!).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditingAdmin(admin);
                        setShowAdminDialog(true);
                      }}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteAdmin(admin.id)}
                      disabled={admin.isSuperAdmin}
                      title={admin.isSuperAdmin ? "Нельзя удалить супер-администратора" : "Удалить администратора"}
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

      {/* Admin Dialog */}
      <AdminDialog
        open={showAdminDialog}
        onOpenChange={setShowAdminDialog}
        admin={editingAdmin}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["/api/admins"] });
          setShowAdminDialog(false);
          setEditingAdmin(null);
        }}
      />
    </div>
  );
}

// Компонент диалога для администратора
function AdminDialog({
  open,
  onOpenChange,
  admin,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  admin: AdminUser | null;
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  const isEdit = !!admin;

  const form = useForm<InsertAdminUserWithValidation>({
    resolver: zodResolver(insertAdminUserSchema),
    defaultValues: {
      username: "",
      password: "",
      fullName: "",
      email: "",
      isActive: true,
      isSuperAdmin: false,
    },
  });

  // Reset form when admin changes
  useEffect(() => {
    if (admin) {
      form.reset({
        username: admin.username,
        password: "", // Don't show existing password
        fullName: admin.fullName || "",
        email: admin.email || "",
        isActive: admin.isActive,
        isSuperAdmin: admin.isSuperAdmin,
      });
    } else {
      form.reset({
        username: "",
        password: "",
        fullName: "",
        email: "",
        isActive: true,
        isSuperAdmin: false,
      });
    }
  }, [admin, form]);

  const createAdminMutation = useMutation({
    mutationFn: async (adminData: InsertAdminUserWithValidation) => {
      if (isEdit && admin) {
        await apiRequest(`/api/admins/${admin.id}`, {
          method: "PUT",
          body: adminData
        });
      } else {
        await apiRequest("/api/admins", {
          method: "POST",
          body: adminData
        });
      }
    },
    onSuccess: () => {
      onSuccess();
      toast({
        title: "Успешно",
        description: isEdit ? "Администратор обновлён" : "Администратор создан",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось сохранить администратора",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: InsertAdminUserWithValidation) => {
    createAdminMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Редактировать администратора" : "Добавить администратора"}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Имя пользователя</FormLabel>
                  <FormControl>
                    <Input placeholder="admin123" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {isEdit ? "Новый пароль (оставьте пустым, чтобы не менять)" : "Пароль"}
                  </FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="••••••" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="fullName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>ФИО (необязательно)</FormLabel>
                  <FormControl>
                    <Input placeholder="Иван Иванов" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email (необязательно)</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="admin@example.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex space-x-4">
              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Активный</FormLabel>
                    </div>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="isSuperAdmin"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Супер-админ</FormLabel>
                    </div>
                  </FormItem>
                )}
              />
            </div>

            <div className="flex justify-end space-x-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Отмена
              </Button>
              <Button type="submit" disabled={createAdminMutation.isPending}>
                {createAdminMutation.isPending
                  ? "Сохранение..."
                  : isEdit
                  ? "Обновить"
                  : "Создать"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}