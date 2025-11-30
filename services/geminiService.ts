import { GoogleGenAI } from "@google/genai";
import { AppState } from '../types';

const getClient = () => {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
        console.error("API Key not found");
        return null;
    }
    return new GoogleGenAI({ apiKey });
};

export const generateAIResponse = async (userPrompt: string, appState: AppState): Promise<string> => {
    const ai = getClient();
    if (!ai) return "Error: API Key is missing. Please check your configuration.";

    // Contextualizing the AI with the current business state
    const systemContext = `
    You are the AI Assistant for "Usman Global", a used clothing inventory management system.
    
    Current System Snapshot:
    - Total Items: ${appState.items.length}
    - Total Partners: ${appState.partners.length}
    - Recent Ledger Entries: ${appState.ledger.length}
    
    Financial Summary:
    - Top Customer: ${appState.partners.find(p => p.type === 'CUSTOMER')?.name || 'N/A'}
    - Cash Accounts: ${appState.accounts.filter(a => a.name.includes('Cash')).map(a => `${a.name}: $${a.balance}`).join(', ')}
    
    Your role is to help the user navigate the system, analyze trends, and explain accounting logic (Double Entry, Landed Cost, Moving Average).
    Keep answers concise, professional, and helpful. Format nicely.
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: userPrompt,
            config: {
                systemInstruction: systemContext,
                temperature: 0.7,
            }
        });

        return response.text || "I couldn't generate a response.";
    } catch (error) {
        console.error("Gemini API Error:", error);
        return "I encountered an error processing your request. Please try again.";
    }
};