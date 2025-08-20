import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { CheckCircle, Settings, User, Bot, MessageSquare } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useMutation } from "@tanstack/react-query";

interface SetupStep {
  id: number;
  title: string;
  icon: any;
  completed: boolean;
}

interface SetupData {
  admin: {
    username: string;
    password: string;
    confirmPassword: string;
    fullName?: string;
    email?: string;
  };
  bot: {
    token: string;
    name: string;
  };
  chat: {
    chatId: string;
    title: string;
  };
}

export default function Setup() {
  const [currentStep, setCurrentStep] = useState(1);
  const [setupData, setSetupData] = useState<SetupData>({
    admin: {
      username: "",
      password: "",
      confirmPassword: "",
      fullName: "",
      email: "",
    },
    bot: {
      token: "",
      name: "",
    },
    chat: {
      chatId: "",
      title: "",
    },
  });

  const { toast } = useToast();

  const steps: SetupStep[] = [
    { id: 1, title: "Создание администратора", icon: User, completed: false },
    { id: 2, title: "Настройка Telegram бота", icon: Bot, completed: false },
    { id: 3, title: "Добавление чата", icon: MessageSquare, completed: false },
    { id: 4, title: "Завершение", icon: CheckCircle, completed: false },
  ];

  const completeMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("/api/setup/complete", {
        method: "POST",
        body: data
      });
    },
    onSuccess: () => {
      toast({
        title: "Настройка завершена!",
        description: "Система готова к работе. Перенаправляем на страницу входа...",
      });
      setTimeout(() => {
        window.location.href = "/login";
      }, 2000);
    },
    onError: (error) => {
      toast({
        title: "Ошибка настройки",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleNext = () => {
    // Валидация текущего шага
    if (currentStep === 1) {
      if (!setupData.admin.username || !setupData.admin.password) {
        toast({
          title: "Заполните обязательные поля",
          description: "Логин и пароль администратора обязательны",
          variant: "destructive",
        });
        return;
      }
      if (setupData.admin.password !== setupData.admin.confirmPassword) {
        toast({
          title: "Пароли не совпадают",
          description: "Проверьте правильность ввода пароля",
          variant: "destructive",
        });
        return;
      }
    }

    if (currentStep < 4) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleComplete = () => {
    const submitData = {
      admin: {
        username: setupData.admin.username,
        password: setupData.admin.password,
        fullName: setupData.admin.fullName || undefined,
        email: setupData.admin.email || undefined,
      },
      bot: setupData.bot.token ? {
        token: setupData.bot.token,
        name: setupData.bot.name || "Telegram Bot",
      } : undefined,
      chat: setupData.chat.chatId ? {
        chatId: setupData.chat.chatId,
        title: setupData.chat.title || "Уведомления",
        botId: 1, // Будет установлен автоматически
      } : undefined,
    };

    completeMutation.mutate(submitData);
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="username">Логин администратора *</Label>
              <Input
                id="username"
                value={setupData.admin.username}
                onChange={(e) =>
                  setSetupData(prev => ({
                    ...prev,
                    admin: { ...prev.admin, username: e.target.value }
                  }))
                }
                placeholder="admin"
              />
            </div>
            <div>
              <Label htmlFor="password">Пароль *</Label>
              <Input
                id="password"
                type="password"
                value={setupData.admin.password}
                onChange={(e) =>
                  setSetupData(prev => ({
                    ...prev,
                    admin: { ...prev.admin, password: e.target.value }
                  }))
                }
                placeholder="Минимум 6 символов"
              />
            </div>
            <div>
              <Label htmlFor="confirmPassword">Подтверждение пароля *</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={setupData.admin.confirmPassword}
                onChange={(e) =>
                  setSetupData(prev => ({
                    ...prev,
                    admin: { ...prev.admin, confirmPassword: e.target.value }
                  }))
                }
                placeholder="Повторите пароль"
              />
            </div>
            <div>
              <Label htmlFor="fullName">Полное имя</Label>
              <Input
                id="fullName"
                value={setupData.admin.fullName}
                onChange={(e) =>
                  setSetupData(prev => ({
                    ...prev,
                    admin: { ...prev.admin, fullName: e.target.value }
                  }))
                }
                placeholder="Иван Иванов"
              />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={setupData.admin.email}
                onChange={(e) =>
                  setSetupData(prev => ({
                    ...prev,
                    admin: { ...prev.admin, email: e.target.value }
                  }))
                }
                placeholder="admin@example.com"
              />
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="font-medium mb-2">Создание Telegram бота</h4>
              <ol className="text-sm text-gray-600 space-y-1">
                <li>1. Найдите @BotFather в Telegram</li>
                <li>2. Отправьте команду /newbot</li>
                <li>3. Следуйте инструкциям для создания бота</li>
                <li>4. Скопируйте полученный токен и вставьте ниже</li>
              </ol>
            </div>
            <div>
              <Label htmlFor="botToken">Токен Telegram бота</Label>
              <Input
                id="botToken"
                value={setupData.bot.token}
                onChange={(e) =>
                  setSetupData(prev => ({
                    ...prev,
                    bot: { ...prev.bot, token: e.target.value }
                  }))
                }
                placeholder="1234567890:AABBccDDee..."
              />
            </div>
            <div>
              <Label htmlFor="botName">Название бота</Label>
              <Input
                id="botName"
                value={setupData.bot.name}
                onChange={(e) =>
                  setSetupData(prev => ({
                    ...prev,
                    bot: { ...prev.bot, name: e.target.value }
                  }))
                }
                placeholder="Бот регистрации"
              />
            </div>
            <p className="text-sm text-gray-500">
              Токен бота можно добавить и позже в настройках системы.
            </p>
          </div>
        );

      case 3:
        return (
          <div className="space-y-4">
            <div className="bg-green-50 p-4 rounded-lg">
              <h4 className="font-medium mb-2">Настройка чата для уведомлений</h4>
              <ol className="text-sm text-gray-600 space-y-1">
                <li>1. Создайте группу в Telegram</li>
                <li>2. Добавьте вашего бота в группу как администратора</li>
                <li>3. Для получения ID чата используйте @userinfobot</li>
                <li>4. Введите ID чата (начинается с -)</li>
              </ol>
            </div>
            <div>
              <Label htmlFor="chatId">ID чата</Label>
              <Input
                id="chatId"
                value={setupData.chat.chatId}
                onChange={(e) =>
                  setSetupData(prev => ({
                    ...prev,
                    chat: { ...prev.chat, chatId: e.target.value }
                  }))
                }
                placeholder="-1001234567890"
              />
            </div>
            <div>
              <Label htmlFor="chatTitle">Название чата</Label>
              <Input
                id="chatTitle"
                value={setupData.chat.title}
                onChange={(e) =>
                  setSetupData(prev => ({
                    ...prev,
                    chat: { ...prev.chat, title: e.target.value }
                  }))
                }
                placeholder="Уведомления о регистрации"
              />
            </div>
            <p className="text-sm text-gray-500">
              Чат для уведомлений можно настроить и позже в разделе настроек.
            </p>
          </div>
        );

      case 4:
        return (
          <div className="space-y-4 text-center">
            <div className="mb-6">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Настройка готова!</h3>
              <p className="text-gray-600">
                Система управления мероприятиями настроена и готова к использованию.
              </p>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg text-left">
              <h4 className="font-medium mb-2">Что будет создано:</h4>
              <ul className="text-sm space-y-1">
                <li>✓ Администратор: {setupData.admin.username}</li>
                {setupData.bot.token && (
                  <li>✓ Telegram бот: {setupData.bot.name}</li>
                )}
                {setupData.chat.chatId && (
                  <li>✓ Чат уведомлений: {setupData.chat.title}</li>
                )}
              </ul>
            </div>
            <Button 
              onClick={handleComplete}
              disabled={completeMutation.isPending}
              className="w-full"
              size="lg"
            >
              {completeMutation.isPending ? "Настройка..." : "Завершить настройку"}
            </Button>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full">
        <div className="text-center mb-8">
          <Settings className="w-16 h-16 text-blue-600 mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-gray-900">Первоначальная настройка</h1>
          <p className="text-gray-600 mt-2">
            Добро пожаловать! Настройте систему управления мероприятиями за несколько простых шагов.
          </p>
        </div>

        <div className="flex justify-center mb-8">
          <div className="flex items-center space-x-4">
            {steps.map((step, index) => {
              const Icon = step.icon;
              const isActive = currentStep === step.id;
              const isCompleted = currentStep > step.id;
              
              return (
                <div key={step.id} className="flex items-center">
                  <div
                    className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
                      isActive
                        ? "border-blue-600 bg-blue-600 text-white"
                        : isCompleted
                        ? "border-green-500 bg-green-500 text-white"
                        : "border-gray-300 bg-white text-gray-400"
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="ml-2 hidden sm:block">
                    <p className={`text-sm font-medium ${isActive ? "text-blue-600" : "text-gray-500"}`}>
                      {step.title}
                    </p>
                  </div>
                  {index < steps.length - 1 && (
                    <div className="w-8 h-0.5 bg-gray-300 ml-4" />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle>Шаг {currentStep}: {steps[currentStep - 1].title}</CardTitle>
          </CardHeader>
          <CardContent>
            {renderStep()}
            {currentStep < 4 && (
              <div className="flex justify-between mt-6">
                <Button
                  variant="outline"
                  onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
                  disabled={currentStep === 1}
                >
                  Назад
                </Button>
                <Button onClick={handleNext}>
                  {currentStep === 3 ? "Далее" : "Следующий шаг"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}