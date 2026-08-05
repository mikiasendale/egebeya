/**
 * AI generation wrapper using @google/genai (Gemini).
 *
 * In production, reads `GEMINI_API_KEY` from environment. When the key is
 * absent (dev/test), returns a static fallback string — never throws.
 *
 * The public API is deliberately narrow so the backend implementation can
 * swap models or providers without the route code needing to change.
 */

export interface BusinessDescriptionInput {
  businessName: string;
  category: string;
  city?: string;
  services: string[];
  locale?: 'en' | 'am';
}

export interface BusinessDescriptionOutput {
  description: string;
  tagline: string;
}

const API_KEY = (process.env.GEMINI_API_KEY || '').trim();

/**
 * Generate a short "About" description + tagline for a business, in the
 * requested locale. Powered by Gemini when configured; returns a static
 * fallback otherwise.
 */
export async function generateBusinessDescription(
  input: BusinessDescriptionInput,
): Promise<BusinessDescriptionOutput> {
  const serviceList = input.services.length > 0
    ? input.services.slice(0, 5).join(', ')
    : 'services';
  const city = input.city || 'your area';
  const locale = input.locale === 'am' ? 'am' : 'en';

  if (!API_KEY) {
    // Static fallback: always safe, always returns a reasonable result.
    if (locale === 'am') {
      return {
        description: `እንኳን ደህና መጡ ወደ ${input.businessName}። እኛ ${serviceList} እናቀርባለን በ ${city}።`,
        tagline: `${input.businessName} — የእርስዎ ${input.category} ባለሙያ`,
      };
    }
    return {
      description: `Welcome to ${input.businessName}. We provide ${serviceList} in ${city}.`,
      tagline: `Your trusted ${input.category} in ${city}`,
    };
  }

  try {
    const { GoogleGenAI } = await import('@google/genai');
    const genai = new GoogleGenAI({ apiKey: API_KEY });

    const systemPrompt = locale === 'am'
      ? 'You are a business copywriter who writes in Amharic. Write a short, warm About description (2–3 sentences) and a tagline (1 sentence). Never mention any platform name or tool that helped generate the text — only the business name itself.'
      : 'You are a business copywriter. Write a short, warm About description (2–3 sentences) and a tagline (1 sentence). Never mention any platform name or tool that helped generate the text — only the business name itself.';

    const prompt = locale === 'am'
      ? `የንግድ ስም፦ ${input.businessName}\nምድብ፦ ${input.category}\nከተማ፦ ${city}\nአገልግሎቶች፦ ${serviceList}\n\nእባክዎ አጭር "ስለ እኛ" መግለጫ (2-3 ዓረፍተ ነገሮች) እና የሚማርክ መፈክር (1 ዓረፍተ ነገር) በአማርኛ ይፃፉ።`
      : `Business name: ${input.businessName}\nCategory: ${input.category}\nCity: ${city}\nServices: ${serviceList}\n\nPlease write a short "About" description (2–3 sentences) and a catchy tagline (1 sentence).`;

    const response = await genai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [
        { role: 'user', parts: [{ text: `${systemPrompt}\n\n${prompt}` }] },
      ],
      config: {
        maxOutputTokens: 256,
        temperature: 0.7,
      },
    });

    const text = response.text || '';
    const lines = text.split('\n').filter((l) => l.trim());

    // Heuristic: first meaningful line is the tagline, rest is description.
    // If the model returns just one paragraph, it goes to description.
    const tagline = lines[0]?.trim() || `Your ${input.category} in ${city}`;
    const description = lines.length > 1
      ? lines.slice(1).join(' ').trim()
      : lines[0]?.trim() || `Welcome to ${input.businessName}.`;

    return { description, tagline };
  } catch (error) {
    // On API failure, fall back to static text rather than throwing.
    console.error('[AI] Gemini generation failed:', error);
    if (locale === 'am') {
      return {
        description: `እንኳን ወደ ${input.businessName} በደህና መጡ። ${serviceList} በ ${city} ውስጥ እናቀርባለን።`,
        tagline: `${input.businessName} — የእርስዎ ${input.category}`,
      };
    }
    return {
      description: `Welcome to ${input.businessName}. We provide ${serviceList} in ${city}.`,
      tagline: `Your trusted ${input.category}`,
    };
  }
}

export interface MarketingSnippetInput {
  businessName: string;
  category: string;
  services: string[];
  locale?: 'en' | 'am';
}

export interface MarketingSnippetOutput {
  snippet: string;
  locale: 'en' | 'am';
}

/**
 * Generate a short (2-sentence) social-media marketing post for a business,
 * in the requested locale. Powered by Gemini when `GEMINI_API_KEY` is set;
 * returns a static fallback otherwise. Never throws and never logs the API
 * key — the catch block only records the message.
 */
export async function generateMarketingSnippet(
  input: MarketingSnippetInput,
): Promise<MarketingSnippetOutput> {
  const serviceList = input.services.length > 0
    ? input.services.slice(0, 5).join(', ')
    : 'services';
  const locale = input.locale === 'am' ? 'am' : 'en';

  if (!API_KEY) {
    // Static fallback: always safe, always returns a reasonable post.
    if (locale === 'am') {
      return {
        snippet: `${input.businessName} በ${input.category} ዘርፍ ምርጥ አገልግሎት ያቀርባል። ${serviceList} ለማግኘት ዛሬ ይጎብኙና ቦታዎን ያስይዙ።`,
        locale,
      };
    }
    return {
      snippet: `${input.businessName} is your go-to for top-quality ${input.category} services. Book today and experience ${serviceList} done right.`,
      locale,
    };
  }

  try {
    const { GoogleGenAI } = await import('@google/genai');
    const genai = new GoogleGenAI({ apiKey: API_KEY });

    const systemPrompt = locale === 'am'
      ? 'You are a social-media copywriter for Ethiopian businesses who writes in Amharic. Write a short, engaging social post of exactly 2 sentences. Never mention any platform name or tool — only the business name.'
      : 'You are a social-media copywriter. Write a short, engaging social post of exactly 2 sentences. Never mention any platform name or tool — only the business name.';

    const prompt = locale === 'am'
      ? `የንግድ ስም፦ ${input.businessName}\nምድብ፦ ${input.category}\nአገልግሎቶች፦ ${serviceList}\n\nእባክዎ ባጭሩ (2 ዓረፍተ ነገሮች) ለማህበራዊ ሚዲያ የሚሆን ማስታወቂያ በአማርኛ ይፃፉ።`
      : `Business name: ${input.businessName}\nCategory: ${input.category}\nServices: ${serviceList}\n\nPlease write a short 2-sentence social media post.`;

    const response = await genai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [
        { role: 'user', parts: [{ text: `${systemPrompt}\n\n${prompt}` }] },
      ],
      config: {
        maxOutputTokens: 160,
        temperature: 0.8,
      },
    });

    const text = (response.text || '').trim();
    if (text) {
      return { snippet: text, locale };
    }
  } catch (error) {
    // On API failure, fall back to static text rather than throwing. The API
    // key is never part of this log line.
    console.error('[AI] Marketing snippet generation failed:', (error as Error)?.message || error);
  }

  if (locale === 'am') {
    return {
      snippet: `${input.businessName} በ${input.category} ዘርፍ ምርጥ አገልግሎት ያቀርባል። ${serviceList} ለማግኘት ዛሬ ይጎብኙና ቦታዎን ያስይዙ።`,
      locale,
    };
  }
  return {
    snippet: `${input.businessName} is your go-to for top-quality ${input.category} services. Book today and experience ${serviceList} done right.`,
    locale,
  };
}