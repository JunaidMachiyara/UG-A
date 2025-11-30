
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { CURRENT_USER } from '../constants';
import { Send, Image as ImageIcon, Search, Hash, MessageCircle, MoreVertical } from 'lucide-react';
import { ChatMessage } from '../types';

export const ChatModule: React.FC = () => {
    const { state, sendMessage, markChatRead } = useData();
    const [activeChatId, setActiveChatId] = useState('general');
    const [messageInput, setMessageInput] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // --- Derived State ---
    
    // 1. Contact List (Employees + Meeting Room)
    const contacts = useMemo(() => {
        // Exclude current user from list
        const others = state.employees.filter(e => e.id !== CURRENT_USER.id && e.status === 'Active');
        
        // Filter by Search
        return others.filter(e => e.name.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [state.employees, searchTerm]);

    // 2. Unread Counts
    const getUnreadCount = (chatId: string) => {
        return state.chatMessages.filter(
            m => m.chatId === chatId && !m.readBy.includes(CURRENT_USER.id)
        ).length;
    };

    // 3. Active Messages
    const activeMessages = useMemo(() => {
        return state.chatMessages.filter(m => m.chatId === activeChatId).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    }, [state.chatMessages, activeChatId]);

    // --- Effects ---

    // Scroll to bottom on new message
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [activeMessages]);

    // Mark Read on Entry
    useEffect(() => {
        markChatRead(activeChatId);
    }, [activeChatId, state.chatMessages.length]);

    // --- Actions ---

    const handleSendMessage = () => {
        if (!messageInput.trim()) return;

        const newMsg: ChatMessage = {
            id: Math.random().toString(36).substr(2, 9),
            chatId: activeChatId,
            senderId: CURRENT_USER.id,
            senderName: CURRENT_USER.name,
            text: messageInput,
            timestamp: new Date().toISOString(),
            readBy: [CURRENT_USER.id]
        };

        sendMessage(newMsg);
        setMessageInput('');
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onloadend = () => {
            const base64 = reader.result as string;
            const newMsg: ChatMessage = {
                id: Math.random().toString(36).substr(2, 9),
                chatId: activeChatId,
                senderId: CURRENT_USER.id,
                senderName: CURRENT_USER.name,
                text: '',
                image: base64,
                timestamp: new Date().toISOString(),
                readBy: [CURRENT_USER.id]
            };
            sendMessage(newMsg);
        };
        reader.readAsDataURL(file);
        
        // Reset input
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const getPrivateChatId = (otherUserId: string) => {
        // Sort IDs alphabetically to ensure consistency regardless of who initiates
        const ids = [CURRENT_USER.id, otherUserId].sort();
        return `${ids[0]}_${ids[1]}`;
    };

    const activeChatName = activeChatId === 'general' 
        ? 'Meeting Room' 
        : (state.employees.find(e => getPrivateChatId(e.id) === activeChatId)?.name || 'Unknown User');

    return (
        <div className="flex h-[calc(100vh-80px)] bg-slate-50 border-t border-slate-200">
            {/* Sidebar */}
            <div className="w-80 bg-white border-r border-slate-200 flex flex-col">
                <div className="p-4 border-b border-slate-100">
                    <h2 className="text-lg font-bold text-slate-800 mb-4">Contacts</h2>
                    <div className="relative">
                        <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
                        <input 
                            type="text" 
                            placeholder="Search people..." 
                            className="w-full pl-9 pr-4 py-2 bg-slate-100 border-none rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>
                
                <div className="flex-1 overflow-y-auto">
                    {/* Meeting Room */}
                    <button 
                        onClick={() => setActiveChatId('general')}
                        className={`w-full flex items-center gap-3 p-4 hover:bg-slate-50 transition-colors ${activeChatId === 'general' ? 'bg-blue-50 border-r-4 border-blue-600' : ''}`}
                    >
                        <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
                            <Hash size={20} />
                        </div>
                        <div className="flex-1 text-left">
                            <div className="font-bold text-slate-800 text-sm">Meeting Room</div>
                            <div className="text-xs text-slate-500 truncate">General discussion group</div>
                        </div>
                        {getUnreadCount('general') > 0 && (
                            <div className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                                {getUnreadCount('general')}
                            </div>
                        )}
                    </button>

                    <div className="px-4 py-2 text-xs font-bold text-slate-400 uppercase mt-2">Direct Messages</div>

                    {/* Employee List */}
                    {contacts.map(emp => {
                        const chatId = getPrivateChatId(emp.id);
                        const unread = getUnreadCount(chatId);
                        
                        return (
                            <button 
                                key={emp.id}
                                onClick={() => setActiveChatId(chatId)}
                                className={`w-full flex items-center gap-3 p-3 hover:bg-slate-50 transition-colors ${activeChatId === chatId ? 'bg-blue-50 border-r-4 border-blue-600' : ''}`}
                            >
                                <div className="relative">
                                    <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold">
                                        {emp.name.charAt(0)}
                                    </div>
                                    <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${emp.status === 'Active' ? 'bg-emerald-500' : 'bg-slate-400'}`}></div>
                                </div>
                                <div className="flex-1 text-left">
                                    <div className="font-medium text-slate-800 text-sm">{emp.name}</div>
                                    <div className="text-xs text-slate-500">{emp.designation}</div>
                                </div>
                                {unread > 0 && (
                                    <div className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                                        {unread}
                                    </div>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Chat Window */}
            <div className="flex-1 flex flex-col bg-slate-50 relative">
                {/* Header */}
                <div className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shadow-sm z-10">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
                            {activeChatId === 'general' ? <Hash size={18} /> : activeChatName.charAt(0)}
                        </div>
                        <div>
                            <h2 className="font-bold text-slate-800">{activeChatName}</h2>
                            {activeChatId !== 'general' && <div className="text-xs text-emerald-600 flex items-center gap-1"><span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span> Online</div>}
                        </div>
                    </div>
                    <button className="text-slate-400 hover:text-slate-600"><MoreVertical size={20} /></button>
                </div>

                {/* Messages Area */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    {activeMessages.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-slate-400 opacity-60">
                            <MessageCircle size={48} className="mb-2" />
                            <p>No messages yet. Start the conversation!</p>
                        </div>
                    ) : (
                        activeMessages.map(msg => {
                            const isMe = msg.senderId === CURRENT_USER.id;
                            return (
                                <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[70%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                                        {!isMe && <span className="text-[10px] text-slate-500 mb-1 ml-1">{msg.senderName}</span>}
                                        
                                        <div className={`p-3 rounded-2xl shadow-sm text-sm ${
                                            isMe 
                                            ? 'bg-blue-600 text-white rounded-br-none' 
                                            : 'bg-white text-slate-800 border border-slate-200 rounded-bl-none'
                                        }`}>
                                            {msg.image ? (
                                                <img src={msg.image} alt="Shared" className="rounded-lg max-w-full max-h-60 mb-1" />
                                            ) : (
                                                <p className="whitespace-pre-wrap">{msg.text}</p>
                                            )}
                                        </div>
                                        
                                        <span className="text-[10px] text-slate-400 mt-1 mx-1">
                                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                </div>
                            );
                        })
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="p-4 bg-white border-t border-slate-200">
                    <div className="flex items-end gap-2 bg-slate-50 border border-slate-200 rounded-xl p-2">
                        <button 
                            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            onClick={() => fileInputRef.current?.click()}
                            title="Share Image"
                        >
                            <ImageIcon size={20} />
                        </button>
                        <input 
                            type="file" 
                            ref={fileInputRef} 
                            className="hidden" 
                            accept="image/*" 
                            onChange={handleImageUpload} 
                        />
                        <textarea
                            className="flex-1 bg-transparent border-none focus:ring-0 resize-none text-sm text-slate-800 max-h-32 py-2"
                            placeholder="Type a message..."
                            rows={1}
                            value={messageInput}
                            onChange={e => setMessageInput(e.target.value)}
                            onKeyDown={handleKeyPress}
                        />
                        <button 
                            onClick={handleSendMessage}
                            disabled={!messageInput.trim()}
                            className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            <Send size={18} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};