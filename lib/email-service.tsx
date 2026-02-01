import type { Location, EmergencyContact, EvidencePacket } from './safety-types';

// Helper to generate Google Maps link
const getMapLink = (location: Location): string => {
  return `https://www.google.com/maps?q=${location.lat},${location.lng}`;
};

// Format location for display
const formatLocation = (location: Location): string => {
  return `Lat: ${location.lat.toFixed(6)}, Lng: ${location.lng.toFixed(6)}`;
};

// Format timestamp
const formatTime = (timestamp: number): string => {
  return new Date(timestamp).toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
};

interface AlertEmailParams {
  contact: EmergencyContact;
  riderName: string;
  threatLevel: 'dispatch' | 'emergency';
  threatScore: number;
  location: Location;
  vehicleInfo?: {
    licensePlate?: string;
    color?: string;
    model?: string;
    make?: string;
    driverName?: string;
  };
  evidencePacket?: EvidencePacket;
}

// Send email via API route (avoids nodemailer runtime issues)
async function sendEmailViaAPI(
  to: string,
  subject: string,
  html: string,
  text: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch('/api/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, subject, html, text }),
    });

    const data = await response.json();
    return { success: data.success, error: data.error };
  } catch (error) {
    console.error('Failed to send email via API:', error);
    return { success: false, error: 'Network error' };
  }
}

// Send alert email to emergency contact
export async function sendAlertEmail(params: AlertEmailParams): Promise<{ success: boolean; error?: string }> {
  const { contact, riderName, threatLevel, threatScore, location, vehicleInfo, evidencePacket } = params;

  const mapLink = getMapLink(location);
  const isEmergency = threatLevel === 'emergency';
  const threatPercent = (threatScore * 100).toFixed(0);

  const subject = isEmergency
    ? `EMERGENCY ALERT: ${riderName} needs immediate help!`
    : `SafeRide Alert: ${riderName} may be in danger`;

  const vehicleHtml = vehicleInfo
    ? `
    <div style="margin: 15px 0; padding: 15px; background: #f8f9fa; border-radius: 8px;">
      <h3 style="margin: 0 0 10px 0; color: #374151;">Vehicle Information</h3>
      ${vehicleInfo.licensePlate ? `<div><strong>License Plate:</strong> ${vehicleInfo.licensePlate}</div>` : ''}
      ${vehicleInfo.color || vehicleInfo.make || vehicleInfo.model ? `<div><strong>Vehicle:</strong> ${vehicleInfo.color || ''} ${vehicleInfo.make || ''} ${vehicleInfo.model || ''}</div>` : ''}
      ${vehicleInfo.driverName ? `<div><strong>Driver:</strong> ${vehicleInfo.driverName}</div>` : ''}
    </div>
    `
    : '';

  const html = `
    <!DOCTYPE html>
    <html>
    <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background: #f3f4f6;">
      <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: ${isEmergency ? '#dc2626' : '#f59e0b'}; color: white; padding: 25px; border-radius: 8px 8px 0 0; text-align: center;">
          <h1 style="margin: 0; font-size: 24px;">${isEmergency ? 'EMERGENCY ALERT' : 'SAFETY ALERT'}</h1>
          <p style="margin: 10px 0 0 0; opacity: 0.9;">SafeRide Passive Safety System</p>
        </div>

        <div style="background: white; padding: 25px; border: 1px solid #e5e7eb; border-top: none;">
          <p style="font-size: 16px; color: #1f2937;">Dear ${contact.name},</p>
          
          <div style="background: ${isEmergency ? '#fef2f2' : '#fffbeb'}; border-left: 4px solid ${isEmergency ? '#dc2626' : '#f59e0b'}; padding: 15px; margin: 20px 0;">
            <p style="margin: 0; font-size: 16px;">
              <strong>${riderName}</strong> ${isEmergency ? 'needs immediate help!' : 'may be in a potentially dangerous situation.'}
            </p>
            <p style="margin: 10px 0 0 0; font-weight: bold; color: ${isEmergency ? '#dc2626' : '#d97706'};">
              Threat Level: ${threatPercent}%
            </p>
          </div>

          <div style="margin: 20px 0; padding: 15px; background: #eff6ff; border-radius: 8px;">
            <h3 style="margin: 0 0 10px 0; color: #1e40af;">Last Known Location</h3>
            <p style="margin: 0;">${formatLocation(location)}</p>
            <p style="margin: 5px 0;">Time: ${formatTime(location.timestamp)}</p>
            <a href="${mapLink}" style="display: inline-block; margin-top: 10px; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
              View on Google Maps
            </a>
          </div>

          ${vehicleHtml}

          <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 15px; margin: 20px 0;">
            <h3 style="margin: 0 0 10px 0; color: #166534;">What You Should Do:</h3>
            <ul style="margin: 0; padding-left: 20px; color: #166534;">
              <li>Try to contact ${riderName} immediately</li>
              <li>If no response, consider calling emergency services (112)</li>
              <li>Keep this email for reference</li>
            </ul>
          </div>

          <p style="color: #6b7280; font-size: 14px;">Alert Time: ${formatTime(Date.now())}</p>
        </div>

        <div style="background: #f9fafb; padding: 15px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; text-align: center;">
          <p style="margin: 0; color: #6b7280; font-size: 12px;">
            This is an automated alert from SafeRide.<br>
            You are receiving this because you are listed as an emergency contact.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
${isEmergency ? 'EMERGENCY' : 'SAFETY'} ALERT - SafeRide

Dear ${contact.name},

${riderName} ${isEmergency ? 'needs immediate help!' : 'may be in a potentially dangerous situation.'}

Threat Level: ${threatPercent}%

Last Known Location:
${formatLocation(location)}
Time: ${formatTime(location.timestamp)}
Map: ${mapLink}

${vehicleInfo ? `Vehicle Information:
${vehicleInfo.licensePlate ? `License Plate: ${vehicleInfo.licensePlate}` : ''}
${vehicleInfo.color || vehicleInfo.make || vehicleInfo.model ? `Vehicle: ${vehicleInfo.color || ''} ${vehicleInfo.make || ''} ${vehicleInfo.model || ''}` : ''}
${vehicleInfo.driverName ? `Driver: ${vehicleInfo.driverName}` : ''}` : ''}

What You Should Do:
- Try to contact ${riderName} immediately
- If no response, consider calling emergency services (112)
- Keep this email for reference

Alert Time: ${formatTime(Date.now())}

---
SafeRide Passive Safety System
  `;

  return sendEmailViaAPI(contact.email, subject, html, text);
}

// Send location update email
export async function sendLocationUpdateEmail(params: {
  contact: EmergencyContact;
  riderName: string;
  location: Location;
  updateNumber: number;
}): Promise<{ success: boolean; error?: string }> {
  const { contact, riderName, location, updateNumber } = params;
  const mapLink = getMapLink(location);

  const subject = `SafeRide Location Update #${updateNumber} for ${riderName}`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
      <div style="background: #3b82f6; color: white; padding: 15px; border-radius: 8px 8px 0 0; text-align: center;">
        <h2 style="margin: 0;">Location Update #${updateNumber}</h2>
      </div>
      <div style="background: white; padding: 20px; border: 1px solid #e5e7eb; border-radius: 0 0 8px 8px;">
        <p><strong>${riderName}</strong>'s current location:</p>
        <p style="background: #f3f4f6; padding: 10px; border-radius: 6px;">${formatLocation(location)}</p>
        <p>Time: ${formatTime(location.timestamp)}</p>
        <a href="${mapLink}" style="display: inline-block; background: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px;">View on Map</a>
      </div>
    </div>
  `;

  const text = `Location Update #${updateNumber} for ${riderName}\n\n${formatLocation(location)}\nTime: ${formatTime(location.timestamp)}\nMap: ${mapLink}`;

  return sendEmailViaAPI(contact.email, subject, html, text);
}

// Send ride ended safely email
export async function sendRideSafeEmail(params: {
  contact: EmergencyContact;
  riderName: string;
}): Promise<{ success: boolean; error?: string }> {
  const { contact, riderName } = params;

  const subject = `SafeRide: ${riderName} has arrived safely`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; text-align: center;">
      <div style="background: #16a34a; color: white; padding: 30px; border-radius: 8px;">
        <h1 style="margin: 0;">Ride Completed Safely</h1>
        <p style="margin: 15px 0 0 0; font-size: 18px;">
          <strong>${riderName}</strong> has arrived at their destination safely.
        </p>
      </div>
      <p style="color: #6b7280; margin-top: 20px;">
        No further action is required. Thank you for being a trusted emergency contact.
      </p>
    </div>
  `;

  const text = `${riderName} has arrived safely at their destination. No further action is required.`;

  return sendEmailViaAPI(contact.email, subject, html, text);
}
