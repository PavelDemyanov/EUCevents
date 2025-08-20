import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { Event, UserWithEvent } from '@shared/schema';

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

export async function generateParticipantsPDF(
  eventId: number,
  storage: any
): Promise<Buffer> {
  return new Promise(async (resolve, reject) => {
    try {
      // Get event and participants data
      const event = await storage.getEvent(eventId);
      const participants = await storage.getUsersByEventId(eventId);
      
      if (!event) {
        return reject(new Error('Мероприятие не найдено'));
      }

      const doc = new PDFDocument({
        size: 'A4',
        margin: 50,
      });

      const buffers: Buffer[] = [];
      doc.on('data', (buffer) => buffers.push(buffer));
      doc.on('end', () => resolve(Buffer.concat(buffers)));

      // Try to use DejaVu Sans font that supports Cyrillic
      try {
        // Try to find and use DejaVu font
        const fs = require('fs');
        const dejavuPaths = [
          '/nix/store/*/share/fonts/truetype/dejavu/DejaVuSans.ttf',
          '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
          '/System/Library/Fonts/DejaVuSans.ttf'
        ];
        
        let fontFound = false;
        for (const fontPath of dejavuPaths) {
          try {
            if (fs.existsSync(fontPath) || fontPath.includes('*')) {
              // For nix paths with wildcards, we'll use exec to find the actual path
              if (fontPath.includes('*')) {
                const { execSync } = require('child_process');
                try {
                  const actualPath = execSync(`find /nix/store -name "DejaVuSans.ttf" -path "*dejavu*" | head -1`).toString().trim();
                  if (actualPath) {
                    doc.font(actualPath);
                    fontFound = true;
                    break;
                  }
                } catch (e) {
                  continue;
                }
              } else {
                doc.font(fontPath);
                fontFound = true;
                break;
              }
            }
          } catch (e) {
            continue;
          }
        }
        
        if (!fontFound) {
          doc.font('Helvetica');
        }
      } catch (e) {
        // Fallback to default font
        console.log('Font loading failed, using Helvetica');
        doc.font('Helvetica');
      }
      
      // Title with proper encoding
      doc.fontSize(20)
         .text('Список участников мероприятия', { 
           align: 'center',
           width: doc.page.width - 100
         });
      
      doc.moveDown(0.5);
      
      // Event details
      doc.fontSize(16)
         .text(event.name, { align: 'center' });
      
      doc.fontSize(12)
         .text(event.location, { align: 'center' })
         .text(formatDateTime(event.datetime), { align: 'center' });
      
      doc.moveDown(1);

      // Table header
      const tableTop = doc.y;
      const itemCodeX = 50;
      const itemNameX = 80;
      const itemNicknameX = 250;
      const itemPhoneX = 350;
      const itemTransportX = 450;

      doc.fontSize(10)
         .text('№', itemCodeX, tableTop)
         .text('ФИО', itemNameX, tableTop)
         .text('Telegram', itemNicknameX, tableTop)
         .text('Телефон', itemPhoneX, tableTop)
         .text('Транспорт', itemTransportX, tableTop);

      // Draw header line
      doc.moveTo(itemCodeX, tableTop + 20)
         .lineTo(550, tableTop + 20)
         .stroke();

      // Table rows
      let currentY = tableTop + 30;
      const activeParticipants = (participants || []).filter(p => p.isActive);
      
      activeParticipants.forEach((participant, index) => {
        // Check if we need a new page
        if (currentY > 700) {
          doc.addPage();
          currentY = 50;
        }

        const transportText = participant.transportModel 
          ? `${getTransportTypeLabel(participant.transportType)} (${participant.transportModel})`
          : getTransportTypeLabel(participant.transportType);

        doc.fontSize(9)
           .text(participant.participantNumber?.toString() || '', itemCodeX, currentY)
           .text(participant.fullName, itemNameX, currentY, { width: 160 })
           .text(participant.telegramNickname || '', itemNicknameX, currentY, { width: 90 })
           .text(formatPhoneNumber(participant.phone), itemPhoneX, currentY)
           .text(transportText, itemTransportX, currentY, { width: 100 });

        currentY += 20;

        // Draw row line
        if (index < activeParticipants.length - 1) {
          doc.moveTo(itemCodeX, currentY - 5)
             .lineTo(550, currentY - 5)
             .stroke();
        }
      });

      // Summary
      doc.moveDown(2);
      const summaryY = currentY + 40;
      
      // Bottom border
      doc.moveTo(50, summaryY - 20)
         .lineTo(550, summaryY - 20)
         .stroke();

      doc.fontSize(14)
         .text('Сводка по участникам:', 50, summaryY);

      const monowheelCount = activeParticipants.filter(p => p.transportType === 'monowheel').length;
      const scooterCount = activeParticipants.filter(p => p.transportType === 'scooter').length;
      const spectatorCount = activeParticipants.filter(p => p.transportType === 'spectator').length;
      const totalCount = activeParticipants.length;

      doc.fontSize(12)
         .text(`Моноколеса: ${monowheelCount}`, 100, summaryY + 30)
         .text(`Самокаты: ${scooterCount}`, 250, summaryY + 30)
         .text(`Зрители: ${spectatorCount}`, 400, summaryY + 30);

      doc.fontSize(14)
         .text(`Всего участников: ${totalCount}`, 50, summaryY + 60, { align: 'center' });

      // Footer
      doc.fontSize(8)
         .text(
           `Сгенерировано ${new Date().toLocaleString('ru-RU')}`,
           50,
           750,
           { align: 'center' }
         );

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

function getTransportTypeLabel(type: string): string {
  switch (type) {
    case 'monowheel': return 'Моноколесо';
    case 'scooter': return 'Самокат';
    case 'spectator': return 'Зритель';
    default: return type;
  }
}

function formatDateTime(date: Date | string): string {
  if (!date) return 'Не указано';
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(dateObj.getTime())) return 'Неверная дата';
  
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(dateObj);
}
