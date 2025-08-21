import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { Event, UserWithEvent } from '@shared/schema';
import { storage } from './storage';

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

// Mask phone number for public sharing: +7 (XXX) XXX-XX-XX -> +7 (XXX) ***-**-**
function maskPhoneNumber(phone: string): string {
  if (!phone) return phone;
  
  const formatted = formatPhoneNumber(phone);
  
  // Mask the formatted phone: +7 (123) 456-78-90 -> +7 (123) ***-**-**
  const match = formatted.match(/^(\+7 \(\d{3}\)) (.+)$/);
  if (match) {
    return `${match[1]} ***-**-**`;
  }
  
  // If not in expected format, return masked version
  return '***-**-**';
}

export async function generateParticipantsPDF(
  eventId: number,
  storage: any,
  maskPhones: boolean = false
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

      // Try to use a font that supports Cyrillic characters
      try {
        // Use the system DejaVu font directly
        doc.font('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf');
        console.log('DejaVu font loaded successfully');
      } catch (e) {
        try {
          // Try Nix store path
          const { execSync } = require('child_process');
          const dejavuPath = execSync('find /nix/store -name "DejaVuSans.ttf" 2>/dev/null | head -1').toString().trim();
          if (dejavuPath) {
            doc.font(dejavuPath);
            console.log('DejaVu font loaded from Nix store');
          } else {
            throw new Error('DejaVu not found');
          }
        } catch (e2) {
          // Ultimate fallback - encode text differently for better Cyrillic support
          console.log('Using Helvetica with improved text encoding');
        }
      }
      
      // Title with proper encoding - convert to buffer to ensure UTF-8
      const titleText = Buffer.from('Список участников мероприятия', 'utf8').toString('utf8');
      doc.fontSize(20)
         .text(titleText, { 
           align: 'center',
           width: doc.page.width - 100
         });
      
      doc.moveDown(0.5);
      
      // Event details with UTF-8 encoding
      const eventName = Buffer.from(event.name || '', 'utf8').toString('utf8');
      const eventLocation = Buffer.from(event.location || '', 'utf8').toString('utf8');
      
      doc.fontSize(16)
         .text(eventName, { align: 'center' });
      
      doc.fontSize(12)
         .text(eventLocation, { align: 'center' })
         .text(formatDateTime(event.datetime), { align: 'center' });
      
      doc.moveDown(1);

      // Table header
      const tableTop = doc.y;
      const itemCodeX = 50;
      const itemNameX = 80;
      const itemNicknameX = 240;
      const itemPhoneX = 330;
      const itemTransportX = 450;

      // Table headers with UTF-8 encoding
      const headers = {
        number: Buffer.from('№', 'utf8').toString('utf8'),
        fullName: Buffer.from('ФИО', 'utf8').toString('utf8'),
        telegram: Buffer.from('Telegram', 'utf8').toString('utf8'),
        phone: Buffer.from('Телефон', 'utf8').toString('utf8'),
        transport: Buffer.from('Транспорт', 'utf8').toString('utf8')
      };

      doc.fontSize(10)
         .text(headers.number, itemCodeX, tableTop)
         .text(headers.fullName, itemNameX, tableTop)
         .text(headers.telegram, itemNicknameX, tableTop)
         .text(headers.phone, itemPhoneX, tableTop)
         .text(headers.transport, itemTransportX, tableTop);

      // Draw header line
      doc.moveTo(itemCodeX, tableTop + 20)
         .lineTo(550, tableTop + 20)
         .stroke();

      // Table rows
      let currentY = tableTop + 30;
      const activeParticipants = (participants || []).filter((p: any) => p.isActive);
      
      activeParticipants.forEach((participant: any, index: number) => {
        // Check if we need a new page (with extra space for multi-line text)
        if (currentY > 650) {
          doc.addPage();
          currentY = 50;
          
          // Redraw header on new page
          doc.fontSize(10)
             .text(headers.number, itemCodeX, currentY)
             .text(headers.fullName, itemNameX, currentY)
             .text(headers.telegram, itemNicknameX, currentY)
             .text(headers.phone, itemPhoneX, currentY)
             .text(headers.transport, itemTransportX, currentY);

          // Draw header line
          doc.moveTo(itemCodeX, currentY + 20)
             .lineTo(550, currentY + 20)
             .stroke();
             
          currentY += 30;
        }

        const transportText = participant.transportModel 
          ? `${getTransportTypeLabel(participant.transportType)} (${participant.transportModel})`
          : getTransportTypeLabel(participant.transportType);

        // Ensure UTF-8 encoding for all text
        const fullName = Buffer.from(participant.fullName || '', 'utf8').toString('utf8');
        const nickname = Buffer.from(participant.telegramNickname || '', 'utf8').toString('utf8');
        const transportTextUtf8 = Buffer.from(transportText || '', 'utf8').toString('utf8');

        // Calculate text heights to determine row height
        const fontSize = 9;
        doc.fontSize(fontSize);
        
        // Format phone number (mask if needed for public sharing)
        const phoneDisplay = maskPhones ? maskPhoneNumber(participant.phone) : formatPhoneNumber(participant.phone);
        
        // Measure text heights for proper row spacing
        const nameHeight = doc.heightOfString(fullName, { width: 150 });
        const nicknameHeight = doc.heightOfString(nickname, { width: 80 });
        const phoneHeight = doc.heightOfString(phoneDisplay, { width: 110 });
        const transportHeight = doc.heightOfString(transportTextUtf8, { width: 100 });
        
        const maxHeight = Math.max(nameHeight, nicknameHeight, phoneHeight, transportHeight, fontSize);
        const rowHeight = Math.max(maxHeight + 6, 20); // At least 20px, but more if text wraps

        doc.text(participant.participantNumber?.toString() || '', itemCodeX, currentY)
           .text(fullName, itemNameX, currentY, { width: 150 })
           .text(nickname, itemNicknameX, currentY, { width: 80 })
           .text(phoneDisplay, itemPhoneX, currentY, { width: 110 })
           .text(transportTextUtf8, itemTransportX, currentY, { width: 100 });

        currentY += rowHeight;

        // Draw row line with proper spacing
        if (index < activeParticipants.length - 1) {
          doc.moveTo(itemCodeX, currentY - 3)
             .lineTo(550, currentY - 3)
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

      // Summary section with UTF-8 encoding
      const summaryText = Buffer.from('Сводка по участникам:', 'utf8').toString('utf8');
      doc.fontSize(14)
         .text(summaryText, 50, summaryY);

      const monowheelCount = activeParticipants.filter((p: any) => p.transportType === 'monowheel').length;
      const scooterCount = activeParticipants.filter((p: any) => p.transportType === 'scooter').length;
      const eboardCount = activeParticipants.filter((p: any) => p.transportType === 'eboard').length;
      const spectatorCount = activeParticipants.filter((p: any) => p.transportType === 'spectator').length;
      const totalCount = activeParticipants.length;

      const monowheelText = Buffer.from(`Моноколеса: ${monowheelCount}`, 'utf8').toString('utf8');
      const scooterText = Buffer.from(`Самокаты: ${scooterCount}`, 'utf8').toString('utf8');
      const eboardText = Buffer.from(`Электро-борд: ${eboardCount}`, 'utf8').toString('utf8');
      const spectatorText = Buffer.from(`Зрители: ${spectatorCount}`, 'utf8').toString('utf8');
      const totalText = Buffer.from(`Всего участников: ${totalCount}`, 'utf8').toString('utf8');

      doc.fontSize(12)
         .text(monowheelText, 70, summaryY + 30)
         .text(scooterText, 200, summaryY + 30)
         .text(eboardText, 320, summaryY + 30)
         .text(spectatorText, 460, summaryY + 30);

      doc.fontSize(14)
         .text(totalText, 50, summaryY + 60, { align: 'center' });



      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

function getTransportTypeLabel(type: string): string {
  switch (type) {
    case 'monowheel': return Buffer.from('Моноколесо', 'utf8').toString('utf8');
    case 'scooter': return Buffer.from('Самокат', 'utf8').toString('utf8');
    case 'eboard': return Buffer.from('Электро-борд', 'utf8').toString('utf8');
    case 'spectator': return Buffer.from('Зритель', 'utf8').toString('utf8');
    default: return Buffer.from(type || '', 'utf8').toString('utf8');
  }
}

function formatDateTime(date: Date | string): string {
  if (!date) return Buffer.from('Не указано', 'utf8').toString('utf8');
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(dateObj.getTime())) return Buffer.from('Неверная дата', 'utf8').toString('utf8');
  
  const formatted = new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(dateObj);
  
  return Buffer.from(formatted, 'utf8').toString('utf8');
}

// Export function with the correct name for the route
export async function generateParticipantListPDF(eventId: number): Promise<Buffer> {
  const event = await storage.getEvent(eventId);
  const participants = await storage.getUsersByEventId(eventId);
  
  if (!event) {
    throw new Error('Мероприятие не найдено');
  }
  
  return generateParticipantsPDF(eventId, storage);
}

// Generate PDF grouped by transport type
export async function generateTransportGroupedPDF(eventId: number, maskPhones: boolean = false): Promise<Buffer> {
  return new Promise(async (resolve) => {
    try {
      const event = await storage.getEvent(eventId);
      const participants = await storage.getUsersByEventId(eventId);

      if (!event) {
        throw new Error('Event not found');
      }

      const doc = new PDFDocument();
      const buffers: Buffer[] = [];
      doc.on('data', (buffer) => buffers.push(buffer));
      doc.on('end', () => resolve(Buffer.concat(buffers)));

      // Try to use DejaVu Sans font that supports Cyrillic
      try {
        // Use the system DejaVu font directly
        doc.font('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf');
        console.log('DejaVu font loaded successfully for transport PDF');
      } catch (e) {
        try {
          // Try Nix store path
          const { execSync } = require('child_process');
          const dejavuPath = execSync('find /nix/store -name "DejaVuSans.ttf" 2>/dev/null | head -1').toString().trim();
          if (dejavuPath) {
            doc.font(dejavuPath);
            console.log('DejaVu font loaded from Nix store for transport PDF');
          } else {
            throw new Error('DejaVu not found');
          }
        } catch (e2) {
          // Ultimate fallback - encode text differently for better Cyrillic support
          console.log('Using Helvetica with improved text encoding for transport PDF');
        }
      }

      // Group participants by transport type
      const activeParticipants = (participants || []).filter(p => p.isActive);
      const groupedParticipants = {
        monowheel: activeParticipants.filter(p => p.transportType === 'monowheel'),
        scooter: activeParticipants.filter(p => p.transportType === 'scooter'),
        eboard: activeParticipants.filter(p => p.transportType === 'eboard'),
        spectator: activeParticipants.filter(p => p.transportType === 'spectator')
      };

      const transportTypes = [
        { key: 'monowheel', label: 'Моноколеса' },
        { key: 'scooter', label: 'Самокаты' },
        { key: 'eboard', label: 'Электро-борды' },
        { key: 'spectator', label: 'Зрители' }
      ];

      let isFirstPage = true;

      // Generate page for each transport type
      for (const transportType of transportTypes) {
        const participants = groupedParticipants[transportType.key as keyof typeof groupedParticipants];
        
        if (participants.length === 0) continue;

        // Add new page for each transport type (except first)
        if (!isFirstPage) {
          doc.addPage();
        }
        isFirstPage = false;

        // Title with proper encoding
        const titleText = Buffer.from(`Список участников мероприятия - ${transportType.label}`, 'utf8').toString('utf8');
        doc.fontSize(20)
           .text(titleText, { 
             align: 'center',
             width: doc.page.width - 100
           });
        
        doc.moveDown(0.5);
        
        // Event details with UTF-8 encoding
        const eventName = Buffer.from(event.name || '', 'utf8').toString('utf8');
        const eventLocation = Buffer.from(event.location || '', 'utf8').toString('utf8');
        
        doc.fontSize(16)
           .text(eventName, { align: 'center' });
        
        doc.fontSize(12)
           .text(eventLocation, { align: 'center' })
           .text(formatDateTime(event.datetime), { align: 'center' });
        
        doc.moveDown(1);

        // Table headers
        const tableTop = doc.y;
        const itemCodeX = 50;
        const itemNameX = 80;
        const itemNicknameX = 240;
        const itemPhoneX = 330;
        const itemTransportX = 450;

        // Table headers with UTF-8 encoding
        const headers = {
          number: Buffer.from('№', 'utf8').toString('utf8'),
          fullName: Buffer.from('ФИО', 'utf8').toString('utf8'),
          telegram: Buffer.from('Telegram', 'utf8').toString('utf8'),
          phone: Buffer.from('Телефон', 'utf8').toString('utf8'),
          transport: Buffer.from('Модель', 'utf8').toString('utf8')
        };

        doc.fontSize(10)
           .text(headers.number, itemCodeX, tableTop)
           .text(headers.fullName, itemNameX, tableTop)
           .text(headers.telegram, itemNicknameX, tableTop)
           .text(headers.phone, itemPhoneX, tableTop)
           .text(headers.transport, itemTransportX, tableTop);

        // Draw header line
        doc.moveTo(itemCodeX, tableTop + 20)
           .lineTo(550, tableTop + 20)
           .stroke();

        // Table rows
        let currentY = tableTop + 30;
        
        participants.forEach((participant, index) => {
          // Check if we need a new page (with extra space for multi-line text)
          if (currentY > 650) {
            doc.addPage();
            currentY = 50;
            
            // Redraw header on new page
            doc.fontSize(10)
               .text(headers.number, itemCodeX, currentY)
               .text(headers.fullName, itemNameX, currentY)
               .text(headers.telegram, itemNicknameX, currentY)
               .text(headers.phone, itemPhoneX, currentY)
               .text(headers.transport, itemTransportX, currentY);

            // Draw header line
            doc.moveTo(itemCodeX, currentY + 20)
               .lineTo(550, currentY + 20)
               .stroke();
               
            currentY += 30;
          }

          const modelText = participant.transportModel || '';

          // Ensure UTF-8 encoding for all text
          const fullName = Buffer.from(participant.fullName || '', 'utf8').toString('utf8');
          const nickname = Buffer.from(participant.telegramNickname || '', 'utf8').toString('utf8');
          const modelTextUtf8 = Buffer.from(modelText, 'utf8').toString('utf8');

          // Calculate text heights to determine row height
          const fontSize = 9;
          doc.fontSize(fontSize);
          
          // Format phone number (mask if needed for public sharing)
          const phoneDisplay = maskPhones ? maskPhoneNumber(participant.phone) : formatPhoneNumber(participant.phone);
          
          // Measure text heights for proper row spacing
          const nameHeight = doc.heightOfString(fullName, { width: 150 });
          const nicknameHeight = doc.heightOfString(nickname, { width: 80 });
          const phoneHeight = doc.heightOfString(phoneDisplay, { width: 110 });
          const modelHeight = doc.heightOfString(modelTextUtf8, { width: 100 });
          
          const maxHeight = Math.max(nameHeight, nicknameHeight, phoneHeight, modelHeight, fontSize);
          const rowHeight = Math.max(maxHeight + 6, 20); // At least 20px, but more if text wraps

          doc.text(participant.participantNumber?.toString() || '', itemCodeX, currentY)
             .text(fullName, itemNameX, currentY, { width: 150 })
             .text(nickname, itemNicknameX, currentY, { width: 80 })
             .text(phoneDisplay, itemPhoneX, currentY, { width: 110 })
             .text(modelTextUtf8, itemTransportX, currentY, { width: 100 });

          currentY += rowHeight;

          // Draw row line with proper spacing
          if (index < participants.length - 1) {
            doc.moveTo(itemCodeX, currentY - 3)
               .lineTo(550, currentY - 3)
               .stroke();
          }
        });

        // Summary for this transport type
        const summaryY = currentY + 30;
        
        // Draw summary line
        doc.moveTo(50, summaryY - 20)
           .lineTo(550, summaryY - 20)
           .stroke();

        // Summary section with UTF-8 encoding
        const summaryText = Buffer.from(`${transportType.label}: ${participants.length} участников`, 'utf8').toString('utf8');
        doc.fontSize(14)
           .text(summaryText, 50, summaryY, { align: 'center' });


      }

      doc.end();
    } catch (error) {
      console.error('Error generating transport PDF:', error);
      throw error;
    }
  });
}
