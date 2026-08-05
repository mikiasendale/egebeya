type MailLocale = 'en' | 'am';

export interface MailTemplate {
	subject: string;
	text: string;
}

const en = {
	bookingCustomer: {
		subject: 'Booking {{status}}: {{service}} at {{business}}',
		text: `Hello {{name}},\n\nYour appointment for {{service}} is {{status}}.\nDate: {{date}}\n\nThank you for choosing {{business}}!`,
	},
	bookingOwner: {
		subject: 'New Booking: {{service}}',
		text: `A new booking has been made by {{name}} for {{service}}.\nDate: {{date}}`,
	},
	reminder: {
		subject: 'Reminder: Your Upcoming Appointment',
		text: `Hello {{name}},\n\nThis is a friendly reminder that you have an appointment coming up at {{date}}.\n\nThank you!`,
	},
	passwordReset: {
		subject: 'Password Reset Request',
		text: `Hello,\n\nYou requested to reset your password. Click the link below to reset it:\n{{link}}\n\nThis link expires in 15 minutes.\nIf you did not request this, please ignore this email.`,
	},
} as const satisfies Record<string, MailTemplate>;

const am = {
	bookingCustomer: {
		subject: 'ቀጠሮ ሁኔታ፥ {{status}}፥ {{service}}፥ {{business}}',
		text: `ሰላም {{name}},\n\n{{service}} ለማድረግ ያዘጋጀዎት ቀጠሮ {{status}} ነው።\nቀን፥ {{date}}\n\n{{business}}ን በመርጠዎት እናመሰግናለን!`,
	},
	bookingOwner: {
		subject: 'አዲስ ቀጠሮ፥ {{service}}',
		text: `{{name}} ለ {{service}} አዲስ ቀጠሮ አስይዟል።\nቀን፥ {{date}}`,
	},
	reminder: {
		subject: 'ማሳሰቢያ፥ ወደ እርስዎ የሚመለስ ቀጠሮ',
		text: `ሰላም {{name}},\n\nቀጠሮዎ በ {{date}} ይካሄዳል።\n\nእናመሰግናለን!`,
	},
	passwordReset: {
		subject: 'የይለፍ ቃል ማሻሻያ ጥያቄ',
		text: `ሰላም,\n\nየይለፍ ቃልዎን ለማሻሻል ጥያቄ አቅርበዋል። ለማሻሻል ከዚህ ሊንክ ይጫኑ።\n{{link}}\n\nይህ ሊንክ ከ 15 ደቂቃዎች በኋላ ያልቃል።\nጥያቄውን ካላቀረቡ እባክዎ ይህንን ኢሜይል ይንቁ።`,
	},
} as const satisfies Record<string, MailTemplate>;

export const templates = {
	en,
	am,
} as const;

type TemplateKey = keyof typeof en;

export function renderTemplate(template: MailTemplate, values: Record<string, string | number>): string {
	let subject = template.subject;
	let text = template.text;
	for (const [key, value] of Object.entries(values)) {
		const re = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
		subject = subject.replace(re, String(value));
		text = text.replace(re, String(value));
	}
	return text;
}

export function applyTemplate(key: TemplateKey, locale: MailLocale, values: Record<string, string | number>): { subject: string; text: string } {
	const template = templates[locale]?.[key] ?? en[key];
	return { subject: renderTemplate(template, values), text: renderTemplate(template, values) };
}
