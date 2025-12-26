
import React, { useState, useEffect, useRef, KeyboardEvent } from 'react';
import { ChevronDown, X, Plus } from 'lucide-react';

export interface Entity {
    id: string;
    name: string;
    [key: string]: any; // Allow additional properties
}

interface EntitySelectorProps {
    entities: Entity[];
    selectedId: string;
    onSelect: (id: string) => void;
    placeholder?: string;
    disabled?: boolean;
    className?: string;
    required?: boolean;
    onQuickAdd?: () => void; // NEW: Callback to trigger quick add modal
    quickAddLabel?: string; // NEW: Custom label for the add button
    formatOption?: (entity: Entity) => string; // NEW: Custom formatter for dropdown options
    formatSelected?: (entity: Entity) => string; // NEW: Custom formatter for selected value
    searchFields?: string[]; // NEW: Fields to search in (default: ['name'])
}

export const EntitySelector: React.FC<EntitySelectorProps> = ({
    entities,
    selectedId,
    onSelect,
    placeholder = "Select...",
    disabled = false,
    className = "",
    required = false,
    onQuickAdd,
    quickAddLabel = "Add New",
    formatOption,
    formatSelected,
    searchFields = ['name']
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [highlightedIndex, setHighlightedIndex] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);

    const filteredEntities = entities.filter(e => {
        if (!searchTerm) return true; // Show all entities when search is empty
        const searchLower = searchTerm.toLowerCase();
        return searchFields.some(field => {
            const value = e[field];
            return value && String(value).toLowerCase().includes(searchLower);
        });
    });

    // Reset highlighted index when filtered list changes
    useEffect(() => {
        setHighlightedIndex(0);
    }, [filteredEntities.length, searchTerm]);

    // Track if user is actively typing (to prevent useEffect from overwriting)
    const isTypingRef = useRef(false);

    useEffect(() => {
        // Don't update searchTerm if user is actively typing or dropdown is open (user might be searching)
        if (isTypingRef.current || isOpen) {
            if (isTypingRef.current) {
                isTypingRef.current = false; // Reset flag after one render
            }
            return;
        }
        
        const selected = entities.find(e => e.id === selectedId);
        if (selected) {
            setSearchTerm(formatSelected ? formatSelected(selected) : selected.name);
        } else if (selectedId === '') {
            // Only clear if searchTerm is empty (don't clear user's typing)
            if (searchTerm === '') {
                setSearchTerm('');
            }
        }
    }, [selectedId, entities, formatSelected, isOpen]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
                const selected = entities.find(e => e.id === selectedId);
                if (selected) setSearchTerm(formatSelected ? formatSelected(selected) : selected.name);
                else if (!selectedId) setSearchTerm('');
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [selectedId, entities, formatSelected]);

    const handleSelect = (entity: Entity) => {
        onSelect(entity.id);
        setSearchTerm(formatSelected ? formatSelected(entity) : entity.name);
        setIsOpen(false);
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (disabled) return;

        // Open dropdown on ArrowDown/ArrowUp/Space when closed
        if (!isOpen && (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === ' ')) {
            e.preventDefault();
            setIsOpen(true);
            setHighlightedIndex(0);
            return;
        }

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setHighlightedIndex(prev => 
                    Math.min(prev + 1, filteredEntities.length - 1)
                );
                break;
            case 'ArrowUp':
                e.preventDefault();
                setHighlightedIndex(prev => Math.max(prev - 1, 0));
                break;
            case 'Enter':
                e.preventDefault();
                if (isOpen && filteredEntities[highlightedIndex]) {
                    handleSelect(filteredEntities[highlightedIndex]);
                } else if (!isOpen) {
                    setIsOpen(true);
                }
                break;
            case ' ':
                // If dropdown is open and no search term, select highlighted item
                if (isOpen && searchTerm.trim() === '') {
                    e.preventDefault();
                    if (filteredEntities[highlightedIndex]) {
                        handleSelect(filteredEntities[highlightedIndex]);
                    }
                }
                // Otherwise, allow space for searching
                break;
            case 'Escape':
                e.preventDefault();
                setIsOpen(false);
                inputRef.current?.blur();
                break;
            case 'Tab':
                if (isOpen) {
                    // Auto-select highlighted on Tab if dropdown is open
                    if (filteredEntities[highlightedIndex]) {
                        handleSelect(filteredEntities[highlightedIndex]);
                    }
                }
                setIsOpen(false);
                break;
        }
    };

    useEffect(() => {
        if (isOpen && listRef.current && filteredEntities.length > 0) {
            const el = listRef.current.children[highlightedIndex] as HTMLElement;
            if (el) el.scrollIntoView({ block: 'nearest' });
        }
    }, [highlightedIndex, isOpen, filteredEntities.length]);

    const clearSelection = (e: React.MouseEvent) => {
        e.stopPropagation();
        onSelect('');
        setSearchTerm('');
        inputRef.current?.focus();
    };

    return (
        <div className={`relative ${className}`} ref={containerRef}>
            <div className="relative group">
                <input
                    ref={inputRef}
                    type="text"
                    className={`w-full pl-3 pr-10 py-2.5 border rounded-lg text-sm bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all shadow-sm ${disabled ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : 'border-slate-300'}`}
                    placeholder={placeholder}
                    value={searchTerm}
                    onChange={e => {
                        const newValue = e.target.value;
                        // Mark that user is actively typing
                        isTypingRef.current = true;
                        
                        // If user starts typing and something is selected, clear the selection to allow searching
                        if (selectedId) {
                            const selectedEntity = entities.find(e => e.id === selectedId);
                            const selectedDisplayName = selectedEntity ? (formatSelected ? formatSelected(selectedEntity) : selectedEntity.name) : '';
                            // If the new value doesn't match the selected entity's name, user is typing - clear selection
                            if (newValue !== selectedDisplayName) {
                                onSelect('');
                            }
                        }
                        setSearchTerm(newValue);
                        setIsOpen(true);
                        setHighlightedIndex(0);
                    }}
                    onFocus={() => {
                        if (!disabled) {
                            setIsOpen(true);
                            // Mark that user is interacting - prevent useEffect from overwriting
                            isTypingRef.current = true;
                            // If there's a selected value, clear it to allow searching
                            if (selectedId) {
                                onSelect('');
                            }
                            // Clear search term so user can start typing fresh
                            setSearchTerm('');
                        }
                    }}
                    onClick={() => {
                        if (!disabled) {
                            setIsOpen(true);
                            setSearchTerm('');
                        }
                    }}
                    onKeyDown={handleKeyDown}
                    disabled={disabled}
                    required={required && !selectedId}
                    autoComplete="off"
                />
                <div className="absolute right-3 top-2.5 flex items-center gap-1">
                    {selectedId && !disabled && (
                        <button 
                            type="button" 
                            onClick={clearSelection}
                            className="text-slate-400 hover:text-red-500 transition-colors p-0.5"
                            tabIndex={-1}
                        >
                            <X size={14} />
                        </button>
                    )}
                    <ChevronDown size={16} className={`text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                </div>
            </div>

            {isOpen && !disabled && (
                <div className="absolute top-full left-0 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl z-50 max-h-60 flex flex-col animate-in fade-in zoom-in-95 duration-100 overflow-hidden">
                    <div className="overflow-y-auto p-1" ref={listRef}>
                        {filteredEntities.length > 0 ? (
                            filteredEntities.map((entity, index) => (
                                <div
                                    key={entity.id}
                                    className={`px-3 py-2 text-sm rounded-md cursor-pointer transition-colors ${
                                        index === highlightedIndex 
                                            ? 'bg-blue-500 text-white font-medium shadow-sm' 
                                            : entity.id === selectedId
                                            ? 'bg-blue-50 text-blue-700'
                                            : 'text-slate-700 hover:bg-slate-50'
                                    }`}
                                    onClick={() => handleSelect(entity)}
                                    onMouseEnter={() => setHighlightedIndex(index)}
                                >
                                    {formatOption ? formatOption(entity) : entity.name}
                                </div>
                            ))
                        ) : (
                            <div className="p-3 text-center text-xs text-slate-400 italic">No matches found</div>
                        )}
                    </div>
                    {onQuickAdd && (
                        <div className="border-t border-slate-100 p-1 bg-slate-50">
                            <button
                                onMouseDown={(e) => {
                                    e.preventDefault(); // Prevent input blur
                                    onQuickAdd();
                                    setIsOpen(false);
                                }}
                                className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-blue-600 font-medium hover:bg-blue-100 rounded-md transition-colors"
                            >
                                <Plus size={14} /> {quickAddLabel}
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
