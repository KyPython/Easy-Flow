import React, { useState, useRef, useEffect } from 'react';
import styles from './SearchBar.module.css';
import { FaSearch, FaTimes, FaFilter } from 'react-icons/fa';

const SearchBar = ({
 value = '',
 onChange,
 onClear,
 placeholder = 'Search...',
 showFilter = false,
 onFilterClick,
 filterActive = false,
 suggestions = [],
 onSuggestionSelect,
 className = '',
 ...props
}) => {
 const [isFocused, setIsFocused] = useState(false);
 const [showSuggestions, setShowSuggestions] = useState(false);
 const inputRef = useRef(null);
 const suggestionsRef = useRef(null);

 const searchClasses = [
 styles.searchBar,
 isFocused && styles.focused,
 className
 ].filter(Boolean).join(' ');

 useEffect(() => {
 const handleClickOutside = (event) => {
 if (
 suggestionsRef.current && 
 !suggestionsRef.current.contains(event.target) &&
 !inputRef.current.contains(event.target)
 ) {
 setShowSuggestions(false);
 }
 };

 document.addEventListener('mousedown', handleClickOutside);
 return () => document.removeEventListener('mousedown', handleClickOutside);
 }, []);

 const handleInputChange = (e) => {
 const newValue = e.target.value;
 onChange?.(newValue);
 setShowSuggestions(suggestions.length > 0 && newValue.length > 0);
 };

 const handleInputFocus = () => {
 setIsFocused(true);
 if (suggestions.length > 0 && value.length > 0) {
 setShowSuggestions(true);
 }
 };

 const handleInputBlur = () => {
 setIsFocused(false);
 // Delay hiding suggestions to allow for clicks
 setTimeout(() => setShowSuggestions(false), 200);
 };

 const handleClear = () => {
 onChange?.('');
 onClear?.();
 inputRef.current?.focus();
 setShowSuggestions(false);
 };

 const handleSuggestionClick = (suggestion) => {
 onSuggestionSelect?.(suggestion);
 setShowSuggestions(false);
 inputRef.current?.blur();
 };

 const handleKeyDown = (e) => {
 if (e.key === 'Escape') {
 setShowSuggestions(false);
 inputRef.current?.blur();
 }
 };

 const filteredSuggestions = suggestions.filter(suggestion =>
 suggestion.toLowerCase().includes(value.toLowerCase())
 );

 return (
 <div className={styles.searchContainer}>
 <div className={searchClasses}>
 <FaSearch className={styles.searchIcon} />
 
 <input
 ref={inputRef}
 type="text"
 value={value}
 onChange={handleInputChange}
 onFocus={handleInputFocus}
 onBlur={handleInputBlur}
 onKeyDown={handleKeyDown}
 placeholder={placeholder}
 className={styles.searchInput}
 {...props}
 />
 
 {value && (
 <button
 type="button"
 onClick={handleClear}
 className={styles.clearButton}
 aria-label="Clear search"
 >
 <FaTimes />
 </button>
 )}
 
 {showFilter && (
 <button
 type="button"
 onClick={onFilterClick}
 className={`${styles.filterButton} ${filterActive ? styles.filterActive : ''}`}
 aria-label="Toggle filters"
 >
 <FaFilter />
 </button>
 )}
 </div>

 {/* Suggestions Dropdown */}
 {showSuggestions && filteredSuggestions.length > 0 && (
 <div ref={suggestionsRef} className={styles.suggestions}>
 {filteredSuggestions.map((suggestion, index) => (
 <button
 key={index}
 type="button"
 className={styles.suggestionItem}
 onClick={() => handleSuggestionClick(suggestion)}
 >
 <FaSearch className={styles.suggestionIcon} />
 {suggestion}
 </button>
 ))}
 </div>
 )}
 </div>
 );
};

export default SearchBar;